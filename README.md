# Patient Intake Triage System using AI #

A decision support application for patient intake triage based on Artifical Intelligence. 

## Flowchart ##

A flowchart depicting the working of this system is given below:   

<img width="397" height="486" alt="image" src="https://github.com/user-attachments/assets/388f9405-8cf4-4cc1-a790-4f2697b73931" />

## What it does ##

- Create patients with name, optional MRN/phone, DOB, and sex; basic client-side validation for required fields. Fast search on name/MRN to reuse existing records and avoid duplicates 
- Users can add multiple visits of a single patient or many patients and also enter the symptoms experienced by the patients
- The _RunAI_ button calls an AI-based Decision Support system to calculate the risk based on the symptoms entered for a particular patient
- Minimal fields have been set by default; stores just enough context for triage in development environments

## Tech Stack ##
- _Frontend:_ HTML, CSS, JavaScript (fetch API)
- _API:_ NodeJS
- _Backend:_ MySQL 8, Python 3.10+

## Development Tips ##
- After editing .env, always restart Node
- Keep the *AI service* terminal open to view feedbacks

## License ##
MIT - see [LICENSE](https://github.com/JaySawant31/triage-ai?tab=MIT-1-ov-file#)

