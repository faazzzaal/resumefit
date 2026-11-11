"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, BriefcaseBusiness, Check, ChevronLeft, Copy, Download, FileText, GraduationCap, Lightbulb, LoaderCircle, LockKeyhole, Mail, Plus, Printer, RotateCcw, Save, Sparkles, Target, Trash2, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Experience = { id: string; title: string; company: string; location: string; startDate: string; endDate: string; description: string };
type Education = { id: string; degree: string; school: string; location: string; graduationDate: string; details: string };
type Project = { id: string; name: string; technologies: string; description: string; link: string };
type ResumeData = {
  fullName: string; email: string; phone: string; location: string; linkedIn: string; portfolio: string;
  summary: string; skills: string; experience: Experience[]; education: Education[]; projects: Project[]; certifications: string;
};

type AnalysisResult = {
  overallScore: number;
  atsScore: number;
  semanticScore: number;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  recommendations: string[];
  courses: { skill: string; title: string }[];
  analysisMethod: string;
  modelScores: { model: string; score: number; description: string }[];
  requirementMatches: { requirement: string; best_section: string; score: number; status: "matched" | "partial" | "missing" }[];
};

type SemanticResponse = {
  content_similarity: number;
  semantic_similarity: number;
  bm25_similarity: number;
  keyword_coverage: number;
  requirement_coverage: number;
  experience_match: number;
  education_match: number;
  requirement_matches: AnalysisResult["requirementMatches"];
  model: string;
};

const SKILL_ALIASES: { name: string; terms: string[] }[] = [
  { name: "Python", terms: ["python"] }, { name: "Java", terms: ["java"] }, { name: "JavaScript", terms: ["javascript", "js"] },
  { name: "J2EE", terms: ["j2ee", "java ee", "jakarta ee"] },
  { name: "TypeScript", terms: ["typescript"] }, { name: "C++", terms: ["c++", "cpp"] }, { name: "C#", terms: ["c#", "c sharp"] },
  { name: "React", terms: ["react", "reactjs", "react.js"] }, { name: "Angular", terms: ["angular"] }, { name: "Vue.js", terms: ["vue", "vue.js"] },
  { name: "Node.js", terms: ["node", "nodejs", "node.js"] }, { name: "Next.js", terms: ["nextjs", "next.js"] }, { name: "Django", terms: ["django"] },
  { name: "Flask", terms: ["flask"] }, { name: "FastAPI", terms: ["fastapi"] }, { name: ".NET", terms: [".net", "dotnet"] },
  { name: "Spring", terms: ["spring", "spring boot", "spring mvc", "spring framework"] }, { name: "Hibernate", terms: ["hibernate", "hibernate orm"] },
  { name: "Maven", terms: ["maven"] }, { name: "Jenkins", terms: ["jenkins"] }, { name: "JUnit", terms: ["junit", "junit 5"] },
  { name: "SOAP", terms: ["soap", "soap web services", "wsdl"] },
  { name: "SQL", terms: ["sql"] }, { name: "PostgreSQL", terms: ["postgresql", "postgres"] }, { name: "MySQL", terms: ["mysql"] },
  { name: "Oracle", terms: ["oracle"] }, { name: "MongoDB", terms: ["mongodb", "mongo"] }, { name: "Snowflake", terms: ["snowflake"] },
  { name: "AWS", terms: ["aws", "amazon web services"] }, { name: "Azure", terms: ["azure"] }, { name: "Google Cloud", terms: ["gcp", "google cloud"] },
  { name: "Docker", terms: ["docker"] }, { name: "Kubernetes", terms: ["kubernetes", "k8s"] }, { name: "Git", terms: ["git", "github", "gitlab"] },
  { name: "REST APIs", terms: ["rest api", "restful", "rest APIs"] }, { name: "GraphQL", terms: ["graphql"] }, { name: "Microservices", terms: ["microservices", "microservice"] },
  { name: "Machine Learning", terms: ["machine learning", "ml"] }, { name: "Deep Learning", terms: ["deep learning"] }, { name: "NLP", terms: ["nlp", "natural language processing"] },
  { name: "BERT", terms: ["bert", "sentence-bert", "sbert"] }, { name: "PyTorch", terms: ["pytorch"] }, { name: "TensorFlow", terms: ["tensorflow"] },
  { name: "scikit-learn", terms: ["scikit-learn", "sklearn"] }, { name: "Pandas", terms: ["pandas"] }, { name: "NumPy", terms: ["numpy"] },
  { name: "Power BI", terms: ["power bi", "powerbi"] }, { name: "Tableau", terms: ["tableau"] }, { name: "Spark", terms: ["apache spark", "pyspark", "spark"] },
  { name: "Kafka", terms: ["kafka"] }, { name: "Airflow", terms: ["airflow"] }, { name: "CI/CD", terms: ["ci/cd", "continuous integration", "continuous deployment"] },
  { name: "Agile", terms: ["agile", "scrum"] }, { name: "Linux", terms: ["linux", "unix"] }, { name: "Data Structures", terms: ["data structures", "algorithms"] },
];

const STOP_WORDS = new Set("a an and are as at be by for from has have in into is it its of on or our that the their this to using was we will with you your required preferred responsibilities qualifications experience years work working strong knowledge ability including develop development role team".split(" "));

function resumeToText(resume: ResumeData) {
  return [resume.fullName, resume.summary, resume.skills, resume.certifications,
    ...resume.experience.flatMap((item) => [item.title, item.company, item.location, item.startDate, item.endDate, item.description]),
    ...resume.education.flatMap((item) => [item.degree, item.school, item.details]),
    ...resume.projects.flatMap((item) => [item.name, item.technologies, item.description]),
  ].join(" ");
}

function containsTerm(text: string, term: string) {
  const normalizedText = ` ${text.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ")} `;
  const normalizedTerm = term.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
  return normalizedText.includes(` ${normalizedTerm} `);
}

function extractSkills(text: string) {
  return SKILL_ALIASES.filter((skill) => skill.terms.some((term) => containsTerm(text, term))).map((skill) => skill.name);
}

