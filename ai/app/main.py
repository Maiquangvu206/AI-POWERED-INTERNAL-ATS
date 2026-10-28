"""Entrypoint của AI Service.

Phase 0 chỉ có /health.
Phase 3 sẽ thêm:
  POST /internal/v1/ai/analyze    — bóc tách + matching
  POST /internal/v1/ai/copilot    — sinh câu hỏi phỏng vấn
"""

from datetime import UTC, datetime

from fastapi import FastAPI

from app.settings import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Microservice AI cho hệ thống AI-Powered Internal ATS",
)


@app.get("/health", tags=["system"])
def health() -> dict[str, object]:
    """Liveness probe."""
    return {
        "status": "ok",
        "service": "ai-service",
        "version": settings.app_version,
        "timestamp": datetime.now(tz=UTC).isoformat(),
        "model_loaded": False,  # True từ Phase 3 khi đã load embedding model
    }
