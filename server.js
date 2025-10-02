import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/", express.static(path.join(__dirname, "public")));

/* ---------- Helpers ---------- */
const orderByRisk = `
  CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END
`;

/* ---------- Patients ---------- */
// Create patient
app.post("/api/patients", async (req, res) => {
  try {
    const { mrn = null, first_name, last_name, dob = null, sex = null, phone = null } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: "first_name and last_name are required" });
    const [r] = await pool.query(
      `INSERT INTO patients (mrn, first_name, last_name, dob, sex, phone) VALUES (?,?,?,?,?,?)`,
      [mrn, first_name, last_name, dob, sex, phone]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Search/list patients
app.get("/api/patients", async (req, res) => {
  try {
    const q = (req.query.search || "").trim();
    let sql = `SELECT id, mrn, first_name, last_name, dob, sex, phone FROM patients`;
    const params = [];
    if (q) {
      sql += ` WHERE first_name LIKE ? OR last_name LIKE ? OR mrn LIKE ?`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY last_name, first_name LIMIT 200`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Visits ---------- */
// Create visit
app.post("/api/visits", async (req, res) => {
  try {
    const { patient_id, chief_complaint = null, symptom_text = null } = req.body;
    if (!patient_id) return res.status(400).json({ error: "patient_id is required" });
    const [r] = await pool.query(
      `INSERT INTO visits (patient_id, chief_complaint, symptom_text) VALUES (?,?,?)`,
      [patient_id, chief_complaint, symptom_text]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// List visits (raw)
app.get("/api/visits", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.patient_id, v.visit_time, v.chief_complaint, v.status,
              CONCAT(p.first_name,' ',p.last_name) AS patient
       FROM visits v JOIN patients p ON p.id = v.patient_id
       ORDER BY v.id DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Queue (view) ---------- */
app.get("/api/queue", async (req, res) => {
  try {
    const q = (req.query.search || "").trim();
    const risk = (req.query.risk || "").toUpperCase(); // LOW|MEDIUM|HIGH
    let sql = `SELECT * FROM v_triage_queue`;
    const where = [];
    const params = [];
    if (q) {
      where.push(`(first_name LIKE ? OR last_name LIKE ? OR chief_complaint LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (["LOW","MEDIUM","HIGH"].includes(risk)) {
      where.push(`risk_level = ?`);
      params.push(risk);
    }
    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY ${orderByRisk}, visit_time DESC LIMIT 500`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Predictions ---------- */
// Latest predictions log
app.get("/api/predictions", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    const [rows] = await pool.query(
      `SELECT t.id, t.visit_id, t.risk_level, t.risk_score, t.rationale, t.model_version, t.created_at,
              CONCAT(p.first_name,' ',p.last_name) AS patient, v.chief_complaint
       FROM triage_predictions t
       JOIN visits v ON v.id = t.visit_id
       JOIN patients p ON p.id = v.patient_id
       ORDER BY t.id DESC
       LIMIT ?`, [limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- AI Bridge ---------- */
async function callAI(payload) {
  const url = process.env.AI_URL || "http://127.0.0.1:8001/predict";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI service error: ${res.status} ${txt}`);
  }
  return res.json();
}

// Run AI on a visit
app.post("/api/triage/:visit_id", async (req, res) => {
  const visitId = parseInt(req.params.visit_id, 10);
  if (!Number.isInteger(visitId)) return res.status(400).json({ error: "invalid visit id" });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT v.id, v.symptom_text, p.dob, p.sex,
              TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE v.id=?`, [visitId]
    );
    if (!rows.length) return res.status(404).json({ error: "visit not found" });

    const visit = rows[0];
    const ai = await callAI({ text: visit.symptom_text || "", age: visit.age, sex: visit.sex });

    await conn.query(
      `INSERT INTO triage_predictions (visit_id, risk_level, risk_score, rationale, model_version)
       VALUES (?,?,?,?,?)`,
      [visitId, ai.risk_level, ai.risk_score, ai.rationale, ai.model_version]
    );

    res.status(201).json(ai);
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    conn.release();
  }
});

/* ---------- Start ---------- */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Triage app running at http://localhost:${port}`));