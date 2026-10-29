"""Trích xuất text từ PDF: pdfplumber trước, OCR fallback khi là CV scan.

`pdfplumber` và `pytesseract`/`pdf2image` là optional dependency: nếu chưa cài,
service vẫn khởi động được và trả warning thay vì crash toàn bộ pipeline.
"""

import io
from dataclasses import dataclass, field
from typing import Any

from app.services.text import normalize_text, word_count
from app.settings import Settings


@dataclass
class PdfExtraction:
    text: str
    method: str  # text | ocr | mixed | none
    page_count: int
    warnings: list[str] = field(default_factory=list)


def extract_pdf(data: bytes, settings: Settings) -> PdfExtraction:
    if not data:
        return PdfExtraction("", "none", 0, ["File PDF rỗng"])

    try:
        import pdfplumber
    except ImportError:
        return PdfExtraction(
            "", "none", 0, ["Thiếu thư viện pdfplumber — chạy: pip install -e '.[ai]'"]
        )

    warnings: list[str] = []
    page_texts: list[str] = []

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            page_count = len(pdf.pages)
            if page_count == 0:
                return PdfExtraction("", "none", 0, ["PDF không có trang nào"])

            if page_count > settings.max_pdf_pages:
                warnings.append(
                    f"PDF có {page_count} trang, chỉ xử lý {settings.max_pdf_pages} trang đầu"
                )

            for page in pdf.pages[: settings.max_pdf_pages]:
                page_texts.append(_extract_page_text(page))
    except Exception as error:
        return PdfExtraction("", "none", 0, [f"Không đọc được PDF: {error}"])

    text = normalize_text("\n\n".join(page_texts))
    words = word_count(text)

    if words < settings.ocr_min_words:
        ocr_text, ocr_warnings = _run_ocr(data, page_count, settings)
        warnings.extend(ocr_warnings)
        if ocr_text.strip():
            ocr_words = word_count(ocr_text)
            if ocr_words > words:
                method = "ocr" if words < 10 else "mixed"
                return PdfExtraction(
                    normalize_text(ocr_text),
                    method,
                    page_count,
                    warnings,
                )
            warnings.append("OCR không cải thiện chất lượng text — dùng kết quả pdfplumber")

    if not text.strip():
        return PdfExtraction("", "none", page_count, warnings or ["PDF không có text"])

    return PdfExtraction(text, "text", page_count, warnings)


def _extract_page_text(page: Any) -> str:
    """Ưu tiên xử lý layout 2 cột; fallback về extract_text mặc định."""
    try:
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    except Exception:
        return page.extract_text() or ""

    if not words:
        return page.extract_text() or ""

    two_columns = _split_two_columns(words, float(page.width))
    if not two_columns:
        return page.extract_text() or ""

    left, right = two_columns
    return f"{_words_to_text(left)}\n{_words_to_text(right)}".strip()


def _split_two_columns(words: list[dict[str, Any]], width: float) -> tuple[list, list] | None:
    """Phát hiện 2 cột bằng khoảng trống dọc giữa trang.

    Chỉ nhận khi hai bên đều có ≥ 20% số từ và không có từ nào bắc qua khe giữa.
    """
    if len(words) < 30:
        return None

    spaced = [word for word in words if word["x1"] < width * 0.45]
    if not spaced:
        return None

    left_max = max(word["x1"] for word in spaced)
    right_candidates = [word for word in words if word["x0"] > left_max + 8]

    if len(right_candidates) < len(words) * 0.2:
        return None

    crossing = [
        word
        for word in words
        if word["x0"] <= left_max and word["x1"] > left_max + 8
    ]
    if crossing:
        return None

    split_x = left_max + 4
    left_words = [word for word in words if word["x1"] <= split_x]
    right_words = [word for word in words if word["x0"] > split_x]

    if len(left_words) < len(words) * 0.2 or len(right_words) < len(words) * 0.2:
        return None

    return left_words, right_words


def _words_to_text(words: list[dict[str, Any]], tolerance: float = 3.0) -> str:
    """Gom từ thành dòng theo `top`, rồi sắp theo `x0`."""
    if not words:
        return ""

    ordered = sorted(words, key=lambda word: (round(word["top"] / tolerance), word["x0"]))

    lines: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    current_top: float | None = None

    for word in ordered:
        if current_top is None or abs(word["top"] - current_top) <= tolerance:
            current.append(word)
            current_top = word["top"] if current_top is None else current_top
        else:
            lines.append(current)
            current = [word]
            current_top = word["top"]
    if current:
        lines.append(current)

    return "\n".join(
        " ".join(word["text"] for word in sorted(line, key=lambda item: item["x0"]))
        for line in lines
    )


def _run_ocr(data: bytes, page_count: int, settings: Settings) -> tuple[str, list[str]]:
    warnings: list[str] = []

    try:
        import pytesseract
        from pdf2image import convert_from_bytes
    except ImportError:
        return "", ["Thiếu pytesseract/pdf2image — không chạy được OCR fallback"]

    try:
        pages = convert_from_bytes(
            data,
            dpi=200,
            first_page=1,
            last_page=min(page_count, settings.max_ocr_pages),
        )
    except Exception as error:
        return "", [f"OCR không khả dụng (pdf2image/poppler): {error}"]

    texts: list[str] = []
    try:
        for index, image in enumerate(pages, start=1):
            try:
                texts.append(pytesseract.image_to_string(image, lang="vie+eng"))
            except Exception as error:
                warnings.append(f"OCR trang {index} thất bại: {error}")
                break
    except Exception as error:
        return "", [*warnings, f"OCR không khả dụng (tesseract): {error}"]

    if len(pages) < page_count:
        warnings.append(
            f"Chỉ OCR {len(pages)}/{page_count} trang (giới hạn {settings.max_ocr_pages})"
        )

    return "\n\n".join(texts), warnings
