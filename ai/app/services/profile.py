"""Trích xuất `CandidateProfile` từ CV.

Chiến lược: LLM structured JSON (chất lượng cao) → nếu không có key/lỗi thì
fallback heuristic regex + từ điển kỹ năng. Kết quả cuối luôn được Pydantic
validate và bổ sung bằng heuristic để không bị trường rỗng.
"""

import re

from app.schemas import CandidateProfile
from app.services.llm_client import LlmClient
from app.services.skills import (
    detect_education_level,
    extract_skills,
    normalize_skill,
)
from app.services.text import mask_pii, mask_value
from app.settings import Settings

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)")
_YEARS_RE = re.compile(
    r"(\d{1,2}(?:[.,]\d)?)\s*(?:\+)?\s*(?:năm|nam|years?|yrs?)",
    re.IGNORECASE,
)
_ROLE_RE = re.compile(
    r"\b(engineer|developer|manager|designer|analyst|specialist|intern|leader|"
    r"architect|consultant|executive|director|tester|qa|devops|marketer|accountant|"
    r"chuyên viên|trưởng phòng|giám đốc|thực tập)\b",
    re.IGNORECASE,
)
_LANGUAGE_KEYWORDS = {
    "English": ("english", "tiếng anh", "toeic", "ielts"),
    "Japanese": ("japanese", "tiếng nhật", "jlpt"),
    "Chinese": ("chinese", "tiếng trung", "hsk"),
    "Korean": ("korean", "tiếng hàn", "topik"),
    "French": ("french", "tiếng pháp", "delf"),
}

SYSTEM_PROMPT = """Bạn là bộ trích xuất thông tin CV chuyên nghiệp cho hệ thống ATS.
Nhiệm vụ: Phân tích CV và trả về MỘT object JSON duy nhất, không markdown, không giải thích.

Nguyên tắc:
1. Nếu thông tin không có trong CV, hãy trả về null hoặc list rỗng. KHÔNG suy đoán.
2. Với `skills`: Chỉ liệt kê kỹ năng kỹ thuật, công cụ, ngôn ngữ lập trình, phần mềm chuyên dụng. Bỏ qua các kỹ năng mềm chung chung (ví dụ: "chăm chỉ", "trung thực"). Tên kỹ năng phải chuẩn hóa (ví dụ: "ReactJS", "PostgreSQL", "Docker").
3. Với `total_years_experience`: Tính toán dựa trên kinh nghiệm làm việc thực tế được liệt kê trong CV.
4. Với `full_name`: Tuyệt đối không lấy từ LLM (đã có bộ xử lý riêng), hãy để null.
5. Với `education_level`: Chỉ chọn 1 trong các giá trị: "doctorate", "master", "bachelor", "college", "certificate".

Schema:
{
  "skills": string[],
  "total_years_experience": number|null,
  "roles": string[],
  "education_level": string|null,
  "languages": string[],
  "summary": string|null
}"""


async def build_profile(
    raw_text: str,
    sections: dict[str, str],
    settings: Settings,
    llm: LlmClient,
) -> tuple[CandidateProfile, bool]:
    """Trả `(profile, llm_used)`."""
    heuristic = heuristic_profile(raw_text, sections)

    if not llm.available:
        return heuristic, False

    masked = mask_pii(raw_text)
    masked = mask_value(masked, heuristic.full_name)
    if len(masked) > settings.max_cv_chars:
        masked = masked[: settings.max_cv_chars]

    payload = await llm.complete_json(
        SYSTEM_PROMPT,
        f"Trích xuất thông tin từ CV sau:\n\n{masked}",
    )
    if not payload:
        return heuristic, False

    try:
        parsed = CandidateProfile.model_validate(
            {
                "skills": payload.get("skills") or [],
                "total_years_experience": payload.get("total_years_experience"),
                "roles": payload.get("roles") or [],
                "education_level": _normalize_education(payload.get("education_level")),
                "languages": payload.get("languages") or [],
                "summary": _clip(payload.get("summary"), 300),
                # PII lấy từ heuristic, không lấy từ LLM
                "full_name": heuristic.full_name,
                "email": heuristic.email,
                "phone": heuristic.phone,
            }
        )
    except Exception:
        return heuristic, False

    merged = _merge(parsed, heuristic)
    return merged, True


