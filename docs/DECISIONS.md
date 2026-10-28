# Decision Log — Phase 0

Ghi lại các quyết định **chưa đủ tầm ADR** nhưng cần thống nhất để tránh tranh cãi về sau.
Ngày chốt: **2026-10-28**.

---

## 1. Package manager: **npm workspaces** (không dùng pnpm)

| | |
|---|---|
| **Quyết định** | Dùng `npm workspaces` với `workspaces: ["backend", "frontend", "ai", "shared"]` |
| **Bối cảnh** | SRS/README ban đầu ghi pnpm; máy dev chưa cài pnpm |
| **Lý do** | Giảm phụ thuộc công cụ ngoài; npm 11 có sẵn cùng Node 24; đủ cho 4 package |
| **Hệ quả** | Bỏ `packageManager` field; mọi lệnh trong tài liệu chuyển sang `npm run -w <pkg>` |
| **Khi nào đổi** | Nếu số package > 10 hoặc cần cài đặt tiết kiệm dung lượng → cân nhắc pnpm lại |

## 2. Python: **3.13** (tài liệu ghi 3.12)

| | |
|---|---|
| **Quyết định** | `requires-python = ">=3.12"`, dev chạy trên Python 3.13.7 |
| **Lý do** | Máy dev chỉ có 3.13.7; FastAPI/Pydantic/uvicorn đã hỗ trợ đầy đủ |
| **Rủi ro** | `torch` / `sentence-transformers` trên 3.13 cần wheel mới (≥ 2.5). Nếu Phase 3 lỗi → hạ xuống 3.12 trong venv riêng |
| **Kiểm chứng** | Phase 3 phải chạy được `pip install -e ".[ai]"` trên 3.13, nếu không thì ghi ADR mới hạ version |

## 3. LLM provider: **OpenAI `gpt-4o-mini`** (mặc định, có adapter)

| | |
|---|---|
| **Quyết định** | `LLM_PROVIDER=openai`, model `gpt-4o-mini`; toàn bộ lời gọi đi qua interface `LlmClient` |
| **Lý do** | Rẻ, hỗ trợ JSON mode, latency thấp; đủ cho US-08 (sinh 3–5 câu hỏi) |
| **Hệ quả** | Phải có `LLM_API_KEY`; nếu không có key → dùng fallback template tĩnh |
| **Dự phòng** | `Ollama` (self-host, miễn phí) — chỉ cần implement thêm 1 adapter |

## 4. Embedding model: **`BAAI/bge-m3`**

| | |
|---|---|
| **Quyết định** | Dùng `bge-m3` thay cho `all-MiniLM-L6-v2` mặc định của Sentence-Transformers |
| **Lý do** | Đa ngôn ngữ Anh–Việt, context 8192 token (MiniLM chỉ 512), chất lượng retrieval cao hơn rõ rệt trên văn bản dài |
| **Chi phí** | Model ~2.2GB, RAM ~3GB khi load → AI Service cần ≥ 4GB RAM |
| **Fallback** | Nếu máy dev yếu: dùng `paraphrase-multilingual-MiniLM-L12-v2` (~470MB) qua biến `EMBEDDING_MODEL` |

## 5. Cổng AI Service: **8010** (tài liệu ghi 8000)

| | |
|---|---|
| **Quyết định** | AI Service chạy cổng **8010**, `AI_SERVICE_URL=http://localhost:8010` |
| **Bối cảnh** | Trên máy dev, cổng **8000 đang bị `php.exe` (PID 15052, `C:\php\php.exe`) chiếm** — uvicorn không thể bind |
| **Lý do** | Tránh phải tắt dịch vụ khác của máy; không ảnh hưởng logic nghiệp vụ |
| **Hệ quả** | Mọi tài liệu/script dùng 8010; khi deploy container vẫn có thể map về 8000 nếu muốn |

## 6. Object storage: **RustFS** thay cho MinIO

