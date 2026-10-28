# ADR-0007 — Audit Log & UNIQUE Constraint cho tính công bằng

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** US-05, US-06

## Bối cảnh

Hai vấn đề không được SRS v2.0.0 giải quyết:

1. **Không có bằng chứng kiểm toán.** Khi ứng viên khiếu nại "điểm của tôi bị sửa", hệ thống không thể trả lời ai sửa, lúc nào.
2. **Chống trùng phiếu điểm chỉ ở application layer.** Hai request đồng thời (double-click, retry mạng) có thể cùng qua bước `check-then-insert` → tạo 2 phiếu, làm sai điểm trung bình.

## Quyết định

**a) Bảng `audit_logs` (append-only)**

```
id, actor_id, action, entity_type, entity_id,
before (jsonb), after (jsonb), ip, user_agent, created_at
```

Ghi các hành động nhạy cảm: `evaluation.create`, `evaluation.update`, `round.lock`, `round.unlock`, `candidate.delete`, `rubric.update`.
Không có endpoint update/delete cho bảng này.

**b) Ràng buộc UNIQUE ở tầng DB**

```sql
ALTER TABLE evaluations
  ADD CONSTRAINT uq_eval_per_round_candidate_interviewer
  UNIQUE (round_id, candidate_id, interviewer_id);
```

Map lỗi Prisma `P2002` → HTTP **409 Conflict** với thông điệp thân thiện.

## Hệ quả

**Tích cực**

- Có bằng chứng kiểm toán khi có tranh chấp.
- Race condition bị chặn ở tầng cuối cùng — không thể bypass bằng code.

**Tiêu cực**

- Tăng dung lượng DB → cần chính sách lưu trữ (đề xuất 24 tháng).
- Cần serialize `before/after` cẩn thận để không vô tình log PII (email, số điện thoại) — phải mask.

## Phương án đã loại

- **Chỉ dùng trigger PostgreSQL**: khó version hoá theo schema, khó test.
- **Chỉ dựa vào log ứng dụng (file)**: không truy vấn được, dễ mất khi rotate.
