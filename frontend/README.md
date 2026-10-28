# Frontend — Web (React 19 + Vite)

Ba cổng giao diện trong **một** ứng dụng, phân tách bằng route và quyền:

| Cổng | Người dùng | Trạng thái |
|---|---|---|
| Public Portal | Ứng viên (không cần tài khoản) | Phase 6 |
| Interviewer Portal | Giám khảo | Phase 6 |
| Admin Dashboard | HR Manager | Phase 6 |

## Chạy

```bash
npm run dev:web        # http://localhost:5173
```

Dev server proxy `/api` → `http://localhost:3000`, nên không cần cấu hình CORS khi phát triển.

## Cấu trúc

```
frontend/
├── index.html
├── vite.config.ts        # proxy /api → backend:3000
├── tsconfig.json
└── src/
    ├── main.tsx          # mount React
    ├── App.tsx           # [Phase 0] kiểm tra kết nối backend
    └── index.css
```

Từ Phase 6 sẽ mở rộng thành:

```
src/
├── app/                  # router, layout, providers
├── features/             # 1 thư mục = 1 cổng
│   ├── public/           # /careers, /track
│   ├── interviewer/      # danh sách ứng viên, chấm điểm
│   └── admin/            # campaign, rubric, lock round
├── shared/
│   ├── api/              # axios instance + interceptor refresh token
│   ├── ui/               # component dùng lại (Button, Table, Modal)
│   └── lib/              # helper, formatter
└── routes.tsx
```

## Quy ước

| Quy ước | Ghi chú |
|---|---|
| Server state do **TanStack Query** quản lý | Không copy response vào `useState` |
| Schema form lấy từ `@ats/shared` | Một nguồn sự thật với backend |
| Không tự đặt màu/khoảng cách | Dùng token của Tailwind + shadcn/ui |
| Mọi màn hình phải có 3 trạng thái | loading (skeleton) · empty · error |
| Responsive từ 360px | Ứng viên chủ yếu nộp CV bằng điện thoại |

## Tài liệu liên quan

- [Tech Stack](../README.md#5-tech-stack)
- [Luồng nghiệp vụ](../README.md#6-luồng-nghiệp-vụ-chính)