def heuristic_profile(raw_text: str, sections: dict[str, str]) -> CandidateProfile:
    skills_text = "\n".join(
        filter(None, [sections.get("skills", ""), raw_text])
    )
    skills = extract_skills(skills_text)

    experience_text = "\n".join(
        filter(None, [sections.get("experience", ""), sections.get("projects", "")])
    )
    roles = _extract_roles(experience_text or raw_text)

    return CandidateProfile(
        full_name=_guess_name(raw_text),
        email=_first_match(_EMAIL_RE, raw_text),
        phone=_first_match(_PHONE_RE, raw_text),
        skills=skills,
        total_years_experience=_extract_years(experience_text or raw_text),
        roles=roles,
        education_level=detect_education_level(raw_text),
        languages=_extract_languages(raw_text),
        summary=_clip(sections.get("summary"), 300),
    )


def _merge(primary: CandidateProfile, fallback: CandidateProfile) -> CandidateProfile:
    """LLM là nguồn chính; trường rỗng lấy từ heuristic."""
    return CandidateProfile(
        full_name=primary.full_name or fallback.full_name,
        email=primary.email or fallback.email,
        phone=primary.phone or fallback.phone,
        skills=_dedupe([*primary.skills, *fallback.skills]),
        total_years_experience=(
            primary.total_years_experience
            if primary.total_years_experience is not None
            else fallback.total_years_experience
        ),
        roles=_dedupe([*primary.roles, *fallback.roles])[:8],
        education_level=primary.education_level or fallback.education_level,
        languages=_dedupe([*primary.languages, *fallback.languages]),
        summary=primary.summary or fallback.summary,
    )


def _guess_name(raw_text: str) -> str | None:
    """Dòng đầu tiên giống tên người: 2-6 từ, không chứa email/số/ký tự đặc biệt."""
    for line in raw_text.split("\n")[:8]:
        candidate = line.strip()
        if not (2 <= len(candidate) <= 60):
            continue
        if _EMAIL_RE.search(candidate) or any(char.isdigit() for char in candidate):
            continue
        if any(token in candidate.lower() for token in ("cv", "resume", "curriculum")):
            continue
        words = candidate.split()
        if 2 <= len(words) <= 6 and all(re.search(r"[^\W\d_]", word) for word in words):
            return " ".join(words).title()
    return None


def _extract_years(text: str) -> float | None:
    values: list[float] = []
    for match in _YEARS_RE.finditer(text):
        try:
            value = float(match.group(1).replace(",", "."))
        except ValueError:
            continue
        if 0 <= value <= 60:
            values.append(value)
    return max(values) if values else None


def _extract_roles(text: str) -> list[str]:
    roles: list[str] = []
    seen: set[str] = set()

    for line in text.split("\n"):
        cleaned = line.strip(" -•\t")
        if not (3 <= len(cleaned) <= 100):
            continue
        if not _ROLE_RE.search(cleaned):
            continue
        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            roles.append(cleaned)
        if len(roles) >= 8:
            break

    return roles


def _extract_languages(text: str) -> list[str]:
    lower = text.lower()
    return [
        language
        for language, keywords in _LANGUAGE_KEYWORDS.items()
        if any(keyword in lower for keyword in keywords)
    ]


def _normalize_education(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    lowered = value.strip().lower()
    allowed = {"doctorate", "master", "bachelor", "college", "certificate"}
    return lowered if lowered in allowed else None


def _first_match(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    return match.group(0).strip() if match else None


def _clip(value: object, max_chars: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned[:max_chars] if cleaned else None


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if not isinstance(value, str) or not value.strip():
            continue
        canonical = normalize_skill(value)
        key = canonical.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(canonical)
    return result
