from app.services.text import (
    mask_pii,
    normalize_text,
    split_chunks,
    split_sections,
    strip_repeated_headers_footers,
    truncate_token_aware,
)


def test_normalize_text_joins_broken_lines() -> None:
    raw = "Phát triển API với Node.js\nvà PostgreSQL\r\n- Tối ưu truy vấn SQL"

    normalized = normalize_text(raw)

    assert "\r" not in normalized
    assert "Node.js và PostgreSQL" in normalized


def test_split_sections_english_and_vietnamese() -> None:
    text = (
        "Nguyễn Văn An\n"
        "Kinh nghiệm làm việc\n"
        "Backend Engineer tại ABC (2021 - 2024)\n"
        "Kỹ năng\n"
        "JavaScript, PostgreSQL, Docker\n"
        "Học vấn\n"
        "Đại học Bách Khoa"
    )

    sections = split_sections(text)

    assert "Backend Engineer" in sections["experience"]
    assert "PostgreSQL" in sections["skills"]
    assert "Bách Khoa" in sections["education"]


def test_mask_pii() -> None:
    text = "Liên hệ an.nguyen@example.com hoặc 0912345678, CCCD 012345678901"

    masked = mask_pii(text)

    assert "an.nguyen@example.com" not in masked
    assert "0912345678" not in masked
    assert "012345678901" not in masked
    assert "[EMAIL]" in masked
    assert "[PHONE]" in masked
    assert "[ID]" in masked


def test_truncate_token_aware_keeps_word_boundary() -> None:
    text = "một hai ba bốn năm sáu bảy tám chín mười"

    result, truncated = truncate_token_aware(text, 20)

    assert truncated is True
    assert len(result) <= 20
    assert not result.endswith(" ")


def test_split_chunks() -> None:
    chunks = split_chunks("a b c d e f", max_words=3)

    assert chunks == ["a b c", "d e f"]


def test_strip_repeated_headers_footers() -> None:
    pages = [
        "Công ty ABC\nNội dung trang 1\nTrang 1/3",
        "Công ty ABC\nNội dung trang 2\nTrang 2/3",
        "Công ty ABC\nNội dung trang 3\nTrang 3/3",
    ]

    cleaned = strip_repeated_headers_footers(pages)

    assert all("Công ty ABC" not in page for page in cleaned)
    assert "Nội dung trang 2" in cleaned[1]
