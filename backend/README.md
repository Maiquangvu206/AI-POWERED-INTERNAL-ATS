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
│   │   ├── decorators/         # @Public, @Roles, @CurrentUser, @ClientMeta
│   │   ├── filters/            # AllExceptionsFilter → RFC 7807
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   └── interceptors/       # ResponseInterceptor → { data, meta }
│   ├── infra/
│   │   ├── prisma/             # PrismaService + PrismaModule (global)
│   │   ├── storage/            # S3Client, StorageService, kiểm magic-byte PDF
│   │   └── queue/              # BullMQ: cv-processing + DLQ + processor + QueueService
│   └── modules/
│       ├── auth/               # login, refresh (rotation), logout, me
│       ├── audit/              # AuditService — ghi append-only, lỗi không chặn nghiệp vụ
│       ├── campaigns/          # campaign + round + criteria (admin) + public listing
│       ├── candidates/         # nộp hồ sơ công khai, tra cứu, reprocess
│       ├── admin/              # chẩn đoán RBAC, storage, queue
│       └── health/             # /health (liveness), /health/ready (DB)
├── tsconfig.json
├── nest-cli.json
└── package.json
```

`evaluations/`, `mail/` sẽ được thêm ở Phase 4–5 (chấm điểm & thông báo).

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
| `GET` | `/api/v1/admin/campaigns` | `ADMIN` — `?status=&q=&page=&limit=` |
| `POST` | `/api/v1/admin/campaigns` | `ADMIN` |
| `GET` | `/api/v1/admin/campaigns/:id` | `ADMIN` — kèm rounds + criteria + totalWeight |
| `PATCH` | `/api/v1/admin/campaigns/:id` | `ADMIN` |
| `PATCH` | `/api/v1/admin/campaigns/:id/status` | `ADMIN` |
| `DELETE` | `/api/v1/admin/campaigns/:id` | `ADMIN` — chỉ `DRAFT`, chưa có hồ sơ |
| `GET` | `/api/v1/admin/campaigns/:id/rounds` | `ADMIN` |
| `POST` | `/api/v1/admin/campaigns/:id/rounds` | `ADMIN` |
| `GET` | `/api/v1/admin/campaigns/:id/rounds/:roundId` | `ADMIN` |
| `PATCH` | `/api/v1/admin/campaigns/:id/rounds/:roundId` | `ADMIN` — chỉ khi `PENDING` |
| `PATCH` | `/api/v1/admin/campaigns/:id/rounds/:roundId/status` | `ADMIN` |
| `DELETE` | `/api/v1/admin/campaigns/:id/rounds/:roundId` | `ADMIN` |
| `POST` | `/api/v1/admin/campaigns/:id/rounds/:roundId/criteria` | `ADMIN` |
| `PATCH` | `/api/v1/admin/campaigns/:id/rounds/:roundId/criteria/:criteriaId` | `ADMIN` |
| `DELETE` | `/api/v1/admin/campaigns/:id/rounds/:roundId/criteria/:criteriaId` | `ADMIN` |
| `GET` | `/api/v1/public/campaigns` | Public — mặc định `OPEN`, không trả `DRAFT` |
| `GET` | `/api/v1/public/campaigns/:slug` | Public — `404` nếu `DRAFT` |
| `POST` | `/api/v1/public/campaigns/:slug/apply` | Public — multipart field `cv` |
| `GET` | `/api/v1/public/track/:code` | Public — tên đã mask, không PII |
| `POST` | `/api/v1/admin/candidates/:id/reprocess` | `ADMIN` — đẩy lại job AI |

> Các endpoint `*-probe` là **dụng cụ chẩn đoán**. API nghiệp vụ thật đã có ở
> `campaigns/` và `candidates/`.

## Quy tắc nghiệp vụ (Phase 2)

| Quy tắc | Hành vi |
|---|---|
| Slug campaign | Sinh từ `title` (bỏ dấu tiếng Việt), unique bằng hậu tố `-2`, `-3`…; **bất biến** sau khi tạo |
| Trạng thái campaign | Chỉ `DRAFT → OPEN → CLOSED`; không nhảy cóc, không quay lại; `CLOSED` không sửa được |
| Xoá campaign | Chỉ `DRAFT` và chưa có hồ sơ |
| `order_index` vòng | Tự tăng theo campaign nếu bỏ trống; unique trong campaign |
| Rubric | Chỉ thêm/sửa/xoá khi vòng `PENDING`; chặn thêm nếu tổng weight vượt `1.000` |
| Bắt đầu chấm | `PENDING → IN_PROGRESS` yêu cầu `SUM(weight) = 1.000 ± 0.001` và có ≥ 1 tiêu chí |
| Khoá vòng | `IN_PROGRESS → LOCKED`, ghi `locked_at` + `locked_by`; không mở lại |
| Nhận hồ sơ | Campaign phải `OPEN` **và** hôm nay nằm trong `[start_date, end_date]` |
| Mã tra cứu | `APP-YYYY-XXXX`, alphabet bỏ `I/O/0/1`, retry 3 lần nếu trùng unique |
| Tra cứu công khai | Chỉ trả tên đã mask (`N***** V** A*`), status, campaign, currentRound — **không** email/phone/điểm |
| Bù trừ upload | Ghi DB thất bại sau upload → xoá object khỏi RustFS (không file mồ côi) |
| Audit | Mọi mutation ghi `audit_logs` (`campaign.*`, `round.*`, `criteria.*`, `candidate.*`); lỗi ghi audit chỉ log, không làm hỏng nghiệp vụ |

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
| Payload | `{ type: 'CV_PROCESSING', version: 1, candidateId?, objectKey?, probe?, reattempt? }`; payload lạ → `UnrecoverableError` → DLQ ngay |
| Enqueue | Chỉ qua `QueueService.enqueueCvProcessing()` — không gọi `queue.add` rải rác |
| Reprocess | `POST /admin/candidates/:id/reprocess` đẩy lại job cho một hồ sơ |
| Phase 3 | Thay phần thân worker bằng gọi `/parse-cv` thật và ghi kết quả vào `candidates` |

## Quy ước

| Quy ước | Ghi chú |
|---|---|
| 1 thư mục = 1 module = 1 Epic | Dễ tìm, dễ chia việc |
| Controller chỉ nhận request, không chứa nghiệp vụ | Nghiệp vụ nằm ở `*.service.ts` |
| Không truy cập Prisma trực tiếp từ controller | Luôn qua service (dễ test) |
| `any` bị cấm | ESLint `no-explicit-any: error` |
| Mọi mutation ghi audit log | Qua `AuditService.record()` (append-only), lỗi audit không chặn nghiệp vụ |

## Tài liệu liên quan

- [Kiến trúc tổng thể](../README.md#4-kiến-trúc-hệ-thống)
- [ADR-0002 Blind Scoring](../docs/adr/0002-blind-scoring-at-data-layer.md)
- [ADR-0008 NestJS + Prisma](../docs/adr/0008-nestjs-prisma-stack.md)
