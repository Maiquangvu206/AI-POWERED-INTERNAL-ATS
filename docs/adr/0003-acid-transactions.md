# ADR-0003 — Toàn vẹn dữ liệu bằng Database Transaction

- **Ngày:** 2026-10-28
- **Trạng thái:** Accepted
- **Liên quan:** SRS §4 ADR-03, US-05

## Bối cảnh

Một phiếu đánh giá gồm **1 record cha** (`evaluations`) và **N record con** (`evaluation_details`, N = số criteria của round). Nếu lỗi mạng hoặc lỗi validation xảy ra giữa chừng, DB sẽ có phiếu điểm thiếu chi tiết — dữ liệu mồ côi, không thể tính lại tổng điểm.

## Quyết định

Bọc toàn bộ thao tác trong một **interactive transaction**:

```ts
await prisma.$transaction(async (tx) => {
  const evaluation = await tx.evaluation.create({ ... });
  await tx.evaluationDetail.createMany({ data: details, ... });
  await tx.evaluation.update({
    where: { id: evaluation.id },
    data: { totalScore },
  });
});
```

- `total_score` được tính **bên trong** transaction từ dữ liệu vừa ghi.
- Mọi lỗi → rollback toàn bộ, trả về lỗi nghiệp vụ rõ ràng.

## Hệ quả

**Tích cực**

- Không bao giờ có phiếu điểm nửa vời.
- `total_score` luôn khớp với chi tiết.

**Tiêu cực**

- Transaction giữ lock lâu hơn; cần giữ payload nhỏ (N thường < 10 nên không đáng lo).

## Phương án đã loại

- **Ghi tuần tự không transaction**: chấp nhận rủi ro dữ liệu mồ côi — không thể chấp nhận với dữ liệu tuyển dụng.
- **Ghi bằng batch insert duy nhất**: Prisma không hỗ trợ nested create với tính toán tổng cần đọc lại.
