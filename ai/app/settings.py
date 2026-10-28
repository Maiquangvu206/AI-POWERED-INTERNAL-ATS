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

    # Model & LLM — dùng từ Phase 3
    embedding_model: str = "BAAI/bge-m3"
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_timeout_ms: int = 30_000


@lru_cache
def get_settings() -> Settings:
    """Cache Settings để không đọc lại .env mỗi request."""
    return Settings()
