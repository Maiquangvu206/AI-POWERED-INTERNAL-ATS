# ADR-0001 — Tách AI Service bằng Python FastAPI

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** SRS §4 ADR-01, US-04, US-08

## Bối cảnh

Node.js chạy single-thread Event Loop. Các tác vụ nặng CPU như trích xuất PDF (`pdfplumber`) và tính vector embedding (`sentence-transformers`) sẽ chặn toàn bộ luồng I/O của Core API. Với 50 CV nộp đồng thời, mọi request khác (đăng nhập, tra cứu trạng thái) sẽ bị treo theo.

## Quyết định

Xây dựng AI Service thành **microservice độc lập** bằng Python + FastAPI:

- Giao tiếp với Core API qua REST nội bộ (`/internal/v1/ai/*`), xác thực bằng header `X-Internal-Token`.
- Không expose AI Service ra Internet.
- Mỗi service có Dockerfile, vòng đời deploy và scale riêng.

## Hệ quả

**Tích cực**

- Core API giữ độ trễ thấp (P99 mục tiêu < 50ms) bất kể tải AI.
- AI scale ngang độc lập (thêm replica worker khi queue dài).
- Được dùng toàn bộ hệ sinh thái Python cho NLP/ML.

**Tiêu cực**

- Tăng độ phức tạp vận hành: 2 ngôn ngữ, 2 pipeline CI, 2 bộ dependency.
- Cần observability xuyên service (`request_id` phải được truyền qua header).

## Phương án đã loại

1. **Chạy AI trong Node.js** (`pdf-parse` + `@xenova/transformers`): chất lượng embedding kém hơn, không có hệ sinh thái NLP, và vẫn chặn Event Loop.
2. **Worker threads trong Node.js**: giải quyết được blocking nhưng không giải quyết được khoảng cách hệ sinh thái ML.
