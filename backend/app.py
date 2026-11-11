import os
import re
import math
from io import BytesIO
from collections import Counter
from datetime import datetime
from functools import lru_cache

import fitz
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
STOP_WORDS = set(
    "a an and are as at be by for from has have in into is it its of on or our that the their this to using was we will with you your "
    "required preferred responsibilities qualifications experience years work working strong knowledge ability including role team candidate position"
    .split()
)
NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20,
}
EXCLUDED_REQUIREMENT_PHRASES = (
    "equal opportunity", "sexual orientation", "gender identity", "veteran status",
    "reasonable accommodation", "salary range", "benefits package", "privacy policy",
)
SECTION_NAMES = {
    "summary": (
        "summary", "professional summary", "career summary", "profile", "professional profile",
        "career profile", "objective", "career objective", "about me",
    ),
    "skills": (
        "skills", "technical skills", "technical expertise", "technical proficiencies",
        "core competencies", "core skills", "key skills", "technologies", "technology stack",
        "tools and technologies", "areas of expertise",
    ),
    "experience": (
        "experience", "work experience", "professional experience", "employment history",
        "work history", "career history", "relevant experience", "industry experience",
        "internship experience", "professional background",
    ),
    "education": (
        "education", "academic background", "academic qualifications", "education and training",
        "university education", "educational background", "academic history",
    ),
    "projects": (
        "projects", "academic projects", "personal projects", "selected projects", "key projects",
        "relevant projects", "project experience",
    ),
    "certifications": (
        "certifications", "certificates", "licenses", "licenses and certifications",
        "certifications and licenses", "professional certifications", "credentials",
    ),
}
KNOWN_SKILLS = (
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "React", "Angular", "Vue.js",
    "Node.js", "Next.js", "Django", "Flask", "FastAPI", ".NET", "J2EE", "Spring", "Hibernate",
    "Maven", "Jenkins", "JUnit", "SOAP", "SQL", "PostgreSQL", "MySQL",
    "Oracle", "MongoDB", "Snowflake", "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes",
    "Git", "REST APIs", "GraphQL", "Microservices", "Machine Learning", "Deep Learning", "NLP",
    "BERT", "PyTorch", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "Power BI", "Tableau",
    "Spark", "Kafka", "Airflow", "CI/CD", "Agile", "Linux",
)
TITLE_WORDS = (
    "engineer", "developer", "analyst", "scientist", "architect", "consultant", "specialist",
    "manager", "intern", "associate", "assistant", "researcher", "administrator", "lead",
    "director", "coordinator", "technician", "designer", "programmer", "officer",
)
DEGREE_PATTERN = re.compile(
    r"\b(?:bachelor(?:'s)?|master(?:'s)?|doctorate|ph\.?d\.?|associate(?:'s)?|"
    r"b\.?\s?(?:s|a|e|tech)\.?|m\.?\s?(?:s|a|e|tech|ba)\.?|b\.eng|m\.eng|mba)\b",
    re.IGNORECASE,
)
SCHOOL_WORDS = ("university", "college", "institute", "school", "academy", "polytechnic")
US_STATE_PATTERN = (
    r"\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|"
    r"MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b"
)


class ResumeSection(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=15_000)


class AnalyzeRequest(BaseModel):
    resume_text: str = Field(min_length=20, max_length=50_000)
    job_description: str = Field(min_length=80, max_length=50_000)
    sections: list[ResumeSection] = Field(min_length=1, max_length=50)


class RequirementMatch(BaseModel):
    requirement: str
    best_section: str
    score: int
    status: str


class AnalyzeResponse(BaseModel):
    content_similarity: int
    semantic_similarity: int
    bm25_similarity: int
    keyword_coverage: int
    requirement_coverage: int
    experience_match: int
    education_match: int
    requirement_matches: list[RequirementMatch]
    model: str


app = FastAPI(title="ResumeFit Semantic API", version="1.0.0")
frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if frontend_url:
    allowed_origins.append(frontend_url)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def clean_line(value: str) -> str:
    without_marker = re.sub(r"^\s*(?:(?:[-•*▪●◦‣]+)|(?:\d+[.)]))\s*", "", value)
    return re.sub(r"\s+", " ", without_marker).strip()


