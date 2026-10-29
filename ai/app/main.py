"""Entrypoint của AI Service.

Phase 3:
  POST /internal/v1/ai/analyze    — bóc tách + matching (X-Internal-Token)
  GET  /health                    — liveness + trạng thái model
Phase 5 sẽ thêm `/internal/v1/ai/copilot`.
"""

from fastapi import FastAPI

from app.routers import analyze, health, copilot
from app.services.embedder import Embedder
from app.services.llm_client import LlmClient
from app.settings import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Microservice AI cho hệ thống AI-Powered Internal ATS",
)

# Singleton gắn vào app: model/embedding chỉ load 1 lần cho cả process
app.state.llm = LlmClient(settings)
app.state.embedder = Embedder(settings)

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(copilot.router)
