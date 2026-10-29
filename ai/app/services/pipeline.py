"""Ghép toàn bộ pipeline: download → extract → profile → match."""

import logging
import time

import httpx
from starlette.concurrency import run_in_threadpool

from app.schemas import AnalyzeRequest, AnalyzeResponse, ExtractionInfo
from app.services.embedder import Embedder
from app.services.llm_client import LlmClient
from app.services.matcher import match
from app.services.pdf import extract_pdf
from app.services.profile import build_profile
from app.services.text import (
    normalize_text,
    split_sections,
    truncate_token_aware,
    word_count,
)
from app.settings import Settings

logger = logging.getLogger(__name__)


class CvDownloadError(Exception):
    """Không tải được PDF từ signed URL."""


class CvExtractionError(Exception):
    """PDF không có text và OCR cũng không khả dụng."""


async def analyze(
    request: AnalyzeRequest,
    settings: Settings,
    llm: LlmClient,
    embedder: Embedder,
) -> AnalyzeResponse:
    started = time.perf_counter()

    data = await _download(str(request.cv_url), settings)
    extraction = await run_in_threadpool(extract_pdf, data, settings)

    warnings = list(extraction.warnings)

    if not extraction.text.strip():
        raise CvExtractionError(
            "Không trích xuất được text từ PDF. "
            "Cần cài Tesseract (vie+eng) + poppler cho CV scan."
        )

    text, truncated = truncate_token_aware(extraction.text, settings.max_cv_chars)
    if truncated:
        warnings.append(f"CV dài hơn {settings.max_cv_chars} ký tự — đã cắt bớt")

    text = normalize_text(text)
    sections = split_sections(text)
    experience_text = sections.get("experience") or sections.get("projects") or text

    profile, llm_used = await build_profile(text, sections, settings, llm)

    jd_text, jd_truncated = truncate_token_aware(request.jd_text, settings.max_jd_chars)
    if jd_truncated:
        warnings.append("JD dài — đã cắt bớt trước khi matching")

    score, breakdown = await run_in_threadpool(
        match,
        profile,
        jd_text,
        request.required_skills,
        experience_text,
        settings,
        embedder,
    )

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "analyze xong candidate=%s chars=%s method=%s score=%.2f llm=%s semantic=%s ms=%s",
        request.candidate_id,
        len(text),
        extraction.method,
        score,
        llm_used,
        breakdown.semantic_method,
        elapsed_ms,
    )

    return AnalyzeResponse(
        score=score,
        profile=profile,
        breakdown=breakdown,
        extraction=ExtractionInfo(
            method=extraction.method,  # type: ignore[arg-type]
            page_count=extraction.page_count,
            char_count=len(text),
            word_count=word_count(text),
            truncated=truncated,
            warnings=warnings[:20],
        ),
        llm_used=llm_used,
    )


async def _download(url: str, settings: Settings) -> bytes:
    try:
        async with httpx.AsyncClient(
            timeout=settings.download_timeout_ms / 1000,
            follow_redirects=True,
        ) as client, client.stream("GET", url) as response:
            if response.status_code != 200:
                raise CvDownloadError(
                    f"Tải CV thất bại: HTTP {response.status_code}"
                )

            declared = response.headers.get("content-length")
            if declared and int(declared) > settings.max_pdf_bytes:
                raise CvDownloadError("CV vượt quá giới hạn dung lượng")

            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > settings.max_pdf_bytes:
                    raise CvDownloadError("CV vượt quá giới hạn dung lượng")
                chunks.append(chunk)

            payload = b"".join(chunks)
            if not payload.startswith(b"%PDF"):
                raise CvDownloadError("Nội dung tải về không phải PDF")

            return payload
    except httpx.HTTPError as error:
        raise CvDownloadError(f"Không tải được CV: {error}") from error