def extract_requirements(job_description: str) -> list[str]:
    lines: list[str] = []
    for raw_line in job_description.splitlines():
        cleaned = clean_line(raw_line)
        if len(cleaned) < 25:
            continue
        if any(phrase in cleaned.lower() for phrase in EXCLUDED_REQUIREMENT_PHRASES):
            continue
        if len(cleaned) > 320:
            lines.extend(clean_line(sentence) for sentence in re.split(r"(?<=[.!?;])\s+", cleaned))
        else:
            lines.append(cleaned)

    if len(lines) < 3:
        lines = [clean_line(sentence) for sentence in re.split(r"(?<=[.!?;])\s+", job_description)]

    unique: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = line.lower()
        if 25 <= len(line) <= 320 and key not in seen and not any(phrase in key for phrase in EXCLUDED_REQUIREMENT_PHRASES):
            unique.append(line)
            seen.add(key)
    return unique[:30] or [clean_line(job_description[:320])]


def tokenize(text: str) -> list[str]:
    return [token for token in re.findall(r"[a-z0-9+#.]+", text.lower()) if len(token) > 2 and token not in STOP_WORDS]


def keyword_coverage(resume_text: str, job_description: str) -> int:
    counts = Counter(tokenize(job_description))
    important = [word for word, _ in counts.most_common(20)]
    if not important:
        return 0
    resume_words = set(tokenize(resume_text))
    return round(sum(word in resume_words for word in important) / len(important) * 100)


def bm25_similarity(requirements: list[str], section_texts: list[str]) -> int:
    """Return a calibrated 0-100 BM25 requirement-to-resume score.

    Every job requirement is treated as a query and every resume section is a
    candidate document.  The best resume-section score is divided by the score
    of an ideal document containing the requirement itself.  This keeps BM25's
    unbounded raw relevance values interpretable on the application's 0-100
    result board without changing the BM25 ranking formula.
    """
    k1 = 1.5
    b = 0.75
    requirement_scores: list[float] = []

    for requirement in requirements:
        query_tokens = tokenize(requirement)
        section_tokens = [tokenize(text) for text in section_texts]
        if not query_tokens or not any(section_tokens):
            requirement_scores.append(0.0)
            continue

        corpus = [*section_tokens, query_tokens]
        document_count = len(corpus)
        average_length = sum(len(document) for document in corpus) / document_count
        document_frequencies = Counter(
            term for document in corpus for term in set(document)
        )

        def score(document: list[str]) -> float:
            frequencies = Counter(document)
            length_normalizer = k1 * (
                1 - b + b * len(document) / max(average_length, 1.0)
            )
            total = 0.0
            for term in query_tokens:
                frequency = frequencies.get(term, 0)
                if not frequency:
                    continue
                document_frequency = document_frequencies[term]
                inverse_document_frequency = math.log(
                    1 + (document_count - document_frequency + 0.5)
                    / (document_frequency + 0.5)
                )
                total += inverse_document_frequency * (
                    frequency * (k1 + 1) / (frequency + length_normalizer)
                )
            return total

        best_resume_score = max(score(document) for document in section_tokens)
        ideal_score = score(query_tokens)
        calibrated = best_resume_score / ideal_score if ideal_score > 0 else 0.0
        requirement_scores.append(max(0.0, min(1.0, calibrated)))

    if not requirement_scores:
        return 0
    return round(sum(requirement_scores) / len(requirement_scores) * 100)


def parse_month_year(value: str) -> datetime | None:
    cleaned = value.strip().lower()
    if cleaned in {"present", "current", "now"}:
        return datetime.now()
    for pattern in ("%b %Y", "%B %Y", "%Y"):
        try:
            return datetime.strptime(value.strip().title(), pattern)
        except ValueError:
            continue
    return None


def extract_year_values(text: str) -> list[int]:
    numeric = [
        int(value)
        for value in re.findall(r"\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b", text, flags=re.IGNORECASE)
    ]
    words = [
        NUMBER_WORDS[value.lower()]
        for value in re.findall(
            r"\b(" + "|".join(NUMBER_WORDS) + r")\s*\+?\s*(?:years?|yrs?)\b",
            text,
            flags=re.IGNORECASE,
        )
    ]
    return [*numeric, *words]


