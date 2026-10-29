"""Chuẩn hoá text, cắt section và mask PII trước khi gửi LLM."""

import re
import unicodedata
from collections import Counter

SECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "summary": (
        "summary",
        "profile",
        "about me",
        "objective",
        "career objective",
        "tóm tắt",
        "giới thiệu",
        "mục tiêu nghề nghiệp",
        "mục tiêu",
        "thông tin cá nhân",
    ),
    "experience": (
        "experience",
        "work experience",
        "employment",
        "professional experience",
        "kinh nghiệm",
        "kinh nghiệm làm việc",
        "quá trình làm việc",
        "lịch sử công tác",
    ),
    "education": (
        "education",
        "academic",
        "qualification",
        "học vấn",
        "trình độ học vấn",
        "giáo dục",
        "bằng cấp",
    ),
    "skills": (
        "skills",
        "technical skills",
        "core skills",
        "competencies",
        "kỹ năng",
        "kỹ năng chuyên môn",
        "công nghệ sử dụng",
    ),
    "projects": (
        "projects",
        "project experience",
        "portfolio",
        "dự án",
        "kinh nghiệm dự án",
    ),
    "certifications": (
        "certifications",
        "certificates",
        "licenses",
        "chứng chỉ",
        "giải thưởng",
    ),
    "languages": (
        "languages",
        "language skills",
        "ngoại ngữ",
        "ngôn ngữ",
    ),
}

# Dòng tiêu đề section thường ngắn và có thể kèm dấu ':' hoặc gạch đầu dòng
_HEADING_MAX_LEN = 60

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)")
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_ID_RE = re.compile(r"(?<!\d)(?:\d{9}|\d{12})(?!\d)")


def normalize_text(raw: str) -> str:
    """NFC, gộp dòng bị ngắt, bỏ khoảng trắng thừa — giữ xuống dòng giữa các mục."""
    if not raw:
        return ""

    text = unicodedata.normalize("NFC", raw)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ").replace("\u200b", "")

    # Từ bị ngắt bằng gạch nối cuối dòng: "kinh-\n nghiệm" → "kinh nghiệm"
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    # Dòng không kết thúc bằng dấu câu → nối với dòng sau (CV hay wrap)
    text = re.sub(r"(?<![.:;!?])\n(?=[a-zà-ỹ0-9])", " ", text)

    lines = [" ".join(line.split()) for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def strip_repeated_headers_footers(pages: list[str]) -> list[str]:
    """Bỏ header/footer lặp ở phần lớn các trang (số trang, tên công ty...)."""
    if len(pages) < 3:
        return pages

    line_counter: Counter[str] = Counter()
    page_lines: list[list[str]] = []

    for page in pages:
        lines = [line.strip() for line in normalize_text(page).split("\n") if line.strip()]
        page_lines.append(lines)
        # Chỉ xét dòng ngắn — header/footer hầu như luôn ngắn
        for line in set(lines):
            if len(line) <= 120:
                line_counter[line] += 1

    threshold = max(2, int(len(pages) * 0.6))
    repeated = {line for line, count in line_counter.items() if count >= threshold}

    if not repeated:
        return pages

    cleaned: list[str] = []
    for lines in page_lines:
        kept = [line for line in lines if line not in repeated]
        cleaned.append("\n".join(kept))
    return cleaned


def _is_heading(line: str) -> str | None:
    candidate = line.strip().strip(":-•* ").strip()
    if not candidate or len(candidate) > _HEADING_MAX_LEN:
        return None

    lowered = candidate.lower()
    for section, keywords in SECTION_KEYWORDS.items():
        for keyword in keywords:
            if lowered == keyword or lowered.startswith(f"{keyword}:"):
                return section
    return None


def split_sections(text: str) -> dict[str, str]:
    """Cắt CV thành các section. Không nhận diện được heading thì gom vào `other`."""
    sections: dict[str, list[str]] = {key: [] for key in SECTION_KEYWORDS}
    sections["other"] = []

    current = "other"
    for line in text.split("\n"):
        section = _is_heading(line)
        if section:
            current = section
            remainder = line.split(":", 1)[1].strip() if ":" in line else ""
            if remainder:
                sections[current].append(remainder)
            continue
        sections[current].append(line)

    return {
        key: "\n".join(lines).strip()
        for key, lines in sections.items()
        if lines and "\n".join(lines).strip()
    }


def mask_pii(text: str) -> str:
    """Mask email / SĐT / URL / CCCD trước khi gửi LLM (NĐ 13/2023)."""
    masked = _EMAIL_RE.sub("[EMAIL]", text)
    masked = _PHONE_RE.sub("[PHONE]", masked)
    masked = _URL_RE.sub("[URL]", masked)
    masked = _ID_RE.sub("[ID]", masked)
    return masked


def mask_value(text: str, value: str | None) -> str:
    """Mask một giá trị cụ thể (ví dụ họ tên) nếu tìm thấy trong text."""
    if not value:
        return text
    cleaned = value.strip()
    if len(cleaned) < 2:
        return text
    return re.sub(re.escape(cleaned), "[NAME]", text, flags=re.IGNORECASE)


def truncate(text: str, max_chars: int) -> tuple[str, bool]:
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars].rstrip(), True


def truncate_token_aware(text: str, max_chars: int) -> tuple[str, bool]:
    """Cắt ưu tiên ranh giới từ để không tạo token rác."""
    if len(text) <= max_chars:
        return text, False

    cut = text[:max_chars]
    boundary = max(cut.rfind(" "), cut.rfind("\n"))
    if boundary > max_chars * 0.8:
        cut = cut[:boundary]
    return cut.rstrip(), True


def split_chunks(text: str, max_words: int = 350) -> list[str]:
    """Chia text thành chunk theo từ — xấp xỉ 512 token cho `bge-m3`."""
    words = text.split()
    if not words:
        return []
    return [" ".join(words[index : index + max_words]) for index in range(0, len(words), max_words)]


def word_count(text: str) -> int:
    return len(text.split())


__all__ = [
    "SECTION_KEYWORDS",
    "mask_pii",
    "mask_value",
    "normalize_text",
    "split_chunks",
    "split_sections",
    "strip_repeated_headers_footers",
    "truncate",
    "truncate_token_aware",
    "word_count",
]
