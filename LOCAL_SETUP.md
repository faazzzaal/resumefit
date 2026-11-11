# ResumeFit Local Setup

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- Python 3.10 or newer

## First-time installation

Open PowerShell in the extracted `resume-fit` folder:

```powershell
npm install
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

If PowerShell blocks activation, run the Python commands without activation:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## Start the application

Open two PowerShell windows in the `resume-fit` folder.

Terminal 1 — start the Sentence-BERT backend:

```powershell
.\.venv\Scripts\Activate.ps1
npm run backend
```

Or, without activating the environment:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --port 8000
```

Terminal 2 — start the web application:

```powershell
npm run dev
```

Open the local address printed in the terminal, normally:

```text
http://localhost:5173
```

The exact frontend port is printed in Terminal 2. The backend runs at `http://127.0.0.1:8000`. Resume drafts are saved automatically in browser storage. Comparison data is sent only to the locally running Python backend.

The first semantic comparison downloads the `all-MiniLM-L6-v2` model and may take several minutes. Later comparisons are faster because the model is cached.

## Production-style local test

```bash
npm run build
npm start
```

Open the address printed by the start command.

## Current functionality

- Two entry options: complete the structured form or upload an existing resume
- Layout-aware PDF extraction with PyMuPDF, plus DOCX and TXT extraction
- Flexible section-heading recognition and automatic form population
- Parsing warnings for fields that require manual review
- Editable review of all extracted information before resume generation
- Structured resume form for personal details and professional summary
- Repeatable experience, education, and project entries
- Skills and certification fields
- Automatic browser-local draft saving
- Required-field validation
- Generated resume preview using the entered information
- Print or save the generated resume as a PDF
- Job-description entry and comparison workflow
- Sentence-BERT semantic matching with TF-IDF fallback
- Bullet-level semantic comparison for more precise evidence matching
- Expanded Java ecosystem recognition, including J2EE, Spring, Hibernate, SOAP, Maven, Jenkins, and JUnit
- Separate experience-duration and education-requirement scores
- Job-fit weighting that excludes ATS readiness from the overall match
- Requirement-by-requirement matching against the best resume section
- Recognized skill matching with matched and missing skill lists
- Weighted job-match percentage and a separate ATS-readiness score
- Resume improvement recommendations and course suggestions

## Important files

- `app/page.tsx` contains the resume form, draft saving, and job-description screen.
- `backend/app.py` contains the FastAPI Sentence-BERT comparison service.
- `backend/requirements.txt` contains the Python dependencies.
- `app/globals.css` contains the visual theme.

## Troubleshooting

- If `npm install` fails, verify that `node --version` reports version 22.13 or newer.
- If the results say `TF-IDF fallback`, confirm that Terminal 1 is running without errors and open `http://127.0.0.1:8000/health`.
- If resume upload fails, reinstall the updated backend packages with `pip install -r backend\requirements.txt` and restart the backend.
- Image-only or scanned PDFs are not supported yet; export them as a text-based PDF or DOCX first.
- Complex graphical resumes can still require manual corrections. The upload message identifies fields that were not confidently detected.
- If `python` is not recognized on Windows, use `py` or the explicit `.venv\Scripts\python.exe` command above.
- If a saved draft appears incorrect, clear the site's browser storage and refresh the page.
