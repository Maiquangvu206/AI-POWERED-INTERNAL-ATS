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
| Local dev | MinIO (Docker) |
| Production | AWS S3 / Cloudflare R2 |

Chi tiết:

- Bucket **private**, không bao giờ public-read.
- Upload theo 1 trong 2 hướng (chốt ở Phase 2 khi implement):
  - **Presigned PUT** — FE upload trực tiếp, giảm tải API.
  - **Server-side stream** — API nhận `multipart`, tự đẩy lên S3 (đơn giản hơn, kiểm soát magic-byte tốt hơn).
- Truy cập file bằng **signed URL có TTL ≤ 5 phút**.
- Key lưu theo cấu trúc `campaigns/{campaignId}/candidates/{candidateId}/{uuid}.pdf` — không dùng tên file gốc (chống path traversal và lộ tên ứng viên).

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
