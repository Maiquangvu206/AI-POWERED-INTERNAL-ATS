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
│   │   ├── prisma/             # PrismaService + PrismaModule (global)
│   │   ├── storage/            # S3Client, StorageService, kiểm magic-byte PDF
│   │   └── queue/              # BullMQ: cv-processing + DLQ + processor
│   └── modules/
│       ├── auth/               # login, refresh (rotation), logout, me
│       ├── admin/              # chẩn đoán RBAC, storage, queue
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
| `GET` | `/api/v1/admin/storage-probe/health` | `ADMIN` |
| `POST` | `/api/v1/admin/storage-probe` | `ADMIN` — multipart field `file`, PDF ≤ 5 MB |
| `GET` | `/api/v1/admin/storage-probe/download?key=` | `ADMIN` — signed URL mới |
| `POST` | `/api/v1/admin/queue-probe` | `ADMIN` — đẩy 1 job thử |
| `GET` | `/api/v1/admin/queue-probe` | `ADMIN` — counts + DLQ |
| `GET` | `/api/v1/admin/queue-probe/:id` | `ADMIN` — trạng thái job |

> Các endpoint `*-probe` là **dụng cụ chẩn đoán Phase 1**. Phase 2 sẽ bọc cùng service
> bằng API nghiệp vụ thật (`POST /public/apply`, re-process job...).

## Upload CV (ADR-0006)

- Server nhận `multipart`, giữ trong RAM, kiểm **4 byte đầu = `%PDF`** rồi mới đẩy lên RustFS.
- Giới hạn 5 MB dùng chung `CV_UPLOAD_LIMITS` từ `@ats/shared`.
- Key do server sinh: `cv/{YYYY}/{MM}/{uuid}.pdf`; bucket private, chỉ đọc qua signed URL TTL 300s.
- `sha256` của file được trả về để Phase 2 ghi vào `candidates.cv_file_hash`.

## Queue (ADR-0005)

| Thành phần | Giá trị |
|---|---|
| Queue | `cv-processing` |
| Retry | 3 lần, backoff exponential 5s (5s → 10s) |
| DLQ | `cv-processing-dlq` — chép job khi hết lượt thử, kèm `failedReason` |
| Phase 1 | Job ping `GET {AI_SERVICE_URL}/health`; Phase 3 gọi `/parse-cv` thật |

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
