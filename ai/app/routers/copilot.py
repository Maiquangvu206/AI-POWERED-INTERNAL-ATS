from fastapi import APIRouter, Depends, Request, status
from app.schemas import CopilotRequest, CopilotResponse
from app.security import verify_internal_token
from app.services.copilot import generate_questions

router = APIRouter(prefix="/internal/v1/ai", tags=["internal"], dependencies=[Depends(verify_internal_token)])

@router.post("/copilot/questions", response_model=CopilotResponse, status_code=status.HTTP_200_OK)
async def get_questions(payload: CopilotRequest, request: Request) -> CopilotResponse:
    llm = request.app.state.llm
    return await generate_questions(payload, llm)
