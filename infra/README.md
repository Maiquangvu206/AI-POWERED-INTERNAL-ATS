# Hạ tầng & chạy full stack bằng Docker Compose

Dựng toàn bộ dịch vụ bằng **một lệnh**, không cần cài native. Tên project, tên
container/volume và **toàn bộ port host** đều cấu hình được → chạy song song
nhiều dự án trên cùng máy mà không xung đột.

```bash
# 1. Cấu hình (chỉ cần làm 1 lần)
cp infra/.env.example infra/.env        # PowerShell: Copy-Item infra/.env.example infra/.env

# 2. Chạy chỉ hạ tầng (Postgres, Redis, RustFS, Mailpit)
docker compose -f infra/docker-compose.yml up -d

# 3. Chạy TOÀN BỘ hệ sinh thái (thêm core-api, ai-service, web)
docker compose -f infra/docker-compose.yml --profile app up -d --build
```

Hoặc dùng script npm ở root:

```bash
npm run infra:up        # chỉ hạ tầng
npm run docker:up       # full stack (build lại image)
npm run docker:ps
npm run docker:logs
npm run docker:down     # giữ dữ liệu; thêm -v để xoá sạch
```

## Dịch vụ

| Dịch vụ | Image / Dockerfile | Host port (mặc định) | Mục đích |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | **5433** → 5432 | DB chính |
| `redis` | `redis:7-alpine` | 6379 | BullMQ queue + cache |
| `rustfs` | `rustfs/rustfs` | 9000 / **9001** | Object storage CV (ADR-0006) |
| `storage-init` | `amazon/aws-cli` | — | Tạo bucket `cv-files` (private) rồi thoát |
| `mailpit` | `axllent/mailpit` | 1025 / **8025** | SMTP dev + UI đọc mail |
| `core-api` | `backend/Dockerfile` | **3000** | NestJS API + Swagger `/api/docs` |
| `ai-service` | `ai/Dockerfile` | **8010** | FastAPI (OCR tesseract vie+eng, bge-m3) |
| `web` | `frontend/Dockerfile` | **5173** | React build tĩnh, Nginx proxy `/api` → core-api |

Sau khi `--profile app` lên:

| URL | Kỳ vọng |
|---|---|
| http://localhost:5173 | Public Portal |
| http://localhost:5173/login | Đăng nhập (`admin@demo.com` / `Admin@123`) |
| http://localhost:3000/api/v1/health | `{"status":"ok",...}` |
| http://localhost:3000/api/docs | Swagger Core API |
| http://localhost:8010/health | AI Service |
| http://localhost:9001 | RustFS Console (`minioadmin` / `minioadmin`) |
| http://localhost:8025 | Mailpit |

> Lần chạy AI Service đầu tiên sẽ tải model `bge-m3` (cần internet, vài GB).
> Model được cache trong volume `ai-models` nên các lần sau không tải lại.
> Muốn chạy nhẹ: đặt `EMBEDDING_ENABLED=false` trong `infra/.env` (dùng lexical fallback).

## Chạy nhiều dự án cùng lúc

Mọi tài nguyên đều prefix theo `COMPOSE_PROJECT_NAME`, nên **tên** không bao giờ
xung đột. Chỉ cần mỗi dự án một **dải port riêng**.

```bash
# Dự án B: tạo file env riêng rồi trỏ compose vào
docker compose --env-file infra/.env.project-b -f infra/docker-compose.yml --profile app up -d
```

Ví dụ nội dung `infra/.env.project-b`:

```dotenv
COMPOSE_PROJECT_NAME=ats-b
ATS_POSTGRES_PORT=5533
ATS_REDIS_PORT=6479
ATS_RUSTFS_PORT=9100
ATS_RUSTFS_CONSOLE_PORT=9101
ATS_SMTP_PORT=1125
ATS_MAILPIT_PORT=8125
ATS_API_PORT=3100
ATS_AI_PORT=8110
ATS_WEB_PORT=5273
ATS_WEB_ORIGIN=http://localhost:5273
JWT_SECRET=du-an-b-jwt-secret-dai-hon-32-ky-tu-luon
AI_INTERNAL_TOKEN=du-an-b-internal-token
```

| Biến | Dự án A | Dự án B |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `ats` | `ats-b` |
| `ATS_POSTGRES_PORT` | 5433 | 5533 |
| `ATS_REDIS_PORT` | 6379 | 6479 |
| `ATS_RUSTFS_PORT` / console | 9000 / 9001 | 9100 / 9101 |
| `ATS_SMTP_PORT` / `ATS_MAILPIT_PORT` | 1025 / 8025 | 1125 / 8125 |
| `ATS_API_PORT` | 3000 | 3100 |
| `ATS_AI_PORT` | 8010 | 8110 |
| `ATS_WEB_PORT` | 5173 | 5273 |

Dừng/xoá đúng dự án:

```bash
docker compose --env-file infra/.env.project-b -f infra/docker-compose.yml --profile app down
```

## Kiểm tra nhanh

```bash
docker compose -f infra/docker-compose.yml --profile app ps

# Tên container có prefix project (vd: ats-postgres-1)
docker compose -f infra/docker-compose.yml exec postgres psql -U ats -d ats -c "\dt"
docker compose -f infra/docker-compose.yml exec redis redis-cli ping     # PONG

curl -I http://localhost:9000/minio/health/live                         # 200
curl -s http://localhost:8025/api/v1/info                               # JSON Mailpit
curl -s http://localhost:3000/api/v1/health                             # core-api
```

## Ghi chú thiết kế

| Lựa chọn | Lý do |
|---|---|
| `name: ${COMPOSE_PROJECT_NAME:-ats}` + không hard-code `container_name` | Cho phép nhiều project chạy song song; volume/network tách biệt theo project |
| Port qua biến `ATS_*_PORT` | Đổi port không cần sửa file compose, không đụng dự án khác |
| Backend dùng DNS nội bộ (`postgres`, `redis`, `rustfs`, `ai-service`) | Container không gọi `localhost` của host |
| Web phục vụ bởi Nginx + proxy `/api` | Cùng origin → không cần CORS, không lộ port API ra ngoài nếu muốn |
| `--maxmemory-policy noeviction` cho Redis | Nếu để `allkeys-lru`, Redis có thể **xoá job BullMQ** khi đầy RAM → mất hồ sơ không dấu vết |
| Volume `ai-models:/models` | Cache `bge-m3`, tránh tải lại nhiều GB mỗi lần restart |
| `storage-init` dùng `amazon/aws-cli` | `minio/mc` không còn image; aws-cli chạy với mọi S3-compatible |
| Bucket set `none` (private) | Bắt buộc — chỉ truy cập qua signed URL có TTL (ADR-0006) |
| `RUN_SEED=true` mặc định trong compose | Có ngay tài khoản demo; seed idempotent, chạy lại không nhân đôi dữ liệu |
