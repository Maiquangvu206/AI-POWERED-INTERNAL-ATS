"""Hybrid matching engine: 40% hard + 40% semantic + 20% tiêu chí phụ.

Công thức cố định, deterministic và có unit test — LLM **không** tham gia
chấm điểm để kết quả giải thích được và tái lập được.
"""

import re

from app.schemas import CandidateProfile, MatchBreakdown
from app.services.embedder import Embedder, cosine, lexical_cosine
from app.services.skills import extract_skills, jaccard, normalize_skill
from app.services.text import split_chunks
from app.settings import Settings

WEIGHTS = {"hard": 0.4, "semantic": 0.4, "extra": 0.2}

_JD_YEARS_RE = re.compile(
    r"(\d{1,2}(?:[.,]\d)?)\s*(?:\+)?\s*(?:năm|nam|years?|yrs?)",
    re.IGNORECASE,
)

_EDUCATION_RANK = {
    "certificate": 0.4,
    "college": 0.6,
    "bachelor": 0.8,
    "master": 0.95,
    "doctorate": 1.0,
}


def match(
    profile: CandidateProfile,
    jd_text: str,
    required_skills: list[str],
    experience_text: str,
    settings: Settings,
    embedder: Embedder,
) -> tuple[float, MatchBreakdown]:
    required = required_skills or extract_skills(jd_text)

    hard_score, matched, missing = jaccard(required, profile.skills)
    semantic_score, semantic_method = _semantic_score(
        experience_text or jd_text,
        jd_text,
        settings,
        embedder,
    )
    extra_score, extra_reason = _extra_score(profile, jd_text)

    total = (
        WEIGHTS["hard"] * hard_score
        + WEIGHTS["semantic"] * semantic_score
        + WEIGHTS["extra"] * extra_score
    )
    score = round(max(0.0, min(1.0, total)) * 100, 2)

    breakdown = MatchBreakdown(
        hard=round(hard_score, 4),
        semantic=round(semantic_score, 4),
        extra=round(extra_score, 4),
        weights=WEIGHTS,
        matched_skills=[_display(skill, required, profile.skills) for skill in matched],
        missing_skills=[_display(skill, required, profile.skills) for skill in missing],
        semantic_method=semantic_method,
        reasoning=_reasoning(hard_score, semantic_score, extra_score, matched, missing, extra_reason),
    )

    return score, breakdown


def _semantic_score(
    experience_text: str,
    jd_text: str,
    settings: Settings,
    embedder: Embedder,
) -> tuple[float, str]:
    exp_chunks = split_chunks(experience_text, max_words=350)[:20]
    jd_chunks = split_chunks(jd_text, max_words=350)[:8]

    if not exp_chunks or not jd_chunks:
        return 0.0, "lexical"

    vectors = embedder.encode([*exp_chunks, *jd_chunks])
    if vectors is None:
        return (
            lexical_cosine(experience_text, jd_text),
            "lexical",
        )

    exp_vectors = vectors[: len(exp_chunks)]
    jd_vectors = vectors[len(exp_chunks) :]

    # Mỗi đoạn experience lấy mức khớp tốt nhất với bất kỳ đoạn JD nào, rồi lấy trung bình
    per_chunk = [
        max(cosine(exp_vector, jd_vector) for jd_vector in jd_vectors)
        for exp_vector in exp_vectors
    ]
    return sum(per_chunk) / len(per_chunk), "bge-m3"


def _extra_score(profile: CandidateProfile, jd_text: str) -> tuple[float, str]:
    required_years = _required_years(jd_text)
    candidate_years = profile.total_years_experience or 0.0

    if required_years > 0:
        years_score = min(candidate_years / required_years, 1.0)
    else:
        years_score = 1.0 if candidate_years > 0 else 0.5

    education_score = _EDUCATION_RANK.get(profile.education_level or "", 0.3)
    extra = 0.6 * years_score + 0.4 * education_score

    reason = (
        f"kinh nghiệm {candidate_years:g}/{required_years:g} năm"
        if required_years > 0
        else f"kinh nghiệm {candidate_years:g} năm"
    )
    reason += f", học vấn {profile.education_level or 'không rõ'}"
    return min(extra, 1.0), reason


def _required_years(jd_text: str) -> float:
    values: list[float] = []
    for match in _JD_YEARS_RE.finditer(jd_text):
        try:
            value = float(match.group(1).replace(",", "."))
        except ValueError:
            continue
        if 0 <= value <= 30:
            values.append(value)
    return max(values) if values else 0.0


def _display(skill: str, required: list[str], candidate: list[str]) -> str:
    """Ưu tiên hiển thị đúng tên trong JD thay vì key lowercase của Jaccard."""
    for item in required:
        if normalize_skill(item).lower() == skill:
            return item
    for item in candidate:
        if normalize_skill(item).lower() == skill:
            return item
    return skill


def _reasoning(
    hard: float,
    semantic: float,
    extra: float,
    matched: list[str],
    missing: list[str],
    extra_reason: str,
) -> str:
    parts = [
        f"Khớp kỹ năng {hard:.0%} ({len(matched)} khớp, {len(missing)} thiếu)",
        f"Tương đồng ngữ nghĩa {semantic:.0%}",
        f"Tiêu chí phụ {extra:.0%} ({extra_reason})",
    ]
    if missing:
        parts.append("Thiếu: " + ", ".join(sorted(missing)[:8]))
    return "; ".join(parts)
