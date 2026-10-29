"""Chuẩn hoá tên kỹ năng và trích kỹ năng từ text.

Từ điển nằm ở `app/data/skills-dictionary.json` — sửa dữ liệu không cần sửa code.
"""

import json
import re
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "skills-dictionary.json"


@lru_cache
def _dictionary() -> dict[str, list[str]]:
    with _DATA_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload["skills"]


@lru_cache
def _education_dictionary() -> dict[str, list[str]]:
    with _DATA_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload["education"]


@lru_cache
def _alias_index() -> dict[str, str]:
    """alias (lowercase) → tên chuẩn."""
    index: dict[str, str] = {}
    for canonical, aliases in _dictionary().items():
        index[canonical.lower()] = canonical
        for alias in aliases:
            index[alias.lower()] = canonical
    return index


def normalize_skill(value: str) -> str:
    """`JS` → `JavaScript`, `postgres` → `PostgreSQL`; không biết thì giữ nguyên."""
    cleaned = re.sub(r"\s+", " ", value).strip()
    return _alias_index().get(cleaned.lower(), cleaned)


@lru_cache
def _skill_patterns() -> list[tuple[str, re.Pattern[str]]]:
    """Regex có biên từ — tránh `Go` khớp trong `Google`, `C` khớp trong `React`."""
    patterns: list[tuple[str, re.Pattern[str]]] = []

    for canonical, aliases in _dictionary().items():
        for alias in {canonical, *aliases}:
            escaped = re.escape(alias.lower())
            pattern = re.compile(
                rf"(?<!\w){escaped}(?!\w)",
                re.IGNORECASE,
            )
            patterns.append((canonical, pattern))

    # Alias dài trước để `next.js` không bị `js` chiếm chỗ
    patterns.sort(key=lambda item: len(item[1].pattern), reverse=True)
    return patterns


def extract_skills(text: str) -> list[str]:
    """Trả danh sách kỹ năng chuẩn hoá, giữ thứ tự xuất hiện, không trùng."""
    found: list[str] = []
    seen: set[str] = set()

    lower = text.lower()
    for canonical, pattern in _skill_patterns():
        if canonical in seen:
            continue
        if pattern.search(lower):
            seen.add(canonical)
            found.append(canonical)

    return found


def detect_education_level(text: str) -> str | None:
    lower = text.lower()
    # Ưu tiên bằng cấp cao nhất
    for level in ("doctorate", "master", "bachelor", "college", "certificate"):
        for keyword in _education_dictionary()[level]:
            if re.search(rf"(?<!\w){re.escape(keyword.lower())}(?!\w)", lower):
                return level
    return None


def jaccard(required: list[str], candidate: list[str]) -> tuple[float, list[str], list[str]]:
    """Jaccard trên tập kỹ năng đã chuẩn hoá.

    Trả kèm `matched` / `missing` để UI giải thích điểm.
    """
    required_norm = {normalize_skill(item).lower() for item in required if item.strip()}
    candidate_norm = {normalize_skill(item).lower() for item in candidate if item.strip()}

    if not required_norm:
        return 0.0, [], []

    matched = sorted(required_norm & candidate_norm)
    missing = sorted(required_norm - candidate_norm)
    union = required_norm | candidate_norm

    return len(matched) / len(union), matched, missing
