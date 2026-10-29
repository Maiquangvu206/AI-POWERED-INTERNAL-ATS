"""Cấu hình dịch vụ, đọc từ biến môi trường / file .env ở root repo."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ATS AI Service"
    app_version: str = "0.1.0"
    log_level: str = "debug"

    # Dùng để xác thực request nội bộ từ Core API (header X-Internal-Token)
    ai_internal_token: str = "change-me-internal-service-token"

    # ------------------------------------------------------------------
    # LLM (trích xuất có cấu trúc + copilot). Để trống API key → heuristic.
    # ------------------------------------------------------------------
    llm_provider: str = "openai"
    llm_model: str = "gpt-5.4-mini"
    llm_api_key: str = ""
    # Cho phép trỏ tới endpoint OpenAI-compatible (Azure, OpenRouter, Ollama /v1).
    llm_api_base: str = ""
    llm_timeout_ms: int = 30_000
    llm_max_retries: int = 1

    # ------------------------------------------------------------------
    # Embedding (semantic match) — chạy local, không tính token.
    # ------------------------------------------------------------------
    embedding_model: str = "BAAI/bge-m3"
    embedding_max_length: int = 512
    # Tắt để test nhanh / khi máy không đủ RAM (dùng lexical fallback).
    embedding_enabled: bool = True

    # ------------------------------------------------------------------
    # Giới hạn đầu vào — chống prompt quá dài và PDF scan quá lớn.
    # ------------------------------------------------------------------
    max_pdf_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_pdf_pages: int = 30
    max_ocr_pages: int = 10
    ocr_min_words: int = 50
    max_cv_chars: int = 15_000
    max_jd_chars: int = 20_000
    download_timeout_ms: int = 30_000
    # Ngưỡng chunk cho experience khi tính embedding (xấp xỉ token → từ).
    semantic_chunk_tokens: int = 512


@lru_cache
def get_settings() -> Settings:
    """Cache Settings để không đọc lại .env mỗi request."""
    return Settings()
