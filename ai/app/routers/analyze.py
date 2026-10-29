"""Endpoint nội bộ: Core API gửi CV sang để bóc tách + chấm điểm."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.security import verify_internal_token
from app.services.pipeline import CvDownloadError, CvExtractionError, analyze
from app.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal/v1/ai",
    tags=["internal"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze_cv(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    llm = request.app.state.llm
    embedder = request.app.state.embedder

    try:
        return await analyze(payload, get_settings(), llm, embedder)
    except CvDownloadError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except CvExtractionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except Exception as error:
        logger.exception("Lỗi không mong đợi khi analyze candidate=%s", payload.candidate_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Service lỗi: {error}",
        ) from error
