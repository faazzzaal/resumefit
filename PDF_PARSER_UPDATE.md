# ResumeFit PDF Parser Update

## Improvements

- Uses PyMuPDF text blocks for more reliable PDF reading order.
- Falls back to pypdf when a PDF contains very little extractable text.
- Recognizes additional headings such as Work History, Career History, Technology Stack, Core Skills, and Academic Qualifications.
- Detects job title, company, location, dates, degree, and school using field patterns instead of fixed line positions.
- Separates combined lines such as `Clarivate | Bangalore, India` and `Lamar University | Beaumont, TX`.
- Supports additional skill aliases and skill-category labels.
- Preserves leading quantities such as `5+ years` in job requirements.
- Returns parsing warnings for fields that require manual review.
- Displays the extraction method and warning summary after upload.

## Test procedure

1. Reinstall the Python dependencies because PyMuPDF was added:

   ```powershell
   .\.venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   ```

2. Start the backend:

   ```powershell
   npm run backend
   ```

3. Start the frontend in another terminal:

   ```powershell
   npm run dev
   ```

4. Upload a text-based PDF, review the upload message, and verify every auto-filled field.

## Limitation

Image-only or scanned PDFs still require OCR. Highly graphical resumes may require manual corrections.
