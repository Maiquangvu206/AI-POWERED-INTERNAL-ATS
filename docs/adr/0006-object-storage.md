# ADR-0006 — Lưu CV trên Object Storage (MinIO / S3)

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** US-03, ADR-0004

## Bối cảnh

ERD có cột `candidates.cv_file_url` nhưng **không xác định nơi lưu**. Nếu lưu local disk:

- File mất khi container restart / redeploy.
- Không chia sẻ được giữa nhiều replica API.
- Không thể backup độc lập với DB.
- Serve file qua Node.js sẽ chiếm băng thông và chặn Event Loop.

## Quyết định

Dùng **Object Storage tương thích S3**:

| Môi trường | Dịch vụ |
|---|---|
| Local dev | **RustFS** (xem `DECISIONS.md §6` — MinIO không còn publish image) |
| Production | AWS S3 / Cloudflare R2 |

Chi tiết:

- Bucket **private**, không bao giờ public-read (`storage-init` tạo bucket `cv-files`).
- Hướng upload đã chốt: **server-side stream** — Core API nhận `multipart`, tự kiểm tra nội dung rồi đẩy lên S3. Lý do: bắt buộc kiểm **magic-byte** (`%PDF`) ở server (US-03) và file chỉ ≤ 5 MB nên băng thông API không phải vấn đề. Presigned PUT bị loại vì phải tin `Content-Type` do client gửi.
- Truy cập file bằng **signed URL có TTL ngắn** (`S3_SIGNED_URL_TTL=300`, tối đa 3600).
- Key do server sinh: `cv/{YYYY}/{MM}/{uuid}.pdf` — không dùng tên file gốc (chống path traversal và lộ tên ứng viên). Khoá được lưu ở `candidates.cv_file_url`, không bao giờ trả ra ngoài.
- Chỉ object dưới prefix `cv/` mới được cấp signed URL (`StorageService.isManagedKey`).

## Hệ quả

**Tích cực**

- API stateless → scale ngang dễ dàng.
- Backup và vòng đời dữ liệu (retention 180 ngày) quản lý ở tầng storage.
- Chi phí thấp (R2 miễn phí egress).

**Tiêu cực**

- Thêm một thành phần hạ tầng cần cấu hình credential.
- Cần cơ chế dọn file mồ côi khi record candidate bị xoá.

## Phương án đã loại

- **Lưu PDF trong PostgreSQL (`bytea`)**: phình DB, backup chậm, không phù hợp file 5MB.
- **Local disk + volume**: không scale ngang được.
