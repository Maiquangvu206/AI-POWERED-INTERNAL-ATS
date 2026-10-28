# ADR-0004 — Chống IDOR bằng mã tra cứu ngẫu nhiên

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** SRS §4 ADR-04, US-03

## Bối cảnh

Endpoint tra cứu là public. Nếu dùng ID tự tăng (`/track/1`, `/track/2`), đối thủ chỉ cần vòng lặp `for i in 1..10000` là crawler được toàn bộ thông tin ứng viên — một lỗ hổng IDOR kinh điển nhưng rất hay bị bỏ qua.

## Quyết định

Sinh `tracking_code` có entropy cao, định dạng `APP-YYYY-XXXX`:

- `YYYY`: năm nộp đơn (dễ đọc cho người dùng).
- `XXXX`: 4 ký tự từ bảng `A-Z0-9` (bỏ `O/0/I/1` để tránh nhầm khi đọc qua điện thoại).
- Sinh lại tối đa 3 lần nếu vi phạm UNIQUE index.
- Endpoint `/public/track/:code` **không** trả điểm chi tiết, email, số điện thoại — chỉ `full_name` (mask), `status`, `current_round`.

## Hệ quả

**Tích cực**

- Không thể enumerate (không gian 32^4 ≈ 1 triệu tổ hợp/ năm, kết hợp rate limit 20 req/10 phút).
- Thân thiện khi ứng viên đọc mã qua điện thoại.

**Tiêu cực**

- Ứng viên phải lưu mã; nếu mất thì không tra cứu được → cần gửi lại mã qua email.

**Giới hạn đã biết:** 4 ký tự chỉ đủ khi đi kèm rate limit. Nếu mở rộng cho hàng trăm nghìn hồ sơ/năm, nâng lên 6 ký tự.

## Phương án đã loại

- **UUID v4**: an toàn nhưng không thể đọc/ghi lại qua điện thoại.
- **Hash của ID**: vẫn có thể đoán nếu biết thuật toán.
