# ADR-0005 — Dùng Message Queue thay cho gọi HTTP trực tiếp sang AI Service

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** ADR-0001, US-03, US-04
- **Thay thế:** Sơ đồ Sequence 1 trong SRS v2.0.0 (mục 2.2)

## Bối cảnh

SRS v2.0.0 có **mâu thuẫn nội tại**: ADR-01 ghi "giao tiếp qua RESTful API nội bộ **hoặc** Message Queue", nhưng Sequence Diagram 1 lại vẽ Core API gọi thẳng `POST /internal/v1/ai/parse-and-match`.

Nếu giữ nguyên hướng gọi HTTP trực tiếp:

- 100 CV nộp đồng thời → FastAPI nghẽn, request timeout.
- Timeout = **mất job vĩnh viễn**, không có retry, không có dấu vết.
- Core API phải giữ kết nối nền trong suốt thời gian AI xử lý (có thể 30–60s với OCR).

## Quyết định

Chuẩn hoá luồng bất đồng bộ bằng **BullMQ + Redis**:

1. Core API lưu file → tạo record `candidates` → `enqueue('cv-processing', { candidateId })`.
2. Trả `201` ngay cho ứng viên.
3. Worker consume job, gọi AI Service, ghi kết quả vào DB.
4. Cấu hình: `attempts: 3`, `backoff: exponential 5s`, `removeOnComplete: 100`.
5. Job thất bại sau 3 lần → **Dead Letter Queue** `cv-processing-dlq` + ghi `candidates.ai_error`.
6. Admin có endpoint re-process thủ công.

## Hệ quả

**Tích cực**

- Chịu tải, có retry, có DLQ, có thể replay.
- Core API không phụ thuộc vào việc AI Service đang sống hay chết.
- Tách biệt hoàn toàn vòng đời request/response.

**Tiêu cực**

- Kết quả AI là **eventually consistent** → UI phải polling hoặc WebSocket để cập nhật trạng thái.
- Thêm Redis vào hạ tầng (đã có sẵn cho rate limit & cache).

## Phương án đã loại

1. **HTTP trực tiếp + `Promise.allSettled`**: không có retry bền vững, mất job khi restart.
2. **RabbitMQ / Kafka**: mạnh hơn nhưng overkill cho quy mô này; BullMQ dùng chung Redis đã có.
3. **Cron quét DB mỗi phút**: đơn giản nhưng trễ và khó scale.
