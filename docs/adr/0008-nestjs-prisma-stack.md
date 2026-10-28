# ADR-0008 — Chọn NestJS + Prisma cho Core API

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** SRS v2.0.0 chỉ ghi "Node.js"

## Bối cảnh

SRS chỉ nêu "Core API (Node.js)", để mở framework và ORM. Cần chốt trước khi viết dòng code đầu tiên, vì thay đổi sau sẽ kéo theo toàn bộ cấu trúc module.

Yêu cầu thực tế của dự án:

- RBAC với 2 role và nhiều mức (public / interviewer / admin).
- Transaction nhiều bảng (ADR-0003).
- Audit log tự động cho mọi mutation (ADR-0007).
- Swagger/OpenAPI cho 3 phía (FE, AI, QA).
- Validate DTO chặt chẽ, đồng bộ schema với Frontend.

## Quyết định

- **Framework:** NestJS 10 (TypeScript strict)
- **ORM:** Prisma 6
- **Validation:** class-validator + class-transformer; schema dùng chung với FE đặt tại `shared/` (Zod)

Ánh xạ trực tiếp vào kiến trúc:

| Yêu cầu | Cơ chế NestJS |
|---|---|
| RBAC | `RolesGuard` + `@Roles()` decorator |
| Audit log | `AuditInterceptor` — không phải viết lại ở từng service |
| Transaction | `PrismaService.$transaction` |
| API docs | `@nestjs/swagger` sinh từ decorator |
| Cấu hình env | `@nestjs/config` + validate fail-fast |

## Hệ quả

**Tích cực**

- Cấu trúc module khớp 1-1 với Epic trong backlog → dễ chia việc, dễ review.
- Guard/Interceptor/Pipe xử lý cross-cutting concern một lần, không lặp code.
- Prisma sinh type từ schema → `strict` TypeScript bắt lỗi sớm.

**Tiêu cực**

- Đường cong học tập cao hơn Express thuần (DI, decorator, module).
- Bundle/dependency nặng hơn; cold start chậm hơn Express ~200ms (không đáng kể với API nội bộ).

## Phương án đã loại

1. **Express thuần**: phải tự viết lại auth guard, validation, swagger, DI → tốn thời gian và dễ sai.
2. **Fastify + Zod**: nhanh hơn nhưng hệ sinh thái module ít hơn, không có sẵn interceptor pattern.
3. **TypeORM**: ít type-safe hơn Prisma, migration khó kiểm soát hơn.
