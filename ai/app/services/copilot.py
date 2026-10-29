"""AI Copilot: Sinh câu hỏi phỏng vấn dựa trên skill gap."""

from app.schemas import CopilotRequest, CopilotResponse
from app.services.llm_client import LlmClient

SYSTEM_PROMPT = """Bạn là chuyên gia phỏng vấn kỹ thuật. Nhiệm vụ của bạn là sinh ra các câu hỏi phỏng vấn dựa trên lỗ hổng kỹ năng (missing skills) của ứng viên so với JD.
Hãy trả về JSON format: {"questions": ["câu 1", "câu 2", ...]}
Không giải thích, không markdown."""

async def generate_questions(payload: CopilotRequest, llm: LlmClient) -> CopilotResponse:
    if not llm.available:
        return CopilotResponse(questions=["Vui lòng kiểm tra lại kỹ năng này trong buổi phỏng vấn trực tiếp."], fallback_used=True)

    missing = ", ".join(payload.missing_skills)
    prompt = f"JD: {payload.jd_text[:1000]}\n\nỨng viên thiếu kỹ năng: {missing}. Hãy sinh {payload.count} câu hỏi kỹ thuật để kiểm tra các kỹ năng thiếu này."
    
    response = await llm.complete_json(SYSTEM_PROMPT, prompt)
    if response and "questions" in response:
        return CopilotResponse(questions=response["questions"], llm_used=True)
    
    return CopilotResponse(questions=["Hãy hỏi ứng viên về kinh nghiệm thực tế với các kỹ năng trên."], fallback_used=True)
