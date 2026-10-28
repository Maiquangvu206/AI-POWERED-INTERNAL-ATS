# Decision Log — Phase 0–2

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

## 10. Chiến lược upload CV: **server-side stream** (đã chốt ở Phase 1)

| | |
|---|---|
| **Quyết định** | FE gửi `multipart/form-data` → Core API → RustFS. Không dùng presigned PUT |
| **Lý do** | Bắt buộc kiểm **magic-byte** (`%PDF`) ở server (US-03); presigned PUT chỉ kiểm được `Content-Type` do client khai |
| **Giới hạn** | 5 MB (`CV_UPLOAD_LIMITS` trong `@ats/shared`), chỉ PDF, 1 file/request |
| **Kiểm tra** | 4 byte đầu phải là `%PDF`; file > 5 MB bị Multer chặn → **413**; nội dung sai → **400** |
| **Key** | `cv/{YYYY}/{MM}/{uuid}.pdf` — server sinh, không dùng tên gốc |
| **Đọc file** | Chỉ qua signed URL TTL 300s; key ngoài prefix `cv/` bị từ chối |

## 11. Hàng đợi: **BullMQ + DLQ tự dựng**

| | |
|---|---|
| **Quyết định** | Queue `cv-processing`, `attempts: 3`, backoff exponential **5000ms** (5s → 10s), `removeOnComplete: 100` |
| **DLQ** | BullMQ không có DLQ sẵn → khi `attemptsMade >= attempts`, processor ghi job vào `cv-processing-dlq` kèm `failedReason`, `originalJobId` |
| **Vì sao không auto-remove job chết** | `removeOnFail: 500` giữ lại 500 job lỗi gần nhất để điều tra |
| **Redis** | `maxmemory-policy noeviction` — nếu evict, job biến mất không dấu vết |
| **Payload** | Có `type` + `version` (`{ type: 'CV_PROCESSING', version: 1 }`); payload sai schema → `UnrecoverableError` → DLQ ngay, không retry vô ích |
| **Giai đoạn** | Phase 1–2 job chỉ `GET /health` của AI Service để chứng minh đường ống; Phase 3 thay bằng gọi `/parse-cv` thật |
| **Reprocess** | `POST /admin/candidates/:id/reprocess` đẩy lại job cùng `candidateId`/`objectKey`; jobId có timestamp nên không bị BullMQ coi là trùng |

---

## 12. Slug campaign: sinh tự động & **bất biến**

| | |
|---|---|
| **Quyết định** | `slug` sinh từ `title` (bỏ dấu tiếng Việt, `đ → d`, lowercase, gộp ký tự lạ thành `-`), unique bằng hậu tố `-2`, `-3`…; sau khi tạo **không đổi** dù `title` thay đổi |
| **Lý do** | Slug là URL công khai đã chia sẻ cho ứng viên; đổi slug sẽ làm chết link cũ và phá SEO |
| **Hệ quả** | `PATCH /admin/campaigns/:id` bỏ qua `slug`; nếu cần slug mới phải tạo campaign mới |
| **Trùng lặp** | Vòng lặp thử tối đa 20 hậu tố, map `P2002` → thử tiếp; hết lượt → `409` |

## 13. Rubric chỉ sửa khi vòng `PENDING`

| | |
|---|---|
| **Quyết định** | Thêm/sửa/xoá `criteria` chỉ được phép khi round ở `PENDING` và campaign chưa `CLOSED` |
| **Lý do** | Đổi `weight`/`maxScore` sau khi đã có phiếu điểm sẽ làm sai toàn bộ điểm đã chấm và phá tính so sánh |
| **Điều kiện bắt đầu** | `PENDING → IN_PROGRESS` yêu cầu ≥ 1 tiêu chí và `SUM(weight) = 1.000 ± 0.001` |
| **Chặn sớm** | Khi thêm tiêu chí, nếu tổng weight sau khi thêm > `1.001` → `409` ngay, không đợi đến lúc chuyển trạng thái |
| **Xoá tiêu chí** | Nếu đã có `evaluation_details` tham chiếu → map `P2003/P2014` → `409` |

## 14. Mã tra cứu: alphabet không gây nhầm + che tên

| | |
|---|---|
| **Quyết định** | `APP-YYYY-XXXX`; 4 ký tự ngẫu nhiên lấy từ `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (bỏ `I`, `O`, `0`, `1`); sinh bằng `crypto.randomInt`, retry 3 lần khi trùng unique |
| **Lý do** | Ứng viên thường đọc/ghi mã qua điện thoại hoặc giấy; `I` vs `1`, `O` vs `0` là nguồn lỗi phổ biến (ADR-04) |
| **Độ mạnh** | 32^4 ≈ 1.05 triệu tổ hợp/năm; đủ chống enumerate nhưng **không** thay thế rate limiting (Phase 7) |
| **Tra cứu công khai** | Chỉ trả tên đã mask (`Nguyễn Văn An` → `N***** V** A*`), `status`, `campaign`, `currentRound`; tuyệt đối không trả email/phone/điểm |
| **Không tìm thấy** | Trả `404` thay vì `403` để không xác nhận mã có tồn tại hay không |

## 15. Audit log: ghi một chiều, lỗi **không** chặn nghiệp vụ

| | |
|---|---|
| **Quyết định** | `AuditService.record()` bọc `try/catch`; ghi thất bại chỉ `logger.error`, không ném lại |
| **Lý do** | Trigger DB đã chặn UPDATE/DELETE trên `audit_logs`; nếu lỗi ghi audit làm rollback nghiệp vụ thì một sự cố log có thể chặn nộp hồ sơ |
| **Đánh đổi** | Có thể mất một dòng audit khi DB lỗi tạm thời; chấp nhận vì nghiệp vụ ưu tiên hơn |
| **Phạm vi** | `campaign.create/update/status_change/delete`, `round.create/update/status_change/lock/delete`, `criteria.create/update/delete`, `candidate.apply/reprocess` |

## 16. Ghi chú môi trường phát triển

| Hạng mục | Trạng thái | Ảnh hưởng |
|---|---|---|
| Node.js | ✅ v24.16.0 | OK |
| npm | ✅ 11.13.0 | Dùng cho toàn bộ workspace |
| Python | ✅ 3.13.7 | OK (xem mục 2) |
| Git | ✅ 2.51.0, remote `Maiquangvu206/AI-POWERED-INTERNAL-ATS` | OK |
| **Docker Desktop** | ✅ 29.9.2 (Server chạy, compose v5.6.1) | Hạ tầng dựng bằng `npm run infra:up` |
| PostgreSQL native | ⚠️ chiếm cổng 5432 | Container map ra **5433** (mục 7) |
| `php.exe` | ⚠️ chiếm cổng 8000 | AI Service dùng **8010** (mục 5) |
