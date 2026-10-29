"""Schema đầu vào/ra của AI Service.

Mọi output đều đi qua Pydantic: LLM trả JSON hỏng sẽ bị chặn tại đây,
không để dữ liệu rác chảy vào database.
"""

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

ExtractionMethod = Literal["text", "ocr", "mixed", "none"]
SemanticMethod = Literal["bge-m3", "lexical"]


class AnalyzeRequest(BaseModel):
    """Payload Core API gửi sang khi worker xử lý một CV."""

    cv_url: HttpUrl = Field(..., description="Signed URL đọc PDF từ object storage")
    jd_text: str = Field(..., min_length=20, max_length=20_000)
    required_skills: list[str] = Field(
        default_factory=list,
        max_length=100,
        description="Kỹ năng bắt buộc; rỗng thì AI tự trích từ JD",
    )
    candidate_id: int | None = Field(default=None, ge=1)

    @field_validator("jd_text")
    @classmethod
    def _strip_jd(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 20:
            raise ValueError("jd_text phải có ít nhất 20 ký tự sau khi trim")
        return cleaned

    @field_validator("required_skills")
    @classmethod
    def _clean_skills(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for item in value:
            skill = item.strip()
            if skill and skill.lower() not in seen:
                seen.add(skill.lower())
                result.append(skill)
        return result


class ExtractionInfo(BaseModel):
    method: ExtractionMethod
    page_count: int = 0
    char_count: int = 0
    word_count: int = 0
    truncated: bool = False
    warnings: list[str] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    """Thông tin trích xuất từ CV — chỉ các trường phục vụ matching."""

    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    total_years_experience: float | None = Field(default=None, ge=0, le=60)
    roles: list[str] = Field(default_factory=list)
    education_level: str | None = None
    languages: list[str] = Field(default_factory=list)
    summary: str | None = None


class MatchBreakdown(BaseModel):
    """Điểm thành phần — dùng để giải thích (XAI) và hiển thị trên UI."""

    hard: float = Field(..., ge=0, le=1)
    semantic: float = Field(..., ge=0, le=1)
    extra: float = Field(..., ge=0, le=1)
    weights: dict[str, float] = Field(
        default_factory=lambda: {"hard": 0.4, "semantic": 0.4, "extra": 0.2}
    )
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    semantic_method: SemanticMethod = "lexical"
    reasoning: str = ""


class AnalyzeResponse(BaseModel):
    score: float = Field(..., ge=0, le=100)
    profile: CandidateProfile
    breakdown: MatchBreakdown
    extraction: ExtractionInfo
    llm_used: bool = False
    ai_version: str = "3.0.0"


class CopilotRequest(BaseModel):
    candidate_id: int | None = Field(default=None, ge=1)
    round_name: str | None = Field(default=None, max_length=100)
    jd_text: str = Field(..., min_length=20, max_length=20_000)
    matched_skills: list[str] = Field(default_factory=list, max_length=100)
    missing_skills: list[str] = Field(default_factory=list, max_length=100)
    count: int = Field(default=5, ge=1, le=10)


class CopilotResponse(BaseModel):
    questions: list[str]
    llm_used: bool = False
    fallback_used: bool = False
