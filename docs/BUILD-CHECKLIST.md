# Build Checklist — AI-Powered Internal ATS

> Checklist thực thi từ **con số 0** tới **sản phẩm chạy được, demo được, bảo vệ được**.
>
> Cách dùng: tick theo thứ tự phase. Mỗi phase có **Definition of Done (DoD)** — chỉ được chuyển phase khi DoD đã đạt và có *bằng chứng* (commit, screenshot, log, test report).
>
> Ước lượng: **6 tuần** cho 1 lập trình viên full-time. Mỗi phase ≈ 3–5 ngày.

---

## Mục lục

- [Phase 0 — Chuẩn bị & Chốt đặc tả](#phase-0--chuẩn-bị--chốt-đặc-tả-ngày-1)
- [Phase 1 — Hạ tầng & Xương sống](#phase-1--hạ-tầng--xương-sống-ngày-2-5)
- [Phase 2 — Nghiệp vụ Core](#phase-2--nghiệp-vụ-core-ngày-6-10)
- [Phase 3 — AI Pipeline](#phase-3--ai-pipeline-ngày-11-16)
- [Phase 4 — Đánh giá & Blind Scoring](#phase-4--đánh-giá--blind-scoring-ngày-17-21)
- [Phase 5 — Thông báo & AI Copilot](#phase-5--thông-báo--ai-copilot-ngày-22-24)
- [Phase 6 — Frontend ba portal](#phase-6--frontend-ba-portal-ngày-25-31)
- [Phase 7 — Bảo mật & Hardening](#phase-7--bảo-mật--hardening-ngày-32-35)
- [Phase 8 — Kiểm thử & Chất lượng](#phase-8--kiểm-thử--chất-lượng-ngày-36-38)
- [Phase 9 — DevOps & Phát hành](#phase-9--devops--phát-hành-ngày-39-41)
- [Phase 10 — Demo & Portfolio](#phase-10--demo--portfolio-ngày-42)
- [Quality Gates](#quality-gates)
- [Rủi ro & Cách chặn](#rủi-ro--cách-chặn)

---

## Phase 0 — Chuẩn bị & Chốt đặc tả (Ngày 1)

### 0.1. Chốt tài liệu

- [ ] SRS v2.0.0 đã được review, không còn mâu thuẫn nội tại
- [ ] Chốt **ADR-05**: Message Queue thay cho HTTP call trực tiếp (đã ghi trong README)
- [ ] Chốt **ADR-06**: Object Storage (MinIO dev / S3 prod)
- [ ] Chốt **ADR-08**: NestJS + Prisma làm Core API
- [ ] Chốt nhà cung cấp LLM cho US-08 (khuyến nghị: OpenAI `gpt-4o-mini` cho dev, có adapter để swap)
- [ ] Chốt mô hình embedding (`bge-m3` — đa ngôn ngữ Anh–Việt)
- [ ] Xác nhận phạm vi MVP: **8 User Story = 39 SP**, không thêm feature mới trước Phase 9

### 0.2. Môi trường & công cụ

- [ ] Cài Node.js 22 LTS, npm 10, Python 3.12+, Docker Desktop, Git
- [ ] Cấu hình Git: `user.name`, `user.email`, `core.autocrlf`
- [ ] `.editorconfig` + `.gitignore` (bỏ `.env`, `node_modules`, `__pycache__`, `*.pdf` upload test)
- [ ] Pre-commit hook: ESLint + Prettier + Ruff (dùng `husky` + `lint-staged`)
- [ ] `commitlint` theo Conventional Commits
- [ ] Tạo GitHub repo, bật branch protection cho `main`
- [ ] Tạo `.env.example` với **đầy đủ** biến (DB_URL, REDIS_URL, JWT_SECRET, S3_*, SMTP_*, LLM_API_KEY)

### 0.3. Khung repository

- [ ] Monorepo npm workspaces: `backend`, `frontend`, `ai`, `shared`
- [ ] `docs/adr/` với 8 file ADR (01→08)
- [ ] `docs/diagrams/` chứa Mermaid source
- [ ] `Makefile` hoặc `package.json` scripts thống nhất: `dev`, `build`, `test`, `lint`, `migrate`, `seed`

**DoD Phase 0:** `git clone` → `cp .env.example .env` → đọc README là hiểu toàn bộ hệ thống trong 10 phút. Không còn quyết định kỹ thuật nào bị treo.

---

## Phase 1 — Hạ tầng & Xương sống (Ngày 2–5)

### 1.1. Docker Compose

- [ ] `infra/docker-compose.yml` gồm: `postgres:16`, `redis:7`, `minio`, `mailhog`
- [ ] Volume bền vững cho Postgres và MinIO
- [ ] Healthcheck cho cả 4 service
- [ ] `docker compose up -d` chạy sạch, không warning
- [ ] Script `infra/init-minio.sh` tạo bucket `cv-files` (private) + bucket `avatars`
- [ ] `.env` map đúng cổng: Postgres 5432, Redis 6379, MinIO 9000/9001, MailHog 1025/8025

**Verify:** `docker compose ps` → tất cả `healthy`; mở `http://localhost:9001` đăng nhập MinIO được; `http://localhost:8025` thấy MailHog.

### 1.2. Database Schema

- [ ] `prisma/schema.prisma` mô tả đủ 7 bảng: `users`, `campaigns`, `rounds`, `criteria`, `candidates`, `evaluations`, `evaluation_details`
- [ ] Thêm bảng thứ 8: `audit_logs` (ADR-07)
- [ ] Enum đúng SRS: `Role`, `UserStatus`, `CampaignStatus`, `RoundStatus`, `FinalStatus`
- [ ] `candidates.ai_parsed_skills` dùng `Json` (jsonb)
- [ ] `candidates.ai_match_score` **nullable** + có `ai_processed_at`, `ai_error` (chịu lỗi AI)
- [ ] UNIQUE `(round_id, candidate_id, interviewer_id)` trên `evaluations`
- [ ] UNIQUE index `candidates.tracking_code`
- [ ] Index `(campaign_id, ai_match_score DESC NULLS LAST)`
- [ ] CHECK `criteria.weight` trong `[0,1]`
- [ ] Migration đầu tiên chạy thành công: `prisma migrate dev --name init`
- [ ] Bật `prisma studio` kiểm tra bảng

**Verify:** `psql` → `\d evaluations` thấy constraint UNIQUE; `EXPLAIN ANALYZE` query xếp hạng dùng index.

### 1.3. Khung NestJS

- [ ] `nest new` với strict TypeScript
- [ ] Cấu trúc module: `auth`, `users`, `campaigns`, `rounds`, `candidates`, `evaluations`, `audit`, `queue`, `storage`, `mail`
- [ ] `PrismaModule` global, `ConfigModule` validate bằng Zod/Joi (fail-fast nếu thiếu env)
- [ ] Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`)
- [ ] Global exception filter → **RFC 7807** `application/problem+json`
- [ ] Response interceptor → envelope `{ data, meta }`
- [ ] `LoggerModule` (Pino) + request-id middleware
- [ ] Swagger tại `/api/docs`, có Bearer auth

**Verify:** `GET /api/docs` render; gọi endpoint sai body trả 422 đúng format problem+json.

### 1.4. Auth & RBAC

- [ ] `users` seed: 1 admin, 3 interviewer (password hash bcrypt cost 12)
- [ ] `POST /auth/login` → Access Token 15m + Refresh Cookie 7d
- [ ] Cookie: `HttpOnly`, `Secure` (theo env), `SameSite=Strict`, `Path=/api/v1/auth`
- [ ] `POST /auth/refresh` có **rotation** (thu hồi token cũ, lưu hash trong `users.refresh_token`)
- [ ] `POST /auth/logout` xoá refresh token trong DB + clear cookie
- [ ] `JwtAuthGuard` toàn cục, `@Public()` decorator để mở endpoint
- [ ] `RolesGuard` + `@Roles(Role.ADMIN)`
- [ ] Test: gọi endpoint Admin bằng token Interviewer → **403**

**Verify:** Postman/Thunder Client collection `auth.http` chạy 5 case: login đúng, login sai (401), refresh, refresh bằng token cũ (401), logout.

**DoD Phase 1:** Dựng hạ tầng một lệnh; đăng nhập được; RBAC chặn đúng; migration + seed chạy lại được từ DB trống.

---

## Phase 2 — Nghiệp vụ Core (Ngày 6–10)

### 2.1. Campaign (US-02)

- [ ] CRUD campaign với `slug` tự sinh từ title (unique, có xử lý trùng)
- [ ] Validate: `start_date < end_date`, không tạo campaign khi thiếu JD
- [ ] Chuyển trạng thái `DRAFT → OPEN → CLOSED` có state machine (không cho nhảy cóc)
- [ ] `GET /public/campaigns?status=OPEN` chỉ trả campaign đang mở

### 2.2. Round & Criteria (US-02)

- [ ] Tạo nhiều round cho campaign, `order_index` duy nhất trong campaign
- [ ] CRUD criteria trong round: `title`, `max_score`, `weight`
- [ ] **Validate `SUM(weight) = 1.00`** trước khi cho round chuyển `IN_PROGRESS` (dùng tolerance 0.001)
- [ ] Chặn xoá criterion nếu đã có `evaluation_details` tham chiếu
- [ ] Chặn sửa rubric khi round đã `LOCKED`

### 2.3. Public Application (US-03)

- [ ] `POST /public/campaigns/:slug/apply` nhận `multipart/form-data`
- [ ] Validate file: **magic bytes** `%PDF-`, ≤ 5MB, chỉ 1 file
- [ ] Sanitize input: `full_name` (2–100 ký tự), `email` (RFC), `phone` (E.164 hoặc VN format)
- [ ] Sinh `tracking_code` dạng `APP-YYYY-XXXX` — **retry 3 lần** nếu trùng unique
- [ ] Upload file lên MinIO qua Presigned URL hoặc server-side stream (chọn 1 và ghi vào ADR)
- [ ] Lưu `candidates` với `final_status = PENDING`
- [ ] Enqueue job `CV_PROCESSING` (Phase 3 sẽ implement worker)
- [ ] Trả `201` + `{ tracking_code }`
- [ ] `GET /public/track/:code` — chỉ trả `full_name` (đã mask), `status`, `current_round`, **không** trả điểm chi tiết/email/phone

### 2.4. BullMQ

- [ ] `QueueModule` cấu hình connection Redis, prefix `ats:`
- [ ] Queue `cv-processing`: `attempts: 3`, `backoff: exponential 5s`, `removeOnComplete: 100`
- [ ] Dead-letter queue `cv-processing-dlq`
- [ ] Job payload có type + version (để migrate schema job sau này)
- [ ] Endpoint admin `POST /admin/candidates/:id/reprocess` để chạy lại job

**DoD Phase 2:** Nộp CV qua Postman → DB có record → file nằm trong MinIO → job nằm trong Redis (`bull-board` hoặc `redis-cli KEYS`).

---

## Phase 3 — AI Pipeline (Ngày 11–16)

### 3.1. Khung FastAPI

- [ ] `app/main.py` + `settings.py` (Pydantic Settings)
- [ ] `/health` trả `{ status, model_loaded, version }`
- [ ] API key nội bộ (`X-Internal-Token`) cho mọi endpoint `/internal/*`
- [ ] Structured logging + request-id đồng bộ với Core API
- [ ] Dockerfile riêng, image ≤ 1.5GB (dùng `python:3.12-slim`, pre-download model ở build stage)

### 3.2. Trích xuất CV

- [ ] `pdfplumber` extract text theo từng trang
- [ ] **OCR fallback** khi text < 50 từ: `pdf2image` + `pytesseract` (`vie+eng`)
- [ ] Xử lý layout 2 cột: extract theo `x0` để gộp đúng thứ tự
- [ ] Chuẩn hoá: gộp dòng bị ngắt, bỏ header/footer lặp, chuẩn hoá Unicode tiếng Việt (NFC)
- [ ] Cắt section: `summary`, `experience`, `education`, `skills`, `projects`
- [ ] Trả về `raw_text` + `sections` + `page_count` + `extraction_method` (`text` | `ocr`)
- [ ] Test với 10 CV mẫu: 5 text-based, 3 scan, 2 Canva 2 cột

### 3.3. Information Extraction

- [ ] Định nghĩa `CandidateProfile` bằng Pydantic: `skills[]`, `total_years_experience`, `roles[]`, `education_level`, `languages[]`
- [ ] Dùng LLM **structured output (JSON mode)** hoặc NER để điền schema
- [ ] Skill normalization: map synonym (`JS` → `JavaScript`, `Postgres` → `PostgreSQL`) qua `skills-dictionary.json`
- [ ] Validate output bằng Pydantic — nếu fail thì retry 1 lần rồi fallback heuristic (regex)
- [ ] **Mask PII trước khi gửi LLM** (tên, SĐT, email, địa chỉ, CCCD)

### 3.4. Hybrid Matching Engine

- [ ] **Hard match (40%)**: Jaccard giữa `required_skills` (từ JD) và `candidate.skills`
- [ ] **Semantic match (40%)**: cosine similarity `bge-m3` giữa section `experience` và JD (chunk 512 token, lấy max/mean)
- [ ] **Tiêu chí phụ (20%)**: years of experience (bucket hoá), education level (thang bậc)
- [ ] Công thức ghi rõ trong docstring + unit test từng thành phần
- [ ] Trả output **giải thích được**: `{ score, matched_skills[], missing_skills[], breakdown: {hard, semantic, extra}, reasoning }`
- [ ] Lưu `breakdown` vào `candidates.ai_match_breakdown` (jsonb) để UI hiển thị
- [ ] Latency mục tiêu: **< 8s/CV** (không tính OCR)

### 3.5. Tích hợp vào queue

- [ ] Worker trong Core API (hoặc worker Python riêng) consume `CV_PROCESSING`
- [ ] Gọi `POST /internal/v1/ai/analyze` với `{ cv_url, jd_text, required_skills }`
- [ ] Ghi `ai_match_score`, `ai_parsed_skills`, `ai_match_breakdown`, `ai_processed_at`
- [ ] Lỗi → `ai_error` + đẩy vào DLQ, **không** làm hỏng record candidate
- [ ] Metric: `ai_processing_duration_seconds`, `ai_jobs_failed_total`

**DoD Phase 3:** Nộp 10 CV → 10 record có điểm trong < 2 phút; ít nhất 1 CV scan được OCR thành công; xem được breakdown điểm trên Prisma Studio.

---

## Phase 4 — Đánh giá & Blind Scoring (Ngày 17–21)

### 4.1. Gán ứng viên vào vòng

- [ ] Admin chuyển ứng viên sang round tiếp theo (`candidates.current_round_id`)
- [ ] Round phải ở `IN_PROGRESS` mới nhận ứng viên
- [ ] Ghi `audit_logs` cho mỗi lần chuyển vòng

### 4.2. Nộp phiếu điểm (US-05)

- [ ] `POST /evaluations` với `{ round_id, candidate_id, scores: [{criterion_id, score, comment}] }`
- [ ] Guard: round `IN_PROGRESS`, candidate thuộc round, criterion thuộc round
- [ ] Validate `0 ≤ score ≤ max_score` cho từng criterion
- [ ] Validate **đủ tất cả criterion** của round (không cho nộp thiếu)
- [ ] `INTERACTIVE TRANSACTION` (Prisma `$transaction`): insert `evaluations` + N `evaluation_details`
- [ ] `total_score` = tổng `score × weight` — tính trong transaction
- [ ] UNIQUE constraint chặn double-submit → map lỗi Prisma `P2002` thành **409 Conflict** thân thiện
- [ ] Cho phép **sửa** phiếu khi round còn `IN_PROGRESS` (upsert), ghi audit log `evaluation.update`
- [ ] Trả `400` với message rõ ràng nếu round `LOCKED`

### 4.3. Blind Scoring (US-06)

- [ ] `GET /rounds/:id/scores?candidate_id=`:
  - Interviewer → `WHERE interviewer_id = :me`
  - Admin → toàn bộ
- [ ] Không trả `interviewer_id`/`interviewer_name` cho Interviewer
- [ ] Test bảo mật: interviewer A gọi API với `candidate_id` của interviewer B → **không** thấy dữ liệu
- [ ] Test: gọi trực tiếp bằng `curl` (bypass UI) vẫn bị lọc
- [ ] Xác nhận response KHÔNG chứa `total_score` của người khác

### 4.4. Lock Round & Unblind

- [ ] `POST /admin/rounds/:id/lock` chỉ Admin
- [ ] Chỉ lock được khi round `IN_PROGRESS`
- [ ] Sau lock: mọi `POST /evaluations` trả `400`
- [ ] Tính điểm tổng hợp: trung bình có trọng số của tất cả giám khảo
- [ ] **Outlier detection**: nếu độ lệch chuẩn > 2.0 hoặc max-min > 3.0 → gắn cờ `discrepancy_warning`
- [ ] Audit log `round.lock` kèm `actor_id`, `timestamp`, `ip`
- [ ] Mở unblind: Admin xem được toàn bộ bảng điểm sau lock

**DoD Phase 4:** Kịch bản 3 giám khảo chấm độc lập → không ai thấy điểm ai → Admin lock → tất cả thấy điểm + cảnh báo chênh lệch. Quay video làm bằng chứng.

---

## Phase 5 — Thông báo & AI Copilot (Ngày 22–24)

### 5.1. Email (US-07)

- [ ] `MailModule` + BullMQ queue `email`
- [ ] Template MJML/Handlebars: `application-received`, `round-result`, `final-result`
- [ ] Gửi **bất đồng bộ** — request không chờ SMTP
- [ ] Retry 3 lần, DLQ sau đó
- [ ] Rate limit gửi theo ứng viên (tránh spam khi retry loop)
- [ ] Test bằng MailHog: xem được HTML render đúng, tiếng Việt không lỗi font

### 5.2. AI Copilot (US-08)

- [ ] `POST /ai/copilot/questions` (Interviewer) — trả 3–5 câu hỏi
- [ ] Input: `candidate.ai_parsed_skills`, `missing_skills`, `jd_text`, `round.name`
- [ ] Prompt template có guardrail: **không** sinh câu hỏi về tuổi/giới tính/tôn giáo/hôn nhân (vi phạm luật lao động)
- [ ] Output JSON: `[{ question, rationale, expected_signals[] }]`
- [ ] Cache theo `(candidate_id, round_id)` — TTL 24h (Redis)
- [ ] Rate limit: 10 request/giám khảo/giờ
- [ ] Fallback khi LLM lỗi: trả template câu hỏi tĩnh theo kỹ năng thiếu
- [ ] UI hiển thị disclaimer "Gợi ý do AI tạo, cần giám khảo thẩm định"

**DoD Phase 5:** Nộp đơn → nhận email trong MailHog < 5s. Giám khảo bấm "Gợi ý câu hỏi" → 5 câu hỏi liên quan đúng skill gap.

---

## Phase 6 — Frontend ba portal (Ngày 25–31)

### 6.1. Nền tảng

- [ ] Vite + React 19 + TypeScript strict
- [ ] Tailwind + shadcn/ui, dark mode
- [ ] TanStack Query (server state) + Zustand (UI state nhỏ)
- [ ] React Hook Form + Zod, schema import từ `@ats/shared`
- [ ] Axios instance: baseURL, withCredentials, interceptor refresh-on-401 (**queue request** khi đang refresh)
- [ ] Router theo role: `/`, `/portal`, `/admin`
- [ ] i18n `vi` mặc định (chuẩn bị `en`)
- [ ] Error boundary + skeleton loading + empty state cho mọi list

### 6.2. Public Portal

- [ ] `/careers` — danh sách campaign `OPEN`
- [ ] `/careers/:slug` — chi tiết JD + form nộp
- [ ] Form: drag & drop PDF, preview tên file, validate client (5MB/PDF) **và** hiển thị lỗi từ server
- [ ] Success screen: hiển thị `tracking_code` **to, copy được**, nút "Tải biên nhận PDF"
- [ ] `/track` — nhập mã, hiển thị timeline trạng thái (stepper)
- [ ] `/track/:code` hỗ trợ deep link từ email
- [ ] Mobile responsive (phần lớn ứng viên dùng điện thoại)

### 6.3. Interviewer Portal

- [ ] Danh sách ứng viên được gán theo round
- [ ] Card ứng viên: tên, điểm AI, **skills matched/missing**, link CV (signed URL)
- [ ] Form chấm điểm: mỗi criterion 1 slider/input + comment, hiển thị `weight` và điểm tạm tính
- [ ] Autosave draft (localStorage) để không mất điểm khi mất mạng
- [ ] Cảnh báo khi rời trang mà chưa submit
- [ ] **Không** render bất kỳ điểm nào của giám khảo khác (kiểm tra Network tab)
- [ ] Panel AI Copilot bên phải: nút sinh câu hỏi, danh sách câu hỏi có thể copy

### 6.4. Admin Dashboard

- [ ] Bảng campaign + CRUD
- [ ] Builder round & rubric (kéo thả, hiển thị tổng weight realtime, cảnh báo nếu ≠ 100%)
- [ ] Bảng ứng viên: sort theo `ai_match_score`, filter theo round/status, search theo tên/email/mã
- [ ] Chi tiết ứng viên: CV preview (iframe signed URL), breakdown AI (bar chart 3 thành phần)
- [ ] Nút **Lock Round** có confirm 2 bước + hiển thị số phiếu đã nộp/ tổng giám khảo
- [ ] Bảng điểm sau lock: matrix giám khảo × criteria, highlight outlier
- [ ] Trang Audit Log: filter theo actor/action/time
- [ ] Biểu đồ: phân bổ điểm, funnel theo vòng

**DoD Phase 6:** Demo trọn luồng trên **điện thoại** (public) và **desktop** (interviewer/admin) mà không cần Postman.

---

## Phase 7 — Bảo mật & Hardening (Ngày 32–35)

### 7.1. Chống lạm dụng

- [ ] Rate limit Redis: apply `5/IP/giờ`, track `20/IP/10 phút`, login `10/IP/15 phút`
- [ ] CAPTCHA (Cloudflare Turnstile) trên form apply & track
- [ ] Chặn upload trùng: hash SHA-256 file, cảnh báo nếu cùng ứng viên nộp lại trong 24h
- [ ] **ClamAV** scan file trước khi cho AI đọc (hoặc chạy async, quarantine nếu nhiễm)

### 7.2. Cứng hoá auth

- [ ] Password policy: ≥ 8 ký tự, có hoa/thường/số
- [ ] Chống brute-force: khoá tài khoản 15 phút sau 5 lần sai
- [ ] JWT: `iss`, `aud`, `jti`, thời hạn ngắn; secret ≥ 256-bit
- [ ] Helmet, CORS whitelist chính xác (không `*`)
- [ ] CSRF: SameSite=Strict + double-submit token nếu dùng cookie cho mutation

### 7.3. Bảo vệ dữ liệu

- [ ] Mask PII trong log (`email`, `phone` → `a***@x.com`)
- [ ] Signed URL cho CV có TTL ≤ 5 phút
- [ ] Endpoint `DELETE /admin/candidates/:id` xoá cứng file + record (quyền được xoá — NĐ 13/2023)
- [ ] Chính sách lưu trữ: hồ sơ bị từ chối tự xoá sau 180 ngày (job định kỳ)
- [ ] `audit_logs` append-only (không có endpoint update/delete)

### 7.4. Kiểm thử bảo mật

- [ ] Chạy `npm audit` / `pip-audit`, xử lý high/critical
- [ ] `semgrep` hoặc `CodeQL` trên CI
- [ ] Test thủ công 5 kịch bản: IDOR, privilege escalation, SQLi, path traversal tên file, XSS ở comment
- [ ] Kiểm tra response không lộ stack trace ở production mode

**DoD Phase 7:** Không còn lỗ hổng high/critical; có bảng "security test results" trong `docs/`.

---

## Phase 8 — Kiểm thử & Chất lượng (Ngày 36–38)

### 8.1. Backend

- [ ] Unit test scoring engine (Jaccard, semantic, trọng số) — coverage ≥ 90%
- [ ] Unit test state machine (campaign, round)
- [ ] Integration test (Supertest + testcontainers Postgres): luồng apply → evaluate → lock
- [ ] Test **race condition**: 2 request submit cùng lúc → 1 thành công, 1 nhận 409
- [ ] Test transaction rollback: giả lập lỗi ở insert detail thứ 3 → không có record cha
- [ ] Test RBAC: ma trận role × endpoint

### 8.2. AI Service

- [ ] Pytest cho extractor với 10 CV mẫu
- [ ] Test OCR fallback được kích hoạt đúng
- [ ] Test schema validation khi LLM trả JSON hỏng
- [ ] Snapshot test cho prompt template
- [ ] Benchmark: bộ 20 CV → ghi lại latency p50/p95 vào `docs/benchmark.md`

### 8.3. E2E

- [ ] Playwright: 3 kịch bản
  1. Ứng viên nộp CV → tra cứu bằng mã
  2. Giám khảo chấm điểm → không thấy điểm người khác
  3. Admin lock round → thấy toàn bộ điểm
- [ ] Chạy E2E trên CI với Docker Compose
- [ ] Screenshot/trace khi fail

### 8.4. Chất lượng mã

- [ ] ESLint + Prettier + Ruff pass, **0 warning**
- [ ] TypeScript strict, **0 `any`** trong `src/`
- [ ] Coverage: backend ≥ 70%, scoring engine ≥ 90%
- [ ] Không còn `console.log` / `print` debug
- [ ] Không còn `TODO` chưa gắn issue

**DoD Phase 8:** `npm test` xanh toàn bộ; CI chạy < 10 phút; báo cáo coverage có trong PR.

---

## Phase 9 — DevOps & Phát hành (Ngày 39–41)

### 9.1. Build & CI

- [ ] `Dockerfile` multi-stage cho backend, ai, frontend (image frontend serve bằng Nginx)
- [ ] `docker compose -f docker-compose.prod.yml` chạy full stack, có `restart: unless-stopped`
- [ ] GitHub Actions workflow:
  - `ci.yml`: lint → typecheck → unit test → build (PR)
  - `e2e.yml`: Playwright với compose (main)
  - `docker.yml`: build & push GHCR (tag)
- [ ] Cache npm store + pip wheel + Docker layer
- [ ] Secret qua GitHub Secrets, không hard-code

### 9.2. Vận hành

- [ ] `/health` (liveness) và `/health/ready` (readiness: DB + Redis + MinIO)
- [ ] Graceful shutdown (đóng queue worker trước khi exit)
- [ ] Backup Postgres: script `pg_dump` hằng ngày, giữ 7 bản
- [ ] Log JSON, có `request_id` xuyên Core ↔ AI
- [ ] Sentry (hoặc GlitchTip self-host) cho cả BE và FE
- [ ] Dashboard cơ bản: request rate, p95 latency, queue depth, AI fail rate

### 9.3. Triển khai

- [ ] Deploy staging (VPS hoặc Fly.io/Render) với domain thật + HTTPS (Caddy/Nginx + Let's Encrypt)
- [ ] Chạy migration tự động trong pipeline (có bước backup trước)
- [ ] Smoke test sau deploy: login, apply, track
- [ ] `docs/RUNBOOK.md`: cách rollback, cách replay DLQ, cách xử lý AI service chết

**DoD Phase 9:** Có URL staging truy cập công khai, HTTPS hợp lệ, deploy tự động từ `main`.

---

## Phase 10 — Demo & Portfolio (Ngày 42)

### 10.1. Dữ liệu demo

- [ ] Seed: 2 campaign, 3 round, 12 criteria, 30 CV (5 scan, 5 tiếng Anh, 20 tiếng Việt), 5 giám khảo
- [ ] Ảnh/PDF CV mẫu **không chứa PII thật** (tự sinh hoặc dùng mẫu công khai)
- [ ] Script `reset-demo.sh` đưa hệ thống về trạng thái ban đầu trong 30 giây

### 10.2. Tài liệu

- [ ] README cập nhật: screenshot/GIF cho 3 portal
- [ ] `docs/ARCHITECTURE.md` với sơ đồ cuối cùng (khớp code thực tế)
- [ ] `docs/API.md` hoặc link Swagger public
- [ ] `docs/BENCHMARK.md`: latency AI, throughput queue
- [ ] `docs/adr/` đủ 8 file, mỗi file ≤ 1 trang
- [ ] `CHANGELOG.md` theo Keep a Changelog

### 10.3. Trình bày

- [ ] Video demo 3–5 phút, có **phụ đề**, kịch bản:
  1. Ứng viên nộp CV trên mobile
  2. AI chấm điểm + giải thích matched/missing skills
  3. 3 giám khảo chấm độc lập (split screen chứng minh blind)
  4. Admin lock → unblind + cảnh báo outlier
  5. Email kết quả trong hộp thư
- [ ] Slide 5 trang: Problem → Solution → Architecture → Trade-offs → Results
- [ ] Chuẩn bị **3 câu trả lời phỏng vấn** cho: (1) vì sao tách AI service, (2) blind scoring chống bypass thế nào, (3) xử lý CV scan/tiếng Việt ra sao

**DoD Phase 10:** Người lạ xem video hiểu sản phẩm mà không cần bạn thuyết minh.

---

## Quality Gates

Chỉ được merge vào `main` khi thoả **tất cả**:

| Gate | Ngưỡng | Công cụ |
|---|---|---|
| Lint & format | 0 error, 0 warning | ESLint, Ruff, Prettier |
| Type check | 0 error | `tsc --noEmit`, mypy |
| Unit test | 100% pass | Jest, Pytest |
| Coverage | BE ≥ 70%, scoring ≥ 90% | Jest/Vitest, coverage.py |
| E2E | 3/3 kịch bản pass | Playwright |
| Security audit | 0 high/critical | `npm audit`, `pip-audit`, CodeQL |
| Build | Image build thành công < 10 phút | Docker |
| Migration | Reversible hoặc có backup | Prisma migrate |

---

## Rủi ro & Cách chặn

| Rủi ro | Khả năng | Tác động | Cách chặn |
|---|---|---|---|
| PDF scan/Canva không extract được | Cao | Cao | OCR fallback ngay Phase 3.2, test bộ 10 CV đa dạng |
| Truy vấn tiếng Việt kém chính xác | Cao | Cao | Dùng `bge-m3` (đa ngôn ngữ), thêm skill dictionary tiếng Việt |
| Queue nghẽn khi nhiều CV | Trung bình | Trung bình | Giới hạn concurrency, scale worker, hiển thị trạng thái `PROCESSING` cho user |
| LLM trả JSON sai schema | Trung bình | Trung bình | Pydantic validate + retry 1 lần + fallback heuristic |
| Blind scoring bị bypass | Thấp | **Rất cao** | Test bằng curl ở Phase 4.3, review code tập trung vào tầng query |
| LLM sinh câu hỏi vi phạm lao động | Thấp | Cao | Guardrail trong prompt + disclaimer UI + review mẫu 20 output |
| Trôi phạm vi (scope creep) | Cao | Trung bình | Đóng băng 8 US; ý tưởng mới ghi vào `docs/BACKLOG-V2.md` |
| Hết thời gian Phase 6 (FE) | Cao | Trung bình | Ưu tiên Public + Interviewer, Admin dùng bảng đơn giản trước |

---

## Tổng kết tiến độ

| Phase | Nội dung | Ngày | Trạng thái |
|---|---|---|---|
| 0 | Chuẩn bị & chốt đặc tả | 1 | ⬜ |
| 1 | Hạ tầng & xương sống | 2–5 | ⬜ |
| 2 | Nghiệp vụ core | 6–10 | ⬜ |
| 3 | AI pipeline | 11–16 | ⬜ |
| 4 | Đánh giá & blind scoring | 17–21 | ⬜ |
| 5 | Thông báo & AI copilot | 22–24 | ⬜ |
| 6 | Frontend ba portal | 25–31 | ⬜ |
| 7 | Bảo mật & hardening | 32–35 | ⬜ |
| 8 | Kiểm thử & chất lượng | 36–38 | ⬜ |
| 9 | DevOps & phát hành | 39–41 | ⬜ |
| 10 | Demo & portfolio | 42 | ⬜ |

> Cập nhật trạng thái: `⬜ chưa làm` · `🟨 đang làm` · `✅ xong` · `⛔ blocked`
