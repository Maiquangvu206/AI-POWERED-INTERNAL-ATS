# Shared — Thứ dùng chung giữa Backend & Frontend

Một nguồn sự thật duy nhất cho **schema, type và hằng số** để Frontend và Backend không bao giờ lệch nhau.

## Vì sao cần?

Không có `shared/`:

```
Frontend validate email bằng regex A  ←→  Backend validate bằng regex B
Frontend nghĩ max file 5MB           ←→  Backend chặn ở 10MB
Frontend dùng 'ADMIN'                ←→  Backend dùng 'admin'
```

Có `shared/`:

```ts
import { ApplyFormSchema, CV_UPLOAD_LIMITS, Role } from '@ats/shared';
```

→ Sửa một chỗ, cả hai bên cùng đổi, TypeScript báo lỗi ngay nếu quên.

## Nội dung hiện có

| Export | Dùng ở đâu |
|---|---|
| `Role`, `RoleSchema` | Guard phân quyền (BE) + ẩn/hiện menu (FE) |
| `CampaignStatus`, `RoundStatus`, `FinalStatus` | State machine (BE) + badge màu trạng thái (FE) |
| `TrackingCodeSchema` | Sinh & validate mã tra cứu (ADR-0004) |
| `ApplyFormSchema` | Validate form nộp CV ở cả 2 phía |
| `CV_UPLOAD_LIMITS` | Chặn file > 5MB ở client và server, magic-byte `%PDF` |

## Cấu trúc

```
shared/
├── src/
│   └── index.ts
├── dist/            # build output (gitignore)
├── tsconfig.json
└── package.json     # @ats/shared
```

Từ Phase 2 sẽ tách theo miền:

```
src/
├── enums/           # Role, Status...
├── schemas/         # Zod: apply-form, evaluation, campaign
├── types/           # type suy ra từ schema
├── constants/       # giới hạn upload, thông điệp lỗi, regex
└── index.ts         # barrel export
```

## Quy ước

| Quy ước | Ghi chú |
|---|---|
| Chỉ chứa code **không phụ thuộc môi trường** | Không import React, không import NestJS, không dùng `fs` |
| Mọi schema viết bằng **Zod** | Suy ra type bằng `z.infer`, không viết type tay 2 lần |
| Đổi export = breaking change | Phải chạy `npm run build` và kiểm tra cả BE + FE |
| Build trước khi dùng | `npm run build -w @ats/shared` (root script `build` đã tự làm) |

## Build

```bash
npm run build -w @ats/shared
```
