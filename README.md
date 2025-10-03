# Patient Intake Triage System using AI #

A decision support application for patient intake triage based on Artifical Intelligence. 

## What it does ##

- Create patients with name, optional MRN/phone, DOB, and sex; basic client-side validation for required fields. Fast search on name/MRN to reuse existing records and avoid duplicates 
- Users can add multiple visits of a single patient or many patients and also enter the symptoms experienced by the patients
- The _RunAI_ button calls an AI-based Decision Support system to calculate the risk based on the symptoms entered for a particular patient
- Minimal fields have been set by default; stores just enough context for triage in development environments

## Tech Stack ##
- _Frontend:_ HTML, CSS, JavaScript (fetch API)
- _API:_ NodeJS
- _Backend:_ MySQL 8, Python 3.10+



