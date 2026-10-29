from app.schemas import CandidateProfile
from app.services.embedder import Embedder, cosine, lexical_cosine
from app.services.matcher import match
from app.settings import Settings


def _settings() -> Settings:
    return Settings(embedding_enabled=False, llm_api_key="")


def _embedder(settings: Settings) -> Embedder:
    return Embedder(settings)


def test_cosine() -> None:
    assert cosine([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine([], [1.0]) == 0.0


def test_lexical_cosine() -> None:
    assert lexical_cosine("node.js postgresql docker", "node.js postgresql docker") == 1.0
    assert lexical_cosine("node.js", "marketing sales") == 0.0


def test_match_uses_lexical_fallback_when_model_unavailable() -> None:
    settings = _settings()
    profile = CandidateProfile(
        skills=["JavaScript", "PostgreSQL"],
        total_years_experience=3,
        education_level="bachelor",
    )
    jd = "Cần 3 năm kinh nghiệm JavaScript, PostgreSQL và Docker."

    score, breakdown = match(
        profile,
        jd,
        ["JavaScript", "Docker"],
        "Phát triển API bằng JavaScript và PostgreSQL trong 3 năm",
        settings,
        _embedder(settings),
    )

    assert breakdown.semantic_method == "lexical"
    assert breakdown.hard == round(1 / 3, 4)  # 1 khớp / 3 hợp
    assert breakdown.missing_skills == ["Docker"]
    assert 0 <= score <= 100
    expected = round(
        (0.4 * (1 / 3) + 0.4 * breakdown.semantic + 0.2 * breakdown.extra) * 100, 2
    )
    assert score == expected


def test_match_extra_score_for_overqualified_candidate() -> None:
    settings = _settings()
    profile = CandidateProfile(
        skills=["Docker"],
        total_years_experience=10,
        education_level="master",
    )

    _, breakdown = match(
        profile,
        "Yêu cầu 2 năm kinh nghiệm Docker",
        ["Docker"],
        "Docker 10 năm",
        settings,
        _embedder(settings),
    )

    # years bị cap ở 1.0, education master = 0.95
    assert breakdown.extra == round(0.6 * 1.0 + 0.4 * 0.95, 4)


def test_match_required_skills_empty_extracts_from_jd() -> None:
    settings = _settings()
    profile = CandidateProfile(skills=["Docker"], total_years_experience=1)

    _, breakdown = match(
        profile,
        "Cần kinh nghiệm Docker và Kubernetes",
        [],
        "Docker",
        settings,
        _embedder(settings),
    )

    assert len(breakdown.missing_skills) + len(breakdown.matched_skills) >= 2
