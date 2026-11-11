# ResumeFit BM25 Model Update

This version adds BM25 as the next comparison model while preserving the existing TF-IDF and Sentence-BERT calculations.

## What changed

- The Python backend now calculates a calibrated BM25 requirement-to-resume score.
- Each job requirement is treated as a query and the resume sections are candidate documents.
- The results page contains a Model comparison board for TF-IDF, Sentence-BERT, and BM25.
- BM25 is currently experimental and does not change the existing overall job-fit formula.
- The missing `build/sites-vite-plugin.ts` file is included so `npm run dev` can load `vite.config.ts`.

## Run locally

Open PowerShell in this folder and run the backend:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
python -m uvicorn backend.app:app --reload --port 8000
```

Keep that terminal open. Open a second PowerShell terminal in the same folder and run the frontend:

```powershell
npm install
npm run dev
```

Open the local address printed by the frontend, normally `http://localhost:5173`.

## API response

`POST /analyze` now returns `bm25_similarity` in addition to the existing Sentence-BERT fields. The frontend places it on the Model comparison board.

