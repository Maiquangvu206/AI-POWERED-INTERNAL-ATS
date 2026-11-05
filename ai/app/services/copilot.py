"""AI Copilot: Sinh câu hỏi phỏng vấn dựa trên skill gap.

Output luôn là cấu trúc `[{ question, rationale, expected_signals[] }]` để
giám khảo thấy được căn cứ và tự thẩm định, không phải danh sách câu hỏi rời.
"""

import re

from app.schemas import CopilotRequest, CopilotResponse, CopilotSuggestion
from app.services.llm_client import LlmClient

SYSTEM_PROMPT = """Bạn là chuyên gia phỏng vấn kỹ thuật cho một hệ thống tuyển dụng nội bộ.
Nhiệm vụ: sinh câu hỏi phỏng vấn dựa trên khoảng trống kỹ năng giữa CV và JD.

QUY TẮC BẮT BUỘC — vi phạm sẽ bị loại bỏ:
1. CHỈ hỏi về năng lực chuyên môn, kinh nghiệm làm việc, cách giải quyết vấn đề,
   kỹ năng kỹ thuật/mềm liên quan trực tiếp đến công việc.
2. KHÔNG hỏi hoặc đề cập: tuổi, ngày sinh, năm sinh, giới tính, tình trạng hôn nhân,
   con cái, mang thai, tôn giáo, tín ngưỡng, dân tộc, quốc tịch, quê quán, hộ khẩu,
   CMND/CCCD, sức khỏe, bệnh lý, khuyết tật, quan điểm chính trị, đảng phái.
3. Mỗi câu hỏi phải có `rationale` (vì sao hỏi câu này) và `expected_signals`
   (2-4 dấu hiệu câu trả lời tốt cần quan sát).
4. Câu hỏi phải dựa trên kỹ năng thiếu hoặc JD, không hỏi lan man ngoài chuyên môn.

Chỉ trả về JSON đúng định dạng, không markdown, không giải thích thêm:
{"suggestions": [{"question": "...", "rationale": "...", "expected_signals": ["...", "..."]}]}"""

# Lớp bảo vệ thứ hai: kể cả LLM bỏ qua prompt, output vẫn bị lọc.
FORBIDDEN_PATTERN = re.compile(
    r"\b("
    r"tuổi|ngày sinh|năm sinh|tháng sinh|giới tính|nam hay nữ|hôn nhân|kết hôn|ly hôn|"
    r"con cái|mang thai|sinh con|tôn giáo|tín ngưỡng|dân tộc|quốc tịch|quê quán|"
    r"hộ khẩu|cmnd|cccd|căn cước|sức khỏe|bệnh lý|khuyết tật|chính trị|đảng phái"
    r")\b",
    re.IGNORECASE,
)


def _fallback(payload: CopilotRequest) -> CopilotResponse:
    """Template tĩnh khi LLM không khả dụng/lỗi/trả JSON hỏng."""
    suggestions: list[CopilotSuggestion] = []
    skills = payload.missing_skills or payload.matched_skills

    for skill in skills:
        if len(suggestions) >= payload.count:
            break
        suggestions.append(
            CopilotSuggestion(
                question=(
                    f"Bạn đã từng xử lý tình huống thực tế nào liên quan đến {skill}? "
                    "Hãy mô tả bối cảnh, cách bạn làm và kết quả đo được."
                ),
                rationale=(
                    f"{skill} được JD yêu cầu nhưng chưa thấy bằng chứng rõ ràng trong CV."
                ),
                expected_signals=[
                    f"Hiểu khái niệm cốt lõi của {skill}",
                    f"Từng áp dụng {skill} trong dự án thật",
                    "Nêu được trade-off và bài học kinh nghiệm",
                ],
            )
        )

    generic = [
        CopilotSuggestion(
            question=(
                "Hãy kể về dự án gần nhất bạn trực tiếp phụ trách: vai trò, "
                "quyết định kỹ thuật quan trọng và kết quả cuối cùng."
            ),
            rationale="Cần xác thực kinh nghiệm thực tế và mức độ sở hữu công việc.",
            expected_signals=[
                "Mô tả rõ vai trò cá nhân",
                "Nêu được quyết định và trade-off",
                "Có kết quả định lượng",
            ],
        ),
        CopilotSuggestion(
            question=(
                "Khi gặp một yêu cầu mơ hồ từ stakeholder, bạn làm rõ và "
                "chia nhỏ công việc như thế nào?"
            ),
            rationale="Đánh giá kỹ năng giao tiếp và tư duy phân rã vấn đề.",
            expected_signals=[
                "Đặt câu hỏi làm rõ mục tiêu",
                "Chia nhỏ thành các bước kiểm chứng được",
                "Thống nhất tiêu chí hoàn thành",
            ],
        ),
        CopilotSuggestion(
            question="Bạn đã từng phải bảo vệ một quyết định kỹ thuật trái ý đồng nghiệp chưa? Kết quả thế nào?",
            rationale="Đánh giá khả năng lập luận và cộng tác trong môi trường kỹ thuật.",
            expected_signals=[
                "Trình bày dữ kiện thay vì cảm tính",
                "Lắng nghe phương án khác",
                "Rút ra kết luận dựa trên kết quả",
            ],
        ),
    ]

    for item in generic:
        if len(suggestions) >= payload.count:
            break
        suggestions.append(item)

    return CopilotResponse(suggestions=suggestions[: payload.count], fallback_used=True)


def _is_forbidden(text: str) -> bool:
    return bool(FORBIDDEN_PATTERN.search(text))


def _parse_suggestions(raw: object, limit: int) -> list[CopilotSuggestion]:
    if not isinstance(raw, list):
        return []

    suggestions: list[CopilotSuggestion] = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        question = str(item.get("question") or "").strip()
        rationale = str(item.get("rationale") or "").strip()
        signals_raw = item.get("expected_signals")
        signals = (
            [str(signal).strip() for signal in signals_raw if str(signal).strip()]
            if isinstance(signals_raw, list)
            else []
        )

        if not question or _is_forbidden(question) or _is_forbidden(rationale):
            continue

        suggestions.append(
            CopilotSuggestion(
                question=question,
                rationale=rationale or "Câu hỏi nhằm kiểm chứng kỹ năng liên quan đến JD.",
                expected_signals=signals[:4],
            )
        )
        if len(suggestions) >= limit:
            break

    return suggestions


async def generate_questions(payload: CopilotRequest, llm: LlmClient) -> CopilotResponse:
    if not llm.available:
        return _fallback(payload)

    missing = ", ".join(payload.missing_skills) or "(không có dữ liệu)"
    matched = ", ".join(payload.matched_skills) or "(không có dữ liệu)"
    round_name = payload.round_name or "vòng phỏng vấn hiện tại"
    prompt = (
        f"Vòng phỏng vấn: {round_name}\n"
        f"JD (trích): {payload.jd_text[:2000]}\n\n"
        f"Kỹ năng đã thấy trong CV: {matched}\n"
        f"Kỹ năng còn thiếu so với JD: {missing}\n\n"
        f"Sinh {payload.count} câu hỏi phỏng vấn bằng tiếng Việt."
    )

    response = await llm.complete_json(SYSTEM_PROMPT, prompt)
    suggestions = _parse_suggestions((response or {}).get("suggestions"), payload.count)

    if suggestions:
        return CopilotResponse(suggestions=suggestions, llm_used=True)

    return _fallback(payload)
