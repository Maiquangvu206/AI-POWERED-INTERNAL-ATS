"""Health/liveness + trạng thái model."""

from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.settings import get_settings

router = APIRouter(tags=["system"])


@router.get("/health")
def health(request: Request) -> dict[str, object]:
    settings = get_settings()
    embedder = request.app.state.embedder
    llm = request.app.state.llm

    return {
        "status": "ok",
        "service": "ai-service",
        "version": settings.app_version,
        "timestamp": datetime.now(tz=UTC).isoformat(),
        "model_loaded": embedder.loaded,
        "embedding": {
            "model": settings.embedding_model,
            "enabled": settings.embedding_enabled,
            "available": embedder.available,
            "max_length": settings.embedding_max_length,
        },
        "llm": {
            "provider": settings.llm_provider,
            "model": settings.llm_model,
            "configured": llm.available,
        },
    }
