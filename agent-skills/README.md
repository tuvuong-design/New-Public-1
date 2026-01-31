# Agent Skills (Hướng dẫn cho AI/Agent làm việc với dự án VideoShare)

Thư mục này dành cho các AI agent / dev mới vào dự án để:
- Hiểu kiến trúc tổng thể (Next.js API + Worker watchers + Vite frontend).
- Biết cách chạy local, deploy aaPanel/PM2, cấu hình ENV.
- Biết các quy tắc bảo mật: API Key + scopes + strictScopes + JWT (cookie/bearer) + PIN.
- Biết luồng nạp sao bằng crypto: tạo deposit -> watcher/webhook -> CONFIRMED -> CREDITED -> StarTransaction.

## Tài liệu chính
1. `01-tong-quan.md` – tổng quan dự án
2. `02-chay-local.md` – chạy local nhanh
3. `03-kien-truc.md` – kiến trúc & folder map
4. `04-bao-mat-api.md` – API Key, scopes, strictScopes, authz
5. `05-external-api.md` – tài liệu /api/external/* (dành cho Bolt/Lovable/Expo)
6. `06-crypto-stars.md` – nạp sao USDT/USDC + webhook + watcher + auto-credit
7. `07-deploy-aapanel.md` – deploy aaPanel Stable 7 + PM2 + reverse proxy + SSL
8. `08-runbook-debug.md` – lỗi thường gặp & cách xử lý

## Snippets
- `snippets/route-external-template.ts` – template tạo route external chuẩn
- `snippets/scope-policy.ts` – mẫu policy strictScopes