function tokens(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function tfIdfSimilarity(first: string, second: string) {
  const documents = [tokens(first), tokens(second)];
  const vocabulary = [...new Set(documents.flat())];
  const vectors = documents.map((document) => {
    const counts = new Map<string, number>(); document.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
    return vocabulary.map((word) => {
      const tf = (counts.get(word) || 0) / Math.max(document.length, 1);
      const documentFrequency = documents.filter((doc) => doc.includes(word)).length;
      return tf * (Math.log((documents.length + 1) / (documentFrequency + 1)) + 1);
    });
  });
  const dot = vectors[0].reduce((sum, value, index) => sum + value * vectors[1][index], 0);
  const magnitude = (vector: number[]) => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  const denominator = magnitude(vectors[0]) * magnitude(vectors[1]);
  return denominator ? Math.round((dot / denominator) * 100) : 0;
}

function calculateAtsScore(resume: ResumeData) {
  const text = resumeToText(resume);
  const wordCount = tokens(text).length;
  let score = 0;
  if (resume.email) score += 5; if (resume.phone) score += 5; if (resume.summary.trim().length >= 40) score += 10;
  if (resume.skills.split(",").filter(Boolean).length >= 5) score += 15;
  if (resume.experience.some((item) => item.title && item.company && item.description)) score += 20;
  if (resume.education.some((item) => item.degree && item.school)) score += 10;
  if (resume.projects.some((item) => item.name && item.description)) score += 10;
  if (/\b(built|created|developed|designed|implemented|improved|led|managed|optimized|reduced|increased|delivered|analyzed)\b/i.test(text)) score += 10;
  if (/\b\d+(?:\.\d+)?%|\b\d+[kKmM+]\b|\b\d+\s*(users|records|projects|clients|hours|days)\b/.test(text)) score += 10;
  if (resume.linkedIn || resume.portfolio) score += 5;
  if (wordCount >= 120 && wordCount <= 900) score += 5;
  return Math.min(score, 100);
}

function parseMonth(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/present|current/.test(normalized)) return new Date();
  const parsed = new Date(value.includes(" ") ? `1 ${value}` : `1 Jan ${value}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateExperienceMatch(resume: ResumeData, jobDescription: string) {
  const requiredYears = extractYearValues(jobDescription);
  if (!requiredYears.length) return 100;
  let datedMonths = 0;
  for (const item of resume.experience) {
    const start = parseMonth(item.startDate); const end = parseMonth(item.endDate);
    if (start && end && end >= start) datedMonths += (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  }
  const explicitYears = extractYearValues(resumeToText(resume));
  const candidateYears = Math.max(datedMonths / 12, ...explicitYears, 0);
  return Math.round(Math.min(1, candidateYears / Math.max(...requiredYears)) * 100);
}

function extractYearValues(text: string) {
  const wordValues: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20,
  };
  const numeric = [...text.matchAll(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi)].map((match) => Number(match[1]));
  const words = [...text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*\+?\s*(?:years?|yrs?)\b/gi)].map((match) => wordValues[match[1].toLowerCase()]);
  return [...numeric, ...words];
}

function calculateEducationMatch(resume: ResumeData, jobDescription: string) {
  if (!/bachelor|master|degree|computer science|engineering/i.test(jobDescription)) return 100;
  const educationText = resume.education.map((item) => `${item.degree} ${item.school} ${item.details}`).join(" ");
  const hasDegree = /bachelor|master|b\.?s\.?|m\.?s\.?|engineering/i.test(educationText);
  const hasField = /computer science|information technology|software|engineering/i.test(educationText);
  return hasDegree && hasField ? 100 : hasDegree ? 65 : 0;
}

function courseForSkill(skill: string) {
  const courses: Record<string, string> = {
    AWS: "AWS Cloud Practitioner Essentials", Azure: "Microsoft Azure Fundamentals", Docker: "Docker Foundations Professional Certificate",
    Kubernetes: "Introduction to Kubernetes", Python: "Python for Everybody", SQL: "Advanced SQL for Data Professionals",
    React: "Meta Front-End Developer", "Machine Learning": "Machine Learning Specialization", NLP: "Natural Language Processing Specialization",
    Snowflake: "Snowflake Hands-On Essentials", "Power BI": "Microsoft Power BI Data Analyst", Java: "Java Programming and Software Engineering Fundamentals",
  };
  return courses[skill] || `${skill} Fundamentals`;
}

function analyzeResume(resume: ResumeData, jobDescription: string): AnalysisResult {
  const resumeText = resumeToText(resume);
  const jobSkills = extractSkills(jobDescription);
  const resumeSkills = extractSkills(resumeText);
  const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));
  const semanticScore = tfIdfSimilarity(resumeText, jobDescription);
  const skillScore = jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 100) : semanticScore;
  const atsScore = calculateAtsScore(resume);
  const experienceScore = calculateExperienceMatch(resume, jobDescription);
  const educationScore = calculateEducationMatch(resume, jobDescription);
  const frequency = new Map<string, number>(); tokens(jobDescription).forEach((word) => frequency.set(word, (frequency.get(word) || 0) + 1));
  const importantKeywords = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([word]) => word);
  const resumeTokens = new Set(tokens(resumeText));
  const matchedKeywords = importantKeywords.filter((word) => resumeTokens.has(word)).slice(0, 10);
  const overallScore = Math.round(skillScore * 0.35 + semanticScore * 0.35 + experienceScore * 0.20 + educationScore * 0.10);
  const recommendations: string[] = [];
  if (missingSkills.length) recommendations.push(`Add these skills only if you genuinely have them: ${missingSkills.slice(0, 6).join(", ")}.`);
  if (!/\b\d+(?:\.\d+)?%|\b\d+[kKmM+]\b/.test(resumeText)) recommendations.push("Add measurable results, such as percentages, users served, records processed, or time saved.");
  if (resume.summary.trim().length < 40) recommendations.push("Add a 2–3 sentence professional summary tailored to the target role.");
  if (!/\b(built|created|developed|implemented|improved|led|optimized|reduced|increased)\b/i.test(resumeText)) recommendations.push("Begin experience bullets with strong action verbs such as Developed, Built, Improved, or Led.");
  if (experienceScore < 100) recommendations.push("Clarify how many years you used the required technologies; total employment duration alone does not prove skill-specific experience.");
  if (educationScore < 100) recommendations.push("State the complete degree title and field of study so the education requirement can be verified.");
  if (semanticScore < 55) recommendations.push("Rewrite relevant experience bullets using terminology from the job description without copying full sentences.");
  if (atsScore < 75) recommendations.push("Complete the missing resume sections and keep headings simple for better ATS readability.");
  if (!recommendations.length) recommendations.push("Your resume is well aligned. Review wording and verify every claim before applying.");
  return {
    overallScore, atsScore, semanticScore, skillScore, experienceScore, educationScore, matchedSkills, missingSkills, matchedKeywords,
    recommendations: recommendations.slice(0, 5),
    courses: missingSkills.slice(0, 4).map((skill) => ({ skill, title: courseForSkill(skill) })),
    analysisMethod: "TF-IDF fallback",
    modelScores: [{ model: "TF-IDF + Cosine", score: semanticScore, description: "Lexical baseline" }],
    requirementMatches: [],
  };
}

function resumeSections(resume: ResumeData) {
  const sections = [
    { label: "Professional summary", text: resume.summary },
    { label: "Skills", text: resume.skills },
    ...resume.experience.flatMap((item, index) => {
      const heading = [item.title, item.company, item.startDate, item.endDate].filter(Boolean).join(". ");
      const bullets = item.description.split(/\n+/).map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
      return bullets.length
        ? bullets.map((bullet, bulletIndex) => ({ label: `Experience ${index + 1}, bullet ${bulletIndex + 1}: ${item.title || item.company || "Position"}`, text: `${heading}. ${bullet}` }))
        : [{ label: `Experience ${index + 1}: ${item.title || item.company || "Position"}`, text: heading }];
    }),
    ...resume.projects.map((item, index) => ({ label: `Project ${index + 1}: ${item.name || "Project"}`, text: [item.name, item.technologies, item.description].filter(Boolean).join(". ") })),
    ...resume.education.map((item, index) => ({ label: `Education ${index + 1}`, text: [item.degree, item.school, item.details].filter(Boolean).join(". ") })),
    { label: "Certifications", text: resume.certifications },
  ];
  return sections.filter((section) => section.text.trim().length > 0);
}

function joinNatural(values: string[]) {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function strongestEvidence(resume: ResumeData, matchedSkills: string[]) {
  const candidates = [
    ...resume.experience.flatMap((item) => item.description.split(/\n+/)),
    ...resume.projects.flatMap((item) => [item.description]),
  ].map((line) => line.replace(/^[-•]\s*/, "").trim()).filter((line) => line.length >= 25);
  const ranked = candidates.map((line) => {
    const skillMatches = matchedSkills.filter((skill) => containsTerm(line, skill)).length;
    const measurable = /\b\d+(?:\.\d+)?%|\b\d+[kKmM+]?\b/.test(line) ? 3 : 0;
    const action = /\b(developed|built|created|implemented|improved|designed|led|optimized|reduced|increased)\b/i.test(line) ? 2 : 0;
    return { line, score: skillMatches * 5 + measurable + action };
  }).sort((a, b) => b.score - a.score || b.line.length - a.line.length);
  return ranked.slice(0, 2).map((item) => item.line.replace(/[.;]+$/, ""));
}

function generateCoverLetterText(resume: ResumeData, analysis: AnalysisResult, company: string, role: string, manager: string) {
  const greeting = manager.trim() ? `Dear ${manager.trim()},` : "Dear Hiring Manager,";
  const skills = analysis.matchedSkills.slice(0, 4);
  const skillsText = joinNatural(skills);
  const currentRole = resume.experience.find((item) => item.title || item.company || item.description);
  const evidence = strongestEvidence(resume, skills);
  const degree = resume.education.find((item) => item.degree)?.degree;
  const organization = company.trim();
  const targetRole = role.trim();

  const introduction = skillsText
    ? `I am writing to apply for the ${targetRole} position at ${organization}. My background in ${skillsText} aligns with the technical requirements of this opportunity.`
    : `I am writing to apply for the ${targetRole} position at ${organization}. I am interested in bringing my professional experience and problem-solving abilities to this opportunity.`;

  const roleContext = currentRole
    ? `In my role as ${currentRole.title || "a software professional"}${currentRole.company ? ` at ${currentRole.company}` : ""}, `
    : "In my recent work, ";
  const evidenceSentence = evidence.length
    ? `${roleContext}${evidence[0].charAt(0).toLowerCase()}${evidence[0].slice(1)}.${evidence[1] ? ` I also ${evidence[1].charAt(0).toLowerCase()}${evidence[1].slice(1)}.` : ""}`
    : `${roleContext}I have developed practical experience collaborating with teams, solving technical problems, and delivering reliable work.`;

  const qualification = degree
    ? `My ${degree} and hands-on experience have prepared me to learn quickly, communicate effectively, and contribute to the responsibilities described for this role.`
    : "My hands-on experience has prepared me to learn quickly, communicate effectively, and contribute to the responsibilities described for this role.";
  const alignment = skillsText
    ? `I would welcome the opportunity to apply my experience with ${skillsText} while continuing to grow with ${organization}.`
    : `I would welcome the opportunity to contribute my experience while continuing to grow with ${organization}.`;

  return [
    greeting,
    "",
    introduction,
    "",
    evidenceSentence,
    "",
    `${qualification} ${alignment}`,
    "",
    "Thank you for considering my application. I would appreciate the opportunity to discuss how my background can support your team.",
    "",
    "Sincerely,",
    resume.fullName || "Candidate",
  ].join("\n");
}

function downloadCoverLetter(text: string, candidateName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${candidateName.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "candidate"}-cover-letter.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function printCoverLetter(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><head><title>Cover Letter</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:56px auto;padding:0 28px;color:#172033;font-size:12pt;line-height:1.65;white-space:pre-wrap}@media print{body{margin:0 auto}}</style></head><body>${escaped}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const printWindow = window.open(url, "_blank");
  if (!printWindow) { URL.revokeObjectURL(url); return false; }
  printWindow.addEventListener("load", () => { printWindow.print(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); });
  return true;
}

const STORAGE_KEY = "resumefit.resume-draft.v1";
const newExperience = (): Experience => ({ id: crypto.randomUUID(), title: "", company: "", location: "", startDate: "", endDate: "", description: "" });
const newEducation = (): Education => ({ id: crypto.randomUUID(), degree: "", school: "", location: "", graduationDate: "", details: "" });
const newProject = (): Project => ({ id: crypto.randomUUID(), name: "", technologies: "", description: "", link: "" });
const emptyResume = (): ResumeData => ({
  fullName: "", email: "", phone: "", location: "", linkedIn: "", portfolio: "", summary: "", skills: "",
  experience: [newExperience()], education: [newEducation()], projects: [newProject()], certifications: "",
});

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="mb-5 flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#176B87]">{icon}</div><div><h2 className="text-xl font-semibold tracking-tight text-[#102A43]">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>{children}</div>;
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="border-b border-slate-400 pb-1 text-[13px] font-bold uppercase tracking-[0.16em] text-[#173B67]">{title}</h2><div className="mt-3">{children}</div></section>;
}

function ResumePreview({ resume }: { resume: ResumeData }) {
  const experience = resume.experience.filter((item) => item.title || item.company || item.description);
  const education = resume.education.filter((item) => item.degree || item.school || item.details);
  const projects = resume.projects.filter((item) => item.name || item.description || item.technologies);
  const contact = [resume.email, resume.phone, resume.location, resume.linkedIn, resume.portfolio].filter(Boolean);
  const skills = resume.skills.split(",").map((skill) => skill.trim()).filter(Boolean);

  return <article id="resume-preview" className="mx-auto min-h-[1056px] max-w-[816px] bg-white px-9 py-11 text-[13px] leading-[1.45] text-slate-800 shadow-[0_18px_60px_rgba(15,42,67,0.13)] sm:px-14">
    <header className="text-center">
      <h1 className="text-3xl font-bold uppercase tracking-[0.04em] text-[#102A43]">{resume.fullName}</h1>
      {contact.length > 0 && <p className="mt-2 text-[12px] text-slate-600">{contact.join("  •  ")}</p>}
    </header>

    {resume.summary.trim() && <ResumeSection title="Professional Summary"><p>{resume.summary}</p></ResumeSection>}
    {skills.length > 0 && <ResumeSection title="Skills"><p>{skills.join("  •  ")}</p></ResumeSection>}

    {experience.length > 0 && <ResumeSection title="Experience"><div className="space-y-4">{experience.map((item) => <div key={item.id}>
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-bold text-slate-900">{item.title || "Position"}</h3><p className="font-medium">{[item.company, item.location].filter(Boolean).join(" · ")}</p></div><p className="shrink-0 text-right text-[12px] text-slate-600">{[item.startDate, item.endDate].filter(Boolean).join(" – ")}</p></div>
      {item.description.trim() && <ul className="mt-1.5 list-disc space-y-1 pl-5">{item.description.split(/\n+/).filter(Boolean).map((line, index) => <li key={index}>{line.replace(/^[-•]\s*/, "")}</li>)}</ul>}
    </div>)}</div></ResumeSection>}

    {education.length > 0 && <ResumeSection title="Education"><div className="space-y-3">{education.map((item) => <div key={item.id}>
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-bold text-slate-900">{item.degree || "Degree"}</h3><p>{[item.school, item.location].filter(Boolean).join(" · ")}</p></div><p className="shrink-0 text-[12px] text-slate-600">{item.graduationDate}</p></div>{item.details && <p className="mt-1 text-slate-700">{item.details}</p>}
    </div>)}</div></ResumeSection>}

    {projects.length > 0 && <ResumeSection title="Projects"><div className="space-y-3">{projects.map((item) => <div key={item.id}>
      <div className="flex flex-wrap items-baseline gap-x-2"><h3 className="font-bold text-slate-900">{item.name || "Project"}</h3>{item.technologies && <span className="text-[12px] italic text-slate-600">{item.technologies}</span>}</div>{item.link && <p className="text-[12px] text-[#176B87]">{item.link}</p>}{item.description && <p className="mt-1">{item.description}</p>}
    </div>)}</div></ResumeSection>}

    {resume.certifications.trim() && <ResumeSection title="Certifications"><p>{resume.certifications}</p></ResumeSection>}
  </article>;
}

export default function Home() {
  const [resume, setResume] = useState<ResumeData>(() => emptyResume());
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showJobStep, setShowJobStep] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [error, setError] = useState("");
  const [entryMode, setEntryMode] = useState<"form" | "upload">("form");
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [coverLetterCompany, setCoverLetterCompany] = useState("");
  const [coverLetterRole, setCoverLetterRole] = useState("");
  const [coverLetterManager, setCoverLetterManager] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterNotice, setCoverLetterNotice] = useState("");

  useEffect(() => {
    try {
      const draft = window.localStorage.getItem(STORAGE_KEY);
      if (draft) setResume(JSON.parse(draft) as ResumeData);
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
    finally { setReady(true); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resume)), 300);
    return () => window.clearTimeout(timer);
  }, [ready, resume]);

  const update = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => { setResume((current) => ({ ...current, [key]: value })); setSaved(false); };
  const updateList = <T extends Experience | Education | Project>(key: "experience" | "education" | "projects", id: string, field: keyof T, value: string) => {
    setResume((current) => ({ ...current, [key]: (current[key] as T[]).map((item) => item.id === id ? { ...item, [field]: value } : item) }));
    setSaved(false);
  };
  const removeItem = (key: "experience" | "education" | "projects", id: string) => setResume((current) => ({ ...current, [key]: current[key].filter((item) => item.id !== id) }));
  const uploadResume = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError(""); setUploadNotice("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const formData = new FormData(); formData.append("file", file);
      const response = await fetch(`${apiUrl}/parse-resume`, { method: "POST", body: formData });
      const result = await response.json() as {
        resume?: ResumeData;
        detail?: string;
        characters_extracted?: number;
        extraction_method?: string;
        warnings?: string[];
      };
      if (!response.ok || !result.resume) throw new Error(result.detail || "The resume could not be processed.");
      setResume(result.resume); setSaved(false); setEntryMode("form");
      const warningText = result.warnings?.length
        ? ` Review needed: ${result.warnings.join(" ")}`
        : " All major sections were detected.";
      setUploadNotice(
        `${file.name} was read using ${result.extraction_method || "document extraction"}` +
        `${result.characters_extracted ? ` (${result.characters_extracted.toLocaleString()} characters)` : ""}.` +
        `${warningText} Please verify every field before generating the resume.`
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The resume could not be processed. Confirm that the Python backend is running.");
    } finally { setUploading(false); }
  };
  const saveResume = (event: FormEvent) => {
    event.preventDefault();
    if (!resume.fullName.trim() || !resume.email.trim() || !resume.skills.trim()) { setError("Please complete your name, email, and skills before continuing."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setError(""); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resume)); setSaved(true); setShowPreview(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const runAnalysis = async () => {
    if (jobDescription.trim().length < 80) return;
    setComparing(true);
    setAnalysisNotice("");
    setCoverLetter("");
    setCoverLetterNotice("");
    const baseline = analyzeResume(resume, jobDescription);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeToText(resume), job_description: jobDescription, sections: resumeSections(resume) }),
      });
      if (!response.ok) throw new Error("Semantic service returned an error.");
      const semantic = await response.json() as SemanticResponse;
      setAnalysis({
        ...baseline,
        semanticScore: semantic.content_similarity,
        experienceScore: semantic.experience_match,
        educationScore: semantic.education_match,
        overallScore: Math.round(baseline.skillScore * 0.35 + semantic.content_similarity * 0.35 + semantic.experience_match * 0.20 + semantic.education_match * 0.10),
        analysisMethod: `Sentence-BERT · ${semantic.model}`,
        modelScores: [
          { model: "TF-IDF + Cosine", score: baseline.semanticScore, description: "Lexical baseline" },
          { model: `Sentence-BERT · ${semantic.model}`, score: semantic.semantic_similarity, description: "Semantic similarity" },
          { model: "BM25", score: semantic.bm25_similarity, description: "Probabilistic keyword relevance" },
        ],
        requirementMatches: semantic.requirement_matches,
      });
    } catch {
      setAnalysis(baseline);
      setAnalysisNotice("Sentence-BERT backend was not available, so this result uses the TF-IDF fallback. Start the Python backend and compare again.");
    } finally {
      setComparing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const createCoverLetter = () => {
    if (!analysis) return;
    if (!coverLetterCompany.trim() || !coverLetterRole.trim()) {
      setCoverLetterNotice("Enter the company name and job title before generating the cover letter.");
      return;
    }
    setCoverLetter(generateCoverLetterText(resume, analysis, coverLetterCompany, coverLetterRole, coverLetterManager));
    setCoverLetterNotice("Generated from verified resume information and matched job skills. Review every claim before applying.");
  };

  if (!ready) return <main className="min-h-screen bg-background" />;

  return <main className="min-h-screen bg-[#F7FAFC] text-foreground">
    <header className="print-hidden sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173B67] text-white shadow-sm"><FileText className="h-5 w-5" /></div><div><p className="text-lg font-semibold tracking-[-0.025em]">ResumeFit</p><p className="text-xs text-slate-500">Career matching workspace</p></div></div>
        <div className="flex items-center gap-2 text-sm text-slate-500"><LockKeyhole className="h-4 w-4" /><span className="hidden sm:inline">Saved in this browser</span></div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="print-hidden mb-8 flex items-center gap-3" aria-label="Progress">
        {["Build resume", "Preview", "Add job", "Review match"].map((label, index) => { const currentStep = analysis ? 3 : showJobStep ? 2 : showPreview ? 1 : 0; const active = index <= currentStep; return <div key={label} className="flex flex-1 items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${active ? "bg-[#173B67] text-white" : "border border-slate-300 bg-white text-slate-500"}`}>{index + 1}</span><span className={`hidden text-sm font-medium md:inline ${active ? "text-[#102A43]" : "text-slate-400"}`}>{label}</span>{index < 3 && <span className="h-px flex-1 bg-slate-200" />}</div>; })}
      </div>

      {analysis ? <section className="mx-auto max-w-5xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold text-[#176B87]">STEP 4 OF 4</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-[#102A43]">Your match results</h1><p className="mt-3 text-slate-600">Skills, semantic content alignment, requirement coverage, and ATS-readiness checks.</p></div>
          <Button type="button" variant="outline" onClick={() => setAnalysis(null)} className="rounded-xl"><ChevronLeft className="mr-2 h-4 w-4" />Edit job description</Button>
        </div>

        {analysisNotice && <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>{analysisNotice}</p></div>}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[{ label: "Overall match", score: analysis.overallScore, note: "Job-fit result" }, { label: "Skills match", score: analysis.skillScore, note: "Explicit required skills" }, { label: "Content similarity", score: analysis.semanticScore, note: analysis.analysisMethod }, { label: "Experience match", score: analysis.experienceScore, note: "Required years" }, { label: "Education match", score: analysis.educationScore, note: "Degree requirement" }, { label: "ATS readiness", score: analysis.atsScore, note: "Formatting and completeness" }].map((item) => <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(#176B87 ${item.score * 3.6}deg, #E7EEF3 0deg)` }}><div className="grid h-19 w-19 place-items-center rounded-full bg-white text-2xl font-bold text-[#102A43]">{item.score}%</div></div>
            <p className="mt-4 text-center font-semibold text-[#102A43]">{item.label}</p><p className="mt-1 text-center text-xs text-slate-500">{item.note}</p>
          </div>)}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#176B87]"><Target className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold text-[#102A43]">Model comparison</h2><p className="text-sm text-slate-500">The same resume and job description evaluated by each matching model</p></div></div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_90px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[1fr_1fr_90px]"><span>Model</span><span className="hidden sm:block">Method</span><span className="text-right">Score</span></div>
            {analysis.modelScores.map((item) => <div key={item.model} className="grid grid-cols-[1fr_90px] items-center border-t border-slate-100 px-4 py-4 sm:grid-cols-[1fr_1fr_90px]"><div><p className="font-semibold text-[#102A43]">{item.model}</p><p className="mt-1 text-xs text-slate-500 sm:hidden">{item.description}</p></div><p className="hidden text-sm text-slate-600 sm:block">{item.description}</p><div className="text-right"><span className="inline-flex min-w-16 justify-center rounded-full bg-[#EAF4F7] px-3 py-1.5 font-bold text-[#176B87]">{item.score}%</span></div></div>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Model scores are shown separately because TF-IDF, Sentence-BERT, and BM25 use different matching methods. The overall job-fit score continues to use the validated scoring formula.</p>
        </div>

        {analysis.requirementMatches.length > 0 && <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold text-[#102A43]">Requirement-level semantic matches</h2><p className="text-sm text-slate-500">Sentence-BERT compares each job requirement with its closest resume section</p></div></div>
          <div className="mt-5 space-y-3">{analysis.requirementMatches.slice(0, 10).map((match, index) => <div key={`${match.requirement}-${index}`} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[1fr_150px_90px] sm:items-center">
            <div><p className="text-sm leading-6 text-slate-800">{match.requirement}</p><p className="mt-1 text-xs text-slate-500">Best resume section: {match.best_section}</p></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${match.status === "matched" ? "bg-emerald-500" : match.status === "partial" ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${match.score}%` }} /></div>
            <span className={`justify-self-start rounded-full px-2.5 py-1 text-xs font-semibold capitalize sm:justify-self-end ${match.status === "matched" ? "bg-emerald-50 text-emerald-800" : match.status === "partial" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{match.status} · {match.score}%</span>
          </div>)}</div>
        </div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold text-[#102A43]">Matched skills</h2><p className="text-sm text-slate-500">Skills detected in both documents</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2">{analysis.matchedSkills.length ? analysis.matchedSkills.map((skill) => <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">{skill}</span>) : <p className="text-sm text-slate-500">No recognized technical skills matched yet.</p>}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold text-[#102A43]">Missing skills</h2><p className="text-sm text-slate-500">Requirements not detected in your resume</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2">{analysis.missingSkills.length ? analysis.missingSkills.map((skill) => <span key={skill} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">{skill}</span>) : <p className="text-sm text-emerald-700">No recognized required skills are missing.</p>}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#176B87]"><Target className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold text-[#102A43]">Recommended changes</h2><p className="text-sm text-slate-500">Prioritized improvements for this job</p></div></div>
            <ol className="mt-5 space-y-4">{analysis.recommendations.map((recommendation, index) => <li key={recommendation} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#173B67] text-xs font-semibold text-white">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-slate-700">{recommendation}</p></li>)}</ol>
            {analysis.matchedKeywords.length > 0 && <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-[#102A43]">Job keywords already present</p><p className="mt-2 text-sm leading-6 text-slate-600">{analysis.matchedKeywords.join(" · ")}</p></div>}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-[#102A43] p-6 text-white shadow-sm">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-sky-200"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold">Suggested learning</h2><p className="text-sm text-slate-300">Courses based on skill gaps</p></div></div>
            <div className="mt-5 space-y-3">{analysis.courses.length ? analysis.courses.map((course) => <div key={course.skill} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10"><p className="text-xs font-semibold uppercase tracking-wide text-sky-200">{course.skill}</p><p className="mt-1 font-medium">{course.title}</p></div>) : <p className="text-sm leading-6 text-slate-300">No courses are required from the recognized skill list. Continue strengthening your existing skills.</p>}</div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Mail className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold text-[#102A43]">Tailored cover letter</h2><p className="text-sm text-slate-500">Template-based generation using matched skills and verified resume evidence - no generative AI or API key required</p></div></div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field label="Company name" required><Input value={coverLetterCompany} onChange={(event) => setCoverLetterCompany(event.target.value)} placeholder="ABC Technologies" className="rounded-xl" /></Field>
            <Field label="Job title" required><Input value={coverLetterRole} onChange={(event) => setCoverLetterRole(event.target.value)} placeholder="Java Software Engineer" className="rounded-xl" /></Field>
            <Field label="Hiring manager (optional)"><Input value={coverLetterManager} onChange={(event) => setCoverLetterManager(event.target.value)} placeholder="Ms. Johnson" className="rounded-xl" /></Field>
          </div>
          <Button type="button" onClick={createCoverLetter} className="mt-5 h-11 rounded-xl bg-violet-700 px-5 text-white hover:bg-violet-800"><Mail className="mr-2 h-4 w-4" />{coverLetter ? "Regenerate cover letter" : "Generate cover letter"}</Button>
          {coverLetterNotice && <p className={`mt-3 text-sm ${coverLetter ? "text-emerald-700" : "text-amber-700"}`}>{coverLetterNotice}</p>}
          {coverLetter && <div className="mt-5 border-t border-slate-100 pt-5">
            <Label htmlFor="cover-letter">Editable cover letter</Label>
            <Textarea id="cover-letter" value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} className="mt-2 min-h-96 resize-y rounded-xl font-serif leading-7" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(coverLetter); setCoverLetterNotice("Cover letter copied to the clipboard."); }} className="rounded-xl"><Copy className="mr-2 h-4 w-4" />Copy</Button>
              <Button type="button" variant="outline" onClick={() => downloadCoverLetter(coverLetter, resume.fullName)} className="rounded-xl"><Download className="mr-2 h-4 w-4" />Download text</Button>
              <Button type="button" variant="outline" onClick={() => { if (!printCoverLetter(coverLetter)) setCoverLetterNotice("Allow pop-ups, then try Print / Save PDF again."); }} className="rounded-xl"><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button>
              <span className="self-center text-xs text-slate-500">{coverLetter.trim().split(/\s+/).length} words</span>
            </div>
          </div>}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">Job fit uses skills (35%), semantic alignment (35%), experience (20%), and education (10%). ATS readiness is reported separately.</p><Button type="button" onClick={() => { setAnalysis(null); setShowJobStep(false); setShowPreview(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl bg-[#173B67] text-white hover:bg-[#102E50]"><RotateCcw className="mr-2 h-4 w-4" />Update resume</Button></div>
      </section> : showJobStep ? <section className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setShowJobStep(false)} className="mb-5 flex items-center gap-1 text-sm font-medium text-[#176B87] hover:underline"><ChevronLeft className="h-4 w-4" />Back to resume preview</button>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,42,67,0.08)] sm:p-9">
          {saved && <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><Check className="h-5 w-5" />Resume information saved.</div>}
          <p className="text-sm font-semibold text-[#176B87]">STEP 3 OF 4</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#102A43] sm:text-4xl">Add the job description</h1>
          <p className="mt-3 leading-7 text-slate-600">Paste the complete posting so ResumeFit can compare its requirements with your experience and skills.</p>
          <div className="mt-7 space-y-2"><Label htmlFor="job-description">Job description</Label><Textarea id="job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the responsibilities, required skills, and qualifications here…" className="min-h-72 resize-y rounded-xl" /></div>
          <Button type="button" onClick={runAnalysis} disabled={jobDescription.trim().length < 80 || comparing} className="mt-5 h-12 w-full rounded-xl bg-[#173B67] text-base text-white hover:bg-[#102E50]">{comparing ? <><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Running semantic analysis…</> : <>Compare resume and job<ArrowRight className="ml-2 h-5 w-5" /></>}</Button>
          <p className="mt-3 text-center text-sm text-slate-500">The first Sentence-BERT comparison may take longer while the model loads.</p>
        </div>
      </section> : showPreview ? <section className="print-resume-screen">
        <div className="print-hidden mx-auto mb-6 flex max-w-[816px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold text-[#176B87]">STEP 2 OF 4</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#102A43]">Your generated resume</h1><p className="mt-2 text-slate-600">Review the result before moving to job matching.</p></div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setShowPreview(false)} className="rounded-xl"><ChevronLeft className="mr-2 h-4 w-4" />Edit</Button><Button type="button" variant="outline" onClick={() => window.print()} className="rounded-xl"><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button></div>
        </div>
        <ResumePreview resume={resume} />
        <div className="print-hidden mx-auto mt-6 flex max-w-[816px] justify-end"><Button type="button" onClick={() => { setShowJobStep(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-12 rounded-xl bg-[#173B67] px-6 text-white hover:bg-[#102E50]">Continue to job description<ArrowRight className="ml-2 h-5 w-5" /></Button></div>
      </section> : <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="mb-7 max-w-3xl"><p className="mb-3 text-sm font-semibold text-[#176B87]">STEP 1 OF 4</p><h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-[#102A43] sm:text-5xl">Build or upload your resume</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">Complete the form manually or upload an existing resume to auto-fill the same editable fields.</p>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}{uploadNotice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-800">{uploadNotice}</p>}</div>
          <div className="mb-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <button type="button" onClick={() => setEntryMode("form")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${entryMode === "form" ? "bg-[#173B67] text-white" : "text-slate-600 hover:bg-slate-50"}`}><UserRound className="h-4 w-4" />Fill resume form</button>
            <button type="button" onClick={() => setEntryMode("upload")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${entryMode === "upload" ? "bg-[#173B67] text-white" : "text-slate-600 hover:bg-slate-50"}`}><Upload className="h-4 w-4" />Upload existing resume</button>
          </div>
          {entryMode === "upload" ? <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
            <SectionHeading icon={<Upload className="h-5 w-5" />} title="Upload your current resume" description="ResumeFit extracts the text and auto-fills the form for your review." />
            <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-[#176B87] hover:bg-sky-50/40">
              {uploading ? <LoaderCircle className="h-10 w-10 animate-spin text-[#176B87]" /> : <Upload className="h-10 w-10 text-[#176B87]" />}
              <span className="mt-4 text-lg font-semibold text-[#102A43]">{uploading ? "Reading your resume…" : "Choose a PDF, DOCX, or TXT resume"}</span>
              <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">Maximum file size: 5 MB. Text-based documents work best; scanned PDFs require OCR and are not supported in this version.</span>
              <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" disabled={uploading} onChange={(event) => { void uploadResume(event.target.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" />
            </label>
            <p className="mt-4 text-sm leading-6 text-slate-500">After extraction, you will return to the form where every detected field can be checked and edited before continuing.</p>
          </section> : <form onSubmit={saveResume} className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading icon={<UserRound className="h-5 w-5" />} title="Personal details" description="How employers can identify and contact you." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" required><Input value={resume.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Fazal Ur Rehman" /></Field><Field label="Email" required><Input type="email" value={resume.email} onChange={(e) => update("email", e.target.value)} placeholder="name@example.com" /></Field>
                <Field label="Phone"><Input type="tel" value={resume.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(409) 555-0123" /></Field><Field label="Location"><Input value={resume.location} onChange={(e) => update("location", e.target.value)} placeholder="Beaumont, TX" /></Field>
                <Field label="LinkedIn"><Input value={resume.linkedIn} onChange={(e) => update("linkedIn", e.target.value)} placeholder="linkedin.com/in/your-name" /></Field><Field label="Portfolio or GitHub"><Input value={resume.portfolio} onChange={(e) => update("portfolio", e.target.value)} placeholder="github.com/your-name" /></Field>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading icon={<Sparkles className="h-5 w-5" />} title="Professional profile" description="Summarize your strengths and list searchable skills." />
              <div className="space-y-5"><Field label="Professional summary"><Textarea value={resume.summary} onChange={(e) => update("summary", e.target.value)} placeholder="Graduate computer science student with experience building…" className="min-h-28" /></Field><Field label="Skills" required><Textarea value={resume.skills} onChange={(e) => update("skills", e.target.value)} placeholder="Python, React, SQL, machine learning, REST APIs" className="min-h-24" /><p className="text-xs text-slate-500">Separate skills with commas.</p></Field></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading icon={<BriefcaseBusiness className="h-5 w-5" />} title="Work experience" description="Add employment, internships, or relevant volunteer work." />
              <div className="space-y-5">{resume.experience.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between"><p className="font-semibold text-[#102A43]">Experience {index + 1}</p><button type="button" onClick={() => removeItem("experience", item.id)} disabled={resume.experience.length === 1} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-30" aria-label={`Remove experience ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Job title"><Input value={item.title} onChange={(e) => updateList<Experience>("experience", item.id, "title", e.target.value)} placeholder="Software Developer Intern" /></Field><Field label="Company"><Input value={item.company} onChange={(e) => updateList<Experience>("experience", item.id, "company", e.target.value)} placeholder="Company name" /></Field><Field label="Location"><Input value={item.location} onChange={(e) => updateList<Experience>("experience", item.id, "location", e.target.value)} placeholder="City, State or Remote" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Start"><Input value={item.startDate} onChange={(e) => updateList<Experience>("experience", item.id, "startDate", e.target.value)} placeholder="Jan 2025" /></Field><Field label="End"><Input value={item.endDate} onChange={(e) => updateList<Experience>("experience", item.id, "endDate", e.target.value)} placeholder="Present" /></Field></div><div className="sm:col-span-2"><Field label="Achievements and responsibilities"><Textarea value={item.description} onChange={(e) => updateList<Experience>("experience", item.id, "description", e.target.value)} placeholder="Built a dashboard that reduced reporting time by 30%…" className="min-h-24" /></Field></div></div>
              </div>)}</div><Button type="button" variant="outline" onClick={() => update("experience", [...resume.experience, newExperience()])} className="mt-4 rounded-xl"><Plus className="mr-2 h-4 w-4" />Add experience</Button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading icon={<GraduationCap className="h-5 w-5" />} title="Education" description="Include degrees, diplomas, and relevant coursework." />
              <div className="space-y-5">{resume.education.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between"><p className="font-semibold text-[#102A43]">Education {index + 1}</p><button type="button" onClick={() => removeItem("education", item.id)} disabled={resume.education.length === 1} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-30" aria-label={`Remove education ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Degree"><Input value={item.degree} onChange={(e) => updateList<Education>("education", item.id, "degree", e.target.value)} placeholder="M.S. Computer Science" /></Field><Field label="School"><Input value={item.school} onChange={(e) => updateList<Education>("education", item.id, "school", e.target.value)} placeholder="Lamar University" /></Field><Field label="Location"><Input value={item.location} onChange={(e) => updateList<Education>("education", item.id, "location", e.target.value)} placeholder="Beaumont, TX" /></Field><Field label="Graduation"><Input value={item.graduationDate} onChange={(e) => updateList<Education>("education", item.id, "graduationDate", e.target.value)} placeholder="May 2027" /></Field><div className="sm:col-span-2"><Field label="GPA, coursework, or honors"><Input value={item.details} onChange={(e) => updateList<Education>("education", item.id, "details", e.target.value)} placeholder="GPA 3.8 · Machine Learning · Database Systems" /></Field></div></div>
              </div>)}</div><Button type="button" variant="outline" onClick={() => update("education", [...resume.education, newEducation()])} className="mt-4 rounded-xl"><Plus className="mr-2 h-4 w-4" />Add education</Button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading icon={<Lightbulb className="h-5 w-5" />} title="Projects and certifications" description="Show practical work and additional qualifications." />
              <div className="space-y-5">{resume.projects.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between"><p className="font-semibold text-[#102A43]">Project {index + 1}</p><button type="button" onClick={() => removeItem("projects", item.id)} disabled={resume.projects.length === 1} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-30" aria-label={`Remove project ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Project name"><Input value={item.name} onChange={(e) => updateList<Project>("projects", item.id, "name", e.target.value)} placeholder="ResumeFit" /></Field><Field label="Technologies"><Input value={item.technologies} onChange={(e) => updateList<Project>("projects", item.id, "technologies", e.target.value)} placeholder="Next.js, Python, BERT" /></Field><Field label="Project link"><Input value={item.link} onChange={(e) => updateList<Project>("projects", item.id, "link", e.target.value)} placeholder="github.com/…" /></Field><div className="sm:col-span-2"><Field label="Description"><Textarea value={item.description} onChange={(e) => updateList<Project>("projects", item.id, "description", e.target.value)} placeholder="Describe what you built and the outcome…" className="min-h-24" /></Field></div></div>
              </div>)}</div><Button type="button" variant="outline" onClick={() => update("projects", [...resume.projects, newProject()])} className="mt-4 rounded-xl"><Plus className="mr-2 h-4 w-4" />Add project</Button><div className="mt-6"><Field label="Certifications"><Textarea value={resume.certifications} onChange={(e) => update("certifications", e.target.value)} placeholder="AWS Certified Cloud Practitioner, Google Data Analytics…" className="min-h-20" /></Field></div>
            </div>
            <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_16px_50px_rgba(15,42,67,0.16)] backdrop-blur sm:flex sm:items-center sm:justify-between"><div className="mb-3 flex items-center gap-2 text-sm text-slate-500 sm:mb-0"><Save className="h-4 w-4" />Draft saves automatically</div><Button type="submit" className="h-12 w-full rounded-xl bg-[#173B67] px-6 text-base text-white hover:bg-[#102E50] sm:w-auto">Generate resume<ArrowRight className="ml-2 h-5 w-5" /></Button></div>
          </form>}
        </section>
        <aside className="lg:pt-36"><div className="sticky top-28 rounded-3xl bg-[#102A43] p-6 text-white shadow-[0_20px_60px_rgba(16,42,67,0.18)]"><div className="flex items-center gap-2 text-sm font-medium text-sky-200"><Sparkles className="h-4 w-4" />Two ways to begin</div><ul className="mt-6 space-y-5 text-sm leading-6 text-slate-300"><li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><span><strong className="text-white">Start from scratch</strong><br />Enter structured information through the form.</span></li><li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><span><strong className="text-white">Use an existing resume</strong><br />Upload it and review the auto-filled information.</span></li><li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><span><strong className="text-white">Same analysis</strong><br />Both paths use ATS checks and Sentence-BERT matching.</span></li></ul></div></aside>
      </div>}
    </div>
  </main>;
}
