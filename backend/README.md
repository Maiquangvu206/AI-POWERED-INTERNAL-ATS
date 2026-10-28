# Backend — Core API (NestJS)

API chính của hệ thống. Chịu trách nhiệm **mọi thứ trừ AI**: xác thực, quản lý chiến dịch, nhận hồ sơ, chấm điểm, phân quyền, audit log, gửi email.

## Chạy

```bash
# Từ thư mục gốc repo
npm run infra:up                     # Postgres :5433, Redis, RustFS, Mailpit
npm run db:migrate                   # áp migration
npm run db:seed                      # admin@demo.com / Admin@123 + 3 giám khảo
npm run dev:api                      # http://localhost:3000/api/v1/health
```

Swagger: http://localhost:3000/api/docs

## Cấu trúc

```
backend/
├── prisma/
│   ├── schema.prisma           # 8 model + 5 enum
│   ├── migrations/             # init: bảng, index, CHECK constraint, trigger append-only
│   └── seed.ts                 # 4 user demo (idempotent)
├── src/
│   ├── main.ts                 # bootstrap: prefix, cookie, ValidationPipe, Swagger
│   ├── app.module.ts           # ghép module + global guard/filter/interceptor
│   ├── config/
│   │   └── env.validation.ts   # Zod validate — thiếu biến thì không boot
│   ├── common/
│   │   ├── decorators/         # @Public, @Roles, @CurrentUser
│   │   ├── filters/            # AllExceptionsFilter → RFC 7807
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   └── interceptors/       # ResponseInterceptor → { data, meta }
│   ├── infra/
│   │   └── prisma/             # PrismaService + PrismaModule (global)
│   └── modules/
│       ├── auth/               # login, refresh (rotation), logout, me
│       ├── admin/              # endpoint chẩn đoán RBAC
│       └── health/             # /health (liveness), /health/ready (DB)
├── tsconfig.json
├── nest-cli.json
└── package.json
```

Từ Phase 2 sẽ mở rộng thêm `modules/`: `campaigns/`, `rounds/`, `candidates/`, `evaluations/`, `audit/`, `queue/`, `mail/`.

## API hiện có

| Method | Endpoint | Quyền |
|---|---|---|
| `GET` | `/api/v1/health` | Public |
| `GET` | `/api/v1/health/ready` | Public (kiểm tra DB) |
| `POST` | `/api/v1/auth/login` | Public |
| `POST` | `/api/v1/auth/refresh` | Public (dùng cookie `ats_rt`) |
| `POST` | `/api/v1/auth/logout` | Public (thu hồi token) |
| `GET` | `/api/v1/auth/me` | Đã đăng nhập |
| `GET` | `/api/v1/admin/ping` | `ADMIN` |

## Quy ước

| Quy ước | Ghi chú |
|---|---|
| 1 thư mục = 1 module = 1 Epic | Dễ tìm, dễ chia việc |
| Controller chỉ nhận request, không chứa nghiệp vụ | Nghiệp vụ nằm ở `*.service.ts` |
| Không truy cập Prisma trực tiếp từ controller | Luôn qua service (dễ test) |
| `any` bị cấm | ESLint `no-explicit-any: error` |
| Mọi mutation ghi audit log | Qua `AuditInterceptor`, không viết tay từng chỗ |

## Tài liệu liên quan

- [Kiến trúc tổng thể](../README.md#4-kiến-trúc-hệ-thống)
- [ADR-0002 Blind Scoring](../docs/adr/0002-blind-scoring-at-data-layer.md)
- [ADR-0008 NestJS + Prisma](../docs/adr/0008-nestjs-prisma-stack.md)
