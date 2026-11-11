import unittest

from backend.app import clean_line, parse_resume_text


class ResumeParserTests(unittest.TestCase):
    def test_standard_java_resume(self) -> None:
        text = """Fazal Ur Rehman
fazal@gmail.com | 832-960-4560 | Houston, TX
PROFESSIONAL SUMMARY
Software engineer with four years of experience.
TECHNICAL SKILLS
Languages: Java, Python, JavaScript
Frameworks: Spring Boot, Hibernate, React
Tools: Maven, Jenkins, JUnit, Git
PROFESSIONAL EXPERIENCE
Associate Software Engineer
Clarivate | Bangalore, India
December 2020 - June 2026
- Developed Java and Spring Boot services.
- Built RESTful APIs and JUnit tests.
EDUCATION
M.S. Computer Science
Lamar University | Beaumont, TX
December 2026"""
        resume = parse_resume_text(text)
        self.assertEqual(resume["fullName"], "Fazal Ur Rehman")
        self.assertEqual(resume["location"], "Houston, TX")
        self.assertEqual(resume["experience"][0]["company"], "Clarivate")
        self.assertEqual(resume["experience"][0]["location"], "Bangalore, India")
        self.assertEqual(resume["education"][0]["school"], "Lamar University")
        self.assertIn("JUnit", resume["skills"])

    def test_alternative_headings_and_combined_header(self) -> None:
        text = """Akhil Janjirala
akhil@example.com
TECHNOLOGY STACK
Python | FastAPI | PostgreSQL | Docker
WORK HISTORY
Backend Developer | Example Corp | Remote
Jan 2023 - Present
Built REST APIs and deployed Docker services.
ACADEMIC QUALIFICATIONS
Bachelor of Engineering in Information Technology
Osmania University
2021"""
        resume = parse_resume_text(text)
        self.assertEqual(resume["experience"][0]["title"], "Backend Developer")
        self.assertEqual(resume["experience"][0]["company"], "Example Corp")
        self.assertEqual(resume["experience"][0]["location"], "Remote")
        self.assertIn("FastAPI", resume["skills"])

    def test_requirement_quantity_is_preserved(self) -> None:
        self.assertEqual(clean_line("5+ years of Java and J2EE"), "5+ years of Java and J2EE")
        self.assertEqual(clean_line("1. Experience with Spring Boot"), "Experience with Spring Boot")


if __name__ == "__main__":
    unittest.main()
