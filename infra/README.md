# Hạ tầng phát triển (Docker Compose)

Dựng toàn bộ dịch vụ phụ trợ bằng **một lệnh**, không cần cài native.

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs -f postgres
docker compose -f infra/docker-compose.yml down          # giữ dữ liệu
docker compose -f infra/docker-compose.yml down -v       # XOÁ toàn bộ dữ liệu
```

## Dịch vụ

| Dịch vụ | Image | Host port | Mục đích | Truy cập |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | **5433** → 5432 | DB chính | `psql postgresql://ats:ats_local_password@localhost:5433/ats` |
| `redis` | `redis:7-alpine` | 6379 | BullMQ queue + cache + rate limit | `docker exec -it ats-redis redis-cli` |
| `rustfs` | `rustfs/rustfs` | 9000 / **9001** | Object storage cho CV (ADR-0006) | Console http://localhost:9001 (`minioadmin` / `minioadmin`) |
| `storage-init` | `amazon/aws-cli` | — | Tạo bucket `cv-files` (private) rồi thoát | `docker logs ats-storage-init` |
| `mailpit` | `axllent/mailpit` | 1025 / **8025** | SMTP dev + UI đọc mail | http://localhost:8025 |

> **Vì sao Postgres ở 5433?** Máy dev đã có PostgreSQL native chạy ở 5432. Map ra 5433 để không xung đột, không phải tắt dịch vụ đang dùng.
>
> **Vì sao RustFS thay MinIO?** Từ 2025 MinIO ngừng publish Docker image (cả Docker Hub lẫn quay.io đều trả 401/not found). RustFS là storage S3-compatible, nhận biến `MINIO_ROOT_*`, dùng path-style nên **code backend không cần đổi** — chỉ đổi image.

## Kiểm tra nhanh

```bash
docker compose -f infra/docker-compose.yml ps          # tất cả "healthy" / "running"
docker exec -it ats-postgres psql -U ats -d ats -c "\dt"
docker exec -it ats-redis redis-cli ping              # PONG
curl -I http://localhost:9000/minio/health/live       # 200
curl -s http://localhost:8025/api/v1/info             # JSON của Mailpit
```

## Ghi chú thiết kế

| Lựa chọn | Lý do |
|---|---|
| `--maxmemory-policy noeviction` cho Redis | Nếu để mặc định `allkeys-lru`, Redis có thể **xoá job của BullMQ** khi đầy RAM → mất hồ sơ không dấu vết |
| Mailpit thay MailHog | MailHog không còn được bảo trì; Mailpit cùng cổng, có REST API để test tự động |
| `minio-init` dùng vòng lặp `until` | Không phụ thuộc healthcheck của image MinIO (image mới không có `curl`) |
| `storage-init` dùng `amazon/aws-cli` | `minio/mc` không còn image; aws-cli hoạt động với mọi S3-compatible |
| Bucket set `none` (private) | Bắt buộc — chỉ truy cập qua signed URL có TTL (ADR-0006) |
| Volume đặt tên (`postgres-data`...) | `down` không xoá dữ liệu; chỉ `down -v` mới xoá |
