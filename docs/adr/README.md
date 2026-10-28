# Architecture Decision Records

Mọi thay đổi kiến trúc phải kèm một ADR mới. ADR cũ **không bị sửa nội dung** — chỉ đổi trạng thái thành `Superseded by ADR-XXXX`.

| ID | Tiêu đề | Trạng thái | Phase |
|---|---|---|---|
| [0001](0001-ai-service-separation.md) | Tách AI Service bằng Python FastAPI | Accepted | 0 |
| [0002](0002-blind-scoring-at-data-layer.md) | Blind Scoring thực thi ở tầng Database/Backend | Accepted | 0 |
| [0003](0003-acid-transactions.md) | Toàn vẹn dữ liệu bằng Database Transaction | Accepted | 0 |
| [0004](0004-tracking-code-anti-idor.md) | Chống IDOR bằng mã tra cứu ngẫu nhiên | Accepted | 0 |
| [0005](0005-message-queue-over-http.md) | Message Queue thay cho HTTP trực tiếp sang AI | Accepted | 0 |
| [0006](0006-object-storage.md) | Lưu CV trên Object Storage (MinIO / S3) | Accepted | 0 |
| [0007](0007-audit-log-and-unique-constraint.md) | Audit Log & UNIQUE Constraint | Accepted | 0 |
| [0008](0008-nestjs-prisma-stack.md) | NestJS + Prisma cho Core API | Accepted | 0 |

## Template

```markdown
# ADR-XXXX — Tiêu đề ngắn gọn

- **Ngày:** YYYY-MM-DD
- **Trạng thái:** Proposed | Accepted | Superseded by ADR-XXXX
- **Liên quan:** US-xx, ADR-xxxx

## Bối cảnh
Vấn đề cần giải quyết, ràng buộc kỹ thuật, số liệu thực tế.

## Quyết định
Chọn gì, cấu hình cụ thể.

## Hệ quả
Tích cực / Tiêu cực / Rủi ro còn lại.

## Phương án đã loại
Vì sao không chọn — quan trọng ngang với lý do chọn.
```