def experience_match(resume_text: str, job_description: str, sections: list[ResumeSection]) -> int:
    required_years = extract_year_values(job_description)
    if not required_years:
        return 100
    date_token = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ .'-]*\d{4}|(?:19|20)\d{2}|Present|Current"
    ranges: set[tuple[str, str]] = set()
    for section in sections:
        if not section.label.lower().startswith("experience"):
            continue
        dates = re.findall(date_token, section.text, flags=re.IGNORECASE)
        if len(dates) >= 2:
            ranges.add((dates[0], dates[1]))
    dated_months = 0
    for start_value, end_value in ranges:
        start = parse_month_year(start_value)
        end = parse_month_year(end_value)
        if start and end and end >= start:
            dated_months += (end.year - start.year) * 12 + end.month - start.month
    explicit_years = extract_year_values(resume_text)
    candidate_years = max([dated_months / 12, *explicit_years, 0])
    return round(min(1.0, candidate_years / max(required_years)) * 100)


def education_match(job_description: str, sections: list[ResumeSection]) -> int:
    if not re.search(r"bachelor|master|degree|computer science|engineering", job_description, flags=re.IGNORECASE):
        return 100
    education_text = " ".join(section.text for section in sections if section.label.lower().startswith("education"))
    has_degree = bool(re.search(r"bachelor|master|b\.?s\.?|m\.?s\.?|engineering", education_text, flags=re.IGNORECASE))
    has_field = bool(re.search(r"computer science|information technology|software|engineering", education_text, flags=re.IGNORECASE))
    return 100 if has_degree and has_field else 65 if has_degree else 0


def extract_uploaded_text(filename: str, content: bytes) -> tuple[str, str]:
    extension = os.path.splitext(filename.lower())[1]
    try:
        if extension == ".pdf":
            pages: list[str] = []
            with fitz.open(stream=content, filetype="pdf") as document:
                for page in document:
                    blocks = page.get_text("blocks", sort=True)
                    page_text = "\n".join(
                        block[4].strip()
                        for block in blocks
                        if len(block) > 4 and block[4].strip() and (len(block) < 7 or block[6] == 0)
                    )
                    pages.append(page_text)
            text = "\n".join(pages).strip()
            if len(text) >= 40:
                return text, "PyMuPDF layout-aware extraction"
            fallback = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages)
            return fallback, "pypdf fallback extraction"
        if extension == ".docx":
            document = Document(BytesIO(content))
            paragraphs = [paragraph.text for paragraph in document.paragraphs]
            table_rows = [" | ".join(cell.text for cell in row.cells) for table in document.tables for row in table.rows]
            return "\n".join(paragraphs + table_rows), "DOCX paragraph and table extraction"
        if extension == ".txt":
            return content.decode("utf-8", errors="ignore"), "plain-text extraction"
    except Exception as error:
        raise HTTPException(status_code=422, detail="The resume could not be read. Try exporting it as a text-based PDF or DOCX file.") from error
    raise HTTPException(status_code=415, detail="Only PDF, DOCX, and TXT resumes are supported.")


