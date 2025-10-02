-- Fresh DB
DROP DATABASE IF EXISTS triage_db;
CREATE DATABASE triage_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE triage_db;

-- Patients
CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mrn VARCHAR(64) UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  dob DATE,
  sex ENUM('F','M','X') NULL,
  phone VARCHAR(40),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Visits
CREATE TABLE visits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  visit_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  chief_complaint VARCHAR(255),
  symptom_text TEXT,
  status ENUM('NEW','IN_REVIEW','DONE','CANCELLED') NOT NULL DEFAULT 'NEW',
  CONSTRAINT fk_visit_patient FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB;

-- Optional attachments (photo/doc paths)
CREATE TABLE attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT NOT NULL,
  kind ENUM('PHOTO','DOC') NOT NULL,
  path VARCHAR(512) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- AI predictions audit
CREATE TABLE triage_predictions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT NOT NULL,
  risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL,
  risk_score DECIMAL(5,4) NOT NULL, -- 0..1
  rationale VARCHAR(512),
  model_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tp_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Helpful indexes
CREATE INDEX idx_patient_name ON patients(last_name, first_name);
CREATE INDEX idx_visit_patient_time ON visits(patient_id, visit_time);
CREATE INDEX idx_tp_visit_created ON triage_predictions(visit_id, created_at);

-- Latest prediction per visit
DROP VIEW IF EXISTS v_triage_queue;
CREATE VIEW v_triage_queue AS
SELECT
  v.id AS visit_id,
  p.first_name, p.last_name, p.dob, p.sex,
  v.visit_time, v.chief_complaint, v.status,
  x.risk_level, x.risk_score, x.rationale, x.created_at AS predicted_at
FROM visits v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN (
  SELECT t.*
  FROM triage_predictions t
  JOIN (
    SELECT visit_id, MAX(id) AS max_id
    FROM triage_predictions
    GROUP BY visit_id
  ) last ON last.max_id = t.id
) x ON x.visit_id = v.id;

-- Seed data (demo)
INSERT INTO patients (mrn, first_name, last_name, dob, sex, phone) VALUES
('MRN-1001','Alex','Rivera','1990-05-11','X','+1-555-1001'),
('MRN-1002','Jamie','Chen','1985-09-02','F','+1-555-1002');

INSERT INTO visits (patient_id, chief_complaint, symptom_text, status) VALUES
-- LOW-ish symptoms
(1, 'Headache', 'Mild headache for two days; no vision changes; no fever', 'NEW'),
-- MED/HIGH-ish symptoms (red flag words)
(2, 'Chest Pain', 'Intermittent chest pain with shortness of breath this morning', 'NEW');

-- Create a dedicated app user (change the password)
CREATE USER IF NOT EXISTS 'triage_user'@'localhost' IDENTIFIED BY 'StrongPass!123';

-- Grant only what the app needs on this schema
GRANT SELECT, INSERT, UPDATE, DELETE
ON triage_db.* TO 'triage_user'@'localhost';

FLUSH PRIVILEGES;