| | |
|---|---|
| **Quyết định** | Dùng `rustfs/rustfs` cho môi trường dev, S3/R2 cho production |
| **Bối cảnh** | MinIO ngừng publish Docker image (Docker Hub trả `pull access denied`, quay.io trả 401). `minio/mc` cũng không còn → không thể dùng để tạo bucket |
| **Lý do** | RustFS là S3-compatible, nhận `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY`, path-style nên **code backend không cần đổi** |
| **Hệ quả** | Tạo bucket bằng `amazon/aws-cli` thay vì `mc`. Console ở http://localhost:9001 |
| **Lưu ý** | Nếu sau này cần MinIO thật → chỉ đổi image trong compose, giữ nguyên biến `S3_*` |

## 7. Cổng PostgreSQL: **5433**

| | |
|---|---|
| **Quyết định** | `DATABASE_URL=postgresql://ats:ats_local_password@localhost:5433/ats` |
| **Bối cảnh** | Máy dev đã có PostgreSQL native chiếm 5432 |
| **Hệ quả** | Mọi tài liệu dùng 5433; container vẫn lắng nghe 5432 bên trong |

## 8. Khoá chính: **Int autoincrement** (tài liệu ghi bigint)

| | |
|---|---|
| **Quyết định** | `Int @id @default(autoincrement())` cho 7 bảng nghiệp vụ, `BigInt` chỉ cho `audit_logs` |
| **Lý do** | `BigInt` của Prisma map sang JS `BigInt` → lỗi `JSON.stringify` và mọi DTO phải convert thủ công; giới hạn 2.1 tỷ dòng là quá đủ |
| **Hệ quả** | Audit log dùng BigInt vì bảng này tăng nhanh và không bao giờ trả ra JSON trực tiếp |

## 9. Đường dẫn file `.env`

| | |
|---|---|
| **Quyết định** | Runtime đọc `backend/.env` (nếu có) rồi `../.env`; Prisma CLI chỉ đọc `backend/.env` |
| **Bối cảnh** | `@nestjs/config` **không merge** nhiều file theo kiểu fallback từng biến; `backend/.env` chỉ chứa `DATABASE_URL` nên thiếu `JWT_SECRET` |
| **Hệ quả** | `backend/.env` chỉ giữ `DATABASE_URL` (cho Prisma); mọi biến khác đặt ở `.env` gốc. Đã từng gây lỗi `JWT_SECRET: Required` khi đổi cấu trúc thư mục — nay cố định `../.env` |

## 10. Chiến lược upload CV: **quyết định ở Phase 2**

Hai phương án đã ghi trong ADR-0006, chưa chốt:

| Phương án | Ưu | Nhược |
|---|---|---|
| Presigned PUT (FE → S3 trực tiếp) | Giảm tải API, upload nhanh | Khó validate magic-byte ở server; phải tin client |
| Server-side stream (FE → API → S3) | Validate được magic-byte, ghi audit ngay | API phải chịu băng thông file |

**Xu hướng:** chọn **server-side stream** vì magic-byte check là yêu cầu bảo mật bắt buộc (US-03) và file chỉ ≤ 5MB.

---

## 6. Ghi chú môi trường phát triển

| Hạng mục | Trạng thái | Ảnh hưởng |
|---|---|---|
| Node.js | ✅ v24.16.0 | OK |
| npm | ✅ 11.13.0 | Dùng cho toàn bộ workspace |
| Python | ✅ 3.13.7 | OK (xem mục 2) |
| Git | ✅ 2.51.0, remote `Maiquangvu206/AI-POWERED-INTERNAL-ATS` | OK |
| **Docker** | ❌ **Chưa cài** (`docker` không có trên PATH, `C:\Program Files\Docker` không tồn tại) | **Block Phase 1** — cần Docker Desktop hoặc PostgreSQL/Redis/MinIO native |
| WSL2 | ❌ Chưa bật | Docker Desktop cần WSL2 hoặc Hyper-V |

### Việc cần làm trước Phase 1

1. Cài **Docker Desktop** (bật WSL2: `wsl --install` rồi reboot), **hoặc**
2. Cài native: PostgreSQL 16 + Redis (Memurai/WSL) + MinIO server, và cập nhật `DATABASE_URL` / `REDIS_URL` / `S3_ENDPOINT`.
