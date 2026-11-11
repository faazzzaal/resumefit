# ResumeFit

ResumeFit is a resume-building and job-matching web application. Users can enter resume information manually or upload an existing PDF, DOCX, or TXT resume, review the extracted fields, generate a formatted resume, compare it with a job description, and create a tailored cover letter.

## Features

- Structured resume form and browser-local draft storage
- Resume upload with automatic field extraction
- Generated resume preview and PDF printing
- Job-description comparison
- TF-IDF cosine similarity baseline
- Sentence-BERT semantic similarity
- BM25 keyword relevance
- Skills, experience, education, and ATS-readiness scores
- Requirement-level semantic matches
- Resume-improvement and course recommendations
- Tailored cover-letter generation

## Technology

- React, TypeScript, Tailwind CSS, Vite, and Vinext
- FastAPI and Python
- Sentence Transformers with `all-MiniLM-L6-v2`
- PyMuPDF, pypdf, and python-docx

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- Python 3.10 or newer

## Installation

```powershell
npm install
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
```

## Running Locally

Start the backend:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
npm run dev
```

Open the frontend address printed in the terminal. The backend API documentation is available at `http://127.0.0.1:8000/docs`.

## Validation

```powershell
npm run lint
npm run build
python -m pytest backend/test_parser.py
```

## Project Structure

- `app/page.tsx`: resume form, preview, matching results, and cover-letter workflow
- `backend/app.py`: document parsing and matching API
- `backend/test_parser.py`: parser tests
- `app/globals.css`: application styles
- `components/ui`: reusable interface components
