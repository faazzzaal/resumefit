# ResumeFit Cover Letter Update

This version adds an evidence-grounded, template-based cover letter generator. It does not require a generative AI service, API key, or additional Python package.

## Workflow

1. Upload or enter a resume.
2. Add a job description and run the existing comparison.
3. On the results page, enter the company name and job title.
4. Select **Generate cover letter**.
5. Edit, copy, download, or print the generated letter.

The generator uses only information already present in the resume and the matched-skill results. It ranks experience and project statements, selects the strongest supporting evidence, and inserts it into a professional four-paragraph template.

## Other correction included

Experience scoring now recognizes written numbers such as `five years` and `three years`, in addition to numeric forms such as `5 years` and `3 years`.

## Run locally

Backend:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
python -m uvicorn backend.app:app --reload --port 8000
```

Frontend in a second PowerShell window:

```powershell
npm install
npm run dev
```

