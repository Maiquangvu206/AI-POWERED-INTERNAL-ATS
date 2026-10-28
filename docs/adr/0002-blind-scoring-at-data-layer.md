# ADR-0002 — Blind Scoring thực thi ở tầng Database/Backend

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** SRS §4 ADR-02, US-06

## Bối cảnh

Nhiều hệ thống trả **toàn bộ** điểm về Frontend rồi ẩn bằng CSS/JS. Giám khảo chỉ cần mở Network Tab hoặc gọi thẳng API là thấy điểm đồng nghiệp → phá vỡ hoàn toàn mục tiêu chấm độc lập.

## Quyết định

Thực thi blind scoring ngay trong **câu truy vấn SQL**:

```sql
-- Interviewer, round chưa LOCKED
SELECT ... FROM evaluations
WHERE round_id = $1 AND candidate_id = $2
  AND interviewer_id = $currentUserId;
```

- Vai trò `INTERVIEWER`: luôn bị chèn điều kiện `interviewer_id = :me` khi round `status != 'LOCKED'`.
- Vai trò `ADMIN`: không lọc, nhưng chỉ nhận dữ liệu tổng hợp trước khi lock.
- Response của Interviewer **không chứa** `interviewer_id`, `interviewer_name`, hay `total_score` của người khác.

## Hệ quả

**Tích cực**

- Bảo mật thực chất: không thể bypass từ client, kể cả khi dùng `curl`.
- Kiểm chứng được bằng test tự động (Phase 4.3).

**Tiêu cực**

- Endpoint phải phân nhánh theo role, không tái sử dụng DTO đơn giản.
- Dễ tái phát lỗi nếu sau này có dev viết query mới mà quên filter.

**Giảm thiểu:** đặt logic trong một `ScoresQueryBuilder` duy nhất, mọi endpoint phải đi qua đó; thêm test RBAC dạng ma trận role × endpoint.

## Phương án đã loại

- **Ẩn ở tầng serialize/DTO**: vẫn lộ nếu có endpoint khác trả entity thô.
- **Mã hoá điểm ở DB**: phức tạp, không giải quyết được việc Admin cần đọc.