def normalize_heading(line: str) -> str:
    normalized = line.lower().replace("&", " and ")
    normalized = re.sub(r"[^a-z ]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def match_section_heading(line: str) -> str | None:
    if len(line) > 65 or len(line.split()) > 8:
        return None
    normalized = normalize_heading(line)
    for section, aliases in SECTION_NAMES.items():
        if normalized in aliases:
            return section
    for section, aliases in SECTION_NAMES.items():
        if any(normalized.startswith(f"{alias} and ") for alias in aliases):
            return section
    return None


def split_resume_sections(text: str) -> tuple[list[str], dict[str, list[str]]]:
    lines = [re.sub(r"\s+", " ", line).strip(" |\t") for line in text.splitlines()]
    lines = [line for line in lines if line]
    sections: dict[str, list[str]] = {name: [] for name in SECTION_NAMES}
    header_lines: list[str] = []
    current: str | None = None
    for line in lines:
        matched = match_section_heading(line)
        if matched:
            current = matched
        elif current:
            sections[current].append(line)
        else:
            header_lines.append(line)
    return header_lines, sections


def find_known_skills(text: str) -> list[str]:
    normalized = f" {re.sub(r'[^a-z0-9+#.]+', ' ', text.lower())} "
    aliases = {
        "Node.js": ("node.js", "nodejs", "node"),
        "Next.js": ("next.js", "nextjs"),
        "REST APIs": ("rest", "rest api", "restful", "restful api", "restful services"),
        "Machine Learning": ("machine learning", "ml"),
        "Google Cloud": ("google cloud", "gcp"),
        "scikit-learn": ("scikit-learn", "scikit learn", "sklearn"),
        "J2EE": ("j2ee", "java ee", "jakarta ee"),
        "CI/CD": ("ci/cd", "continuous integration", "continuous delivery", "continuous deployment"),
        "Spring": ("spring", "spring boot", "spring mvc"),
        "Agile": ("agile", "scrum"),
    }
    found: list[str] = []
    for skill in KNOWN_SKILLS:
        candidates = aliases.get(skill, (skill.lower(),))
        if any(f" {candidate.lower()} " in normalized for candidate in candidates):
            found.append(skill)
    return found


def extract_skills(skill_lines: list[str], complete_text: str) -> list[str]:
    source = "\n".join(skill_lines) if skill_lines else complete_text
    known = find_known_skills(source)
    explicit: list[str] = []
    for line in skill_lines:
        cleaned = re.sub(
            r"^(?:languages?|frameworks?|libraries|databases?|cloud(?: and devops)?|tools?|"
            r"technologies|methodologies|platforms?|web|frontend|backend|other)\s*:\s*",
            "", line, flags=re.IGNORECASE,
        )
        for item in re.split(r"[,|•·;]", cleaned):
            item = re.sub(r"\s+", " ", item).strip(" :-")
            if item and len(item) <= 40 and len(item.split()) <= 5:
                explicit.append(item)
    return list(dict.fromkeys([*explicit, *known]))


def parse_date_range(text: str) -> tuple[str, str]:
    date_pattern = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ .'-]*\d{4}|\b(?:19|20)\d{2}\b|Present|Current"
    dates = re.findall(date_pattern, text, flags=re.IGNORECASE)
    return (dates[0] if dates else "", dates[1] if len(dates) > 1 else "")


def looks_like_bullet(line: str) -> bool:
    return bool(re.match(r"^\s*[-•*▪●◦‣]", line)) or bool(
        re.match(r"^(?:developed|built|created|designed|implemented|managed|led|improved|reduced|"
                 r"increased|configured|conducted|performed|supported|collaborated|worked|used)\b", line, re.IGNORECASE)
    )


def looks_like_location(line: str) -> bool:
    return bool(re.search(US_STATE_PATTERN, line)) or bool(re.search(r"\bremote\b", line, re.IGNORECASE)) or (
        bool(re.search(r",\s*[A-Za-z]{2,}", line)) and len(line.split()) <= 6
    )


def remove_dates(line: str) -> str:
    date_token = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ .'-]*\d{4}|\b(?:19|20)\d{2}\b|Present|Current"
    cleaned = re.sub(date_token, "", line, flags=re.IGNORECASE)
    return re.sub(r"^[\s|·,–—-]+|[\s|·,–—-]+$", "", cleaned).strip()


def split_dated_entries(lines: list[str]) -> list[tuple[list[str], str, str]]:
    date_rows = [(index, *parse_date_range(line)) for index, line in enumerate(lines)]
    date_rows = [row for row in date_rows if row[1]]
    if not date_rows:
        return [(lines, "", "")] if lines else []
    entry_starts: list[int] = []
    for date_index, _, _ in date_rows:
        header_start = date_index
        cursor = date_index - 1
        header_count = 0
        while cursor >= 0 and header_count < 3 and not looks_like_bullet(lines[cursor]) and not parse_date_range(lines[cursor])[0]:
            header_start = cursor
            header_count += 1
            cursor -= 1
        entry_starts.append(header_start)

    entries: list[tuple[list[str], str, str]] = []
    for position, (date_index, start, end) in enumerate(date_rows):
        entry_start = entry_starts[position]
        entry_end = entry_starts[position + 1] if position + 1 < len(entry_starts) else len(lines)
        entry_lines = list(lines[entry_start:entry_end])
        relative_date_index = date_index - entry_start
        if 0 <= relative_date_index < len(entry_lines):
            remaining = remove_dates(entry_lines[relative_date_index])
            entry_lines[relative_date_index:relative_date_index + 1] = [remaining] if remaining else []
        entries.append(([line for line in entry_lines if line], start, end))
    return entries


def split_header_parts(lines: list[str]) -> list[str]:
    parts: list[str] = []
    for line in lines:
        if looks_like_bullet(line):
            break
        split = [part.strip() for part in re.split(r"\s+(?:\||·|@)\s+", line) if part.strip()]
        parts.extend(split or [line])
        if len(parts) >= 6:
            break
    return parts


def parse_experience_entry(lines: list[str], start: str, end: str, index: int) -> dict:
    parts = split_header_parts(lines)
    title = next((part for part in parts if any(word in part.lower() for word in TITLE_WORDS)), "")
    location = next((part for part in parts if part != title and looks_like_location(part)), "")
    company = next((part for part in parts if part not in {title, location} and len(part) < 100), "")
    if not title and parts:
        title = parts[0]
    if not company and len(parts) > 1:
        company = next((part for part in parts[1:] if part not in {title, location}), "")
    used_headers = {value for value in (title, company, location) if value}
    description_lines = [line for line in lines if line not in used_headers and not looks_like_location(line)]
    return {
        "id": f"uploaded-experience-{index}", "title": title, "company": company,
        "location": location, "startDate": start, "endDate": end,
        "description": "\n".join(description_lines).strip(),
    }


def parse_education_entry(lines: list[str], start: str, end: str, index: int) -> dict:
    parts = split_header_parts(lines)
    degree = next((part for part in parts if DEGREE_PATTERN.search(part)), "")
    school = next((part for part in parts if any(word in part.lower() for word in SCHOOL_WORDS)), "")
    location = next((part for part in parts if part not in {degree, school} and looks_like_location(part)), "")
    if not degree and parts:
        degree = parts[0]
    if not school:
        school = next((part for part in parts if part not in {degree, location}), "")
    excluded = {value for value in (degree, school, location) if value}
    details = [part for part in parts if part not in excluded]
    return {
        "id": f"uploaded-education-{index}", "degree": degree, "school": school,
        "location": location, "graduationDate": end or start, "details": " | ".join(details),
    }


def parse_resume_text(text: str) -> dict:
    header, sections = split_resume_sections(text)
    email_match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
    phone_match = re.search(r"(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}", text)
    linkedin_match = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w%./-]+", text, re.IGNORECASE)
    urls = re.findall(r"(?:https?://)?(?:www\.)?(?:github\.com|[\w-]+\.(?:dev|io|me))/[\w%./-]+", text, re.IGNORECASE)
    excluded = re.compile(r"@|https?://|linkedin|github|\d{3}.*\d{3}.*\d{4}", re.IGNORECASE)
    header_parts = [
        part.strip() for line in header[:15]
        for part in re.split(r"\s+(?:\||•|·)\s+", line)
        if part.strip()
    ]
    name_candidates = [
        part for part in header_parts
        if 1 < len(part.split()) <= 6
        and not excluded.search(part)
        and not looks_like_location(part)
        and not any(word in part.lower() for word in TITLE_WORDS)
        and not DEGREE_PATTERN.search(part)
        and len(part) < 70
    ]
    name = name_candidates[0] if name_candidates else ""
    location = next((part for part in header_parts if part != name and not excluded.search(part) and looks_like_location(part)), "")

    skill_lines = sections["skills"]
    skills = extract_skills(skill_lines, text)

    experience_lines = sections["experience"]
    experience = [
        parse_experience_entry(lines, start, end, index)
        for index, (lines, start, end) in enumerate(split_dated_entries(experience_lines), start=1)
    ] or [{
        "id": "uploaded-experience-1", "title": "", "company": "", "location": "",
        "startDate": "", "endDate": "", "description": "",
    }]

    education_lines = sections["education"]
    education = [
        parse_education_entry(lines, start, end, index)
        for index, (lines, start, end) in enumerate(split_dated_entries(education_lines), start=1)
    ] or [{
        "id": "uploaded-education-1", "degree": "", "school": "", "location": "",
        "graduationDate": "", "details": "",
    }]

    project_lines = sections["projects"]
    projects = [{
        "id": "uploaded-project-1", "name": project_lines[0] if project_lines else "",
        "technologies": "", "description": "\n".join(project_lines[1:]), "link": "",
    }]
    return {
        "fullName": name,
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
        "location": location,
        "linkedIn": linkedin_match.group(0) if linkedin_match else "",
        "portfolio": urls[0] if urls else "",
        "summary": " ".join(sections["summary"]),
        "skills": ", ".join(skills),
        "experience": experience,
        "education": education,
        "projects": projects,
        "certifications": " | ".join(sections["certifications"]),
    }


