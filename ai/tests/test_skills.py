from app.services.skills import (
    detect_education_level,
    extract_skills,
    jaccard,
    normalize_skill,
)


def test_normalize_skill_synonyms() -> None:
    assert normalize_skill("JS") == "JavaScript"
    assert normalize_skill("postgres") == "PostgreSQL"
    assert normalize_skill("K8s") == "Kubernetes"
    assert normalize_skill("SomethingUnknown") == "SomethingUnknown"


def test_extract_skills_has_word_boundaries() -> None:
    text = "Thành thạo JS, Postgres, Docker và Kubernetes. Có kinh nghiệm với Go."

    skills = extract_skills(text)

    assert "JavaScript" in skills
    assert "PostgreSQL" in skills
    assert "Docker" in skills
    assert "Kubernetes" in skills
    assert "Go" in skills


def test_extract_skills_does_not_match_substrings() -> None:
    # "Go" không được khớp trong "Google", "C" không khớp trong "React"
    skills = extract_skills("Làm việc tại Google với React và TypeScript")

    assert "Go" not in skills
    assert "C" not in skills
    assert "React" in skills
    assert "TypeScript" in skills


def test_jaccard_basic() -> None:
    score, matched, missing = jaccard(
        ["JavaScript", "Docker", "PostgreSQL"],
        ["js", "postgres", "Redis"],
    )

    assert matched == ["javascript", "postgresql"]
    assert missing == ["docker"]
    assert score == 2 / 4


def test_jaccard_without_requirements() -> None:
    score, matched, missing = jaccard([], ["JavaScript"])

    assert (score, matched, missing) == (0.0, [], [])


def test_detect_education_level() -> None:
    assert detect_education_level("Tốt nghiệp Đại học Bách Khoa") == "bachelor"
    assert detect_education_level("Thạc sĩ CNTT") == "master"
    assert detect_education_level("Chứng chỉ AWS") == "certificate"
    assert detect_education_level("Không có thông tin") is None
