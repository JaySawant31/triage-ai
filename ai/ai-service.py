from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import numpy as np

app = FastAPI(title="Triage AI", version="0.1.0")

class TriageIn(BaseModel):
    text: str
    age: Optional[int] = None
    sex: Optional[str] = None  # 'F','M','X'

class TriageOut(BaseModel):
    risk_level: str      # 'LOW'|'MEDIUM'|'HIGH'
    risk_score: float    # 0..1
    rationale: str
    model_version: str = "v0.1"

RED_FLAGS = [
    "chest pain", "shortness of breath", "severe bleeding",
    "loss of consciousness", "stroke", "one-sided weakness"
]
MID_FLAGS = ["fever", "dizziness", "vomiting", "persistent cough", "infection"]

@app.post("/predict", response_model=TriageOut)
def predict(inp: TriageIn):
    text = (inp.text or "").lower()

    score = 0.2
    if any(k in text for k in RED_FLAGS):
        score = 0.85
    elif any(k in text for k in MID_FLAGS):
        score = 0.55

    if score >= 0.75:
        level = "HIGH"; rationale = "Red-flag indicators detected."
    elif score >= 0.45:
        level = "MEDIUM"; rationale = "Moderate risk indicators present."
    else:
        level = "LOW"; rationale = "No red-flag indicators detected."

    return TriageOut(
        risk_level=level,
        risk_score=float(np.round(score, 3)),
        rationale=rationale,
        model_version="v0.1"
    )