def parsing_warnings(resume: dict, text: str) -> list[str]:
    warnings: list[str] = []
    if not resume["fullName"]:
        warnings.append("Name was not detected.")
    if not resume["email"]:
        warnings.append("Email was not detected.")
    if not resume["phone"]:
        warnings.append("Phone number was not detected.")
    if not resume["summary"]:
        warnings.append("A summary section was not detected.")
    if not resume["skills"]:
        warnings.append("A skills section was not detected.")
    if not any(item["title"] or item["company"] for item in resume["experience"]):
        warnings.append("Experience entries require manual review.")
    if not any(item["degree"] or item["school"] for item in resume["education"]):
        warnings.append("Education entries require manual review.")
    if "�" in text:
        warnings.append("The PDF contains characters that could not be decoded.")
    return warnings


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The resume must be smaller than 5 MB.")
    text, extraction_method = extract_uploaded_text(file.filename or "resume", content)
    if len(text.strip()) < 40:
        raise HTTPException(status_code=422, detail="Very little text was found. Scanned/image-only PDFs are not supported yet.")
    resume = parse_resume_text(text)
    return {
        "resume": resume,
        "characters_extracted": len(text),
        "filename": file.filename,
        "extraction_method": extraction_method,
        "warnings": parsing_warnings(resume, text),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    requirements = extract_requirements(payload.job_description)
    section_texts = [section.text for section in payload.sections]
    model = get_model()
    requirement_embeddings = model.encode(requirements, normalize_embeddings=True)
    section_embeddings = model.encode(section_texts, normalize_embeddings=True)
    similarity_matrix = requirement_embeddings @ section_embeddings.T

    matches: list[RequirementMatch] = []
    best_scores: list[float] = []
    for index, requirement in enumerate(requirements):
        best_index = int(similarity_matrix[index].argmax())
        raw_score = max(0.0, min(1.0, float(similarity_matrix[index][best_index])))
        best_scores.append(raw_score)
        score = round(raw_score * 100)
        status = "matched" if raw_score >= 0.55 else "partial" if raw_score >= 0.35 else "missing"
        matches.append(RequirementMatch(
            requirement=requirement,
            best_section=payload.sections[best_index].label,
            score=score,
            status=status,
        ))

    semantic_similarity = round(sum(best_scores) / len(best_scores) * 100)
    bm25 = bm25_similarity(requirements, section_texts)
    requirement_coverage = round(sum(score >= 0.45 for score in best_scores) / len(best_scores) * 100)
    keywords = keyword_coverage(payload.resume_text, payload.job_description)
    content_similarity = round(semantic_similarity * 0.60 + keywords * 0.25 + requirement_coverage * 0.15)
    experience = experience_match(payload.resume_text, payload.job_description, payload.sections)
    education = education_match(payload.job_description, payload.sections)

    return AnalyzeResponse(
        content_similarity=content_similarity,
        semantic_similarity=semantic_similarity,
        bm25_similarity=bm25,
        keyword_coverage=keywords,
        requirement_coverage=requirement_coverage,
        experience_match=experience,
        education_match=education,
        requirement_matches=sorted(matches, key=lambda item: item.score, reverse=True),
        model=MODEL_NAME.split("/")[-1],
    )
