# 01. Tổng quan

Dự án gồm 3 phần chính:

1) **Next.js (App Router)**  
- UI chính (server-render) + API routes (`/app/api/**`).
- Có **external API** dành cho frontend/app ngoài domain: `/app/api/external/**`.

2) **Worker (BullMQ)**  
- Chạy jobs nền: watcher nạp crypto (TRON/BSC), reconcile deposit, anti-fraud, v.v.
- Build output: `worker/dist`.

3) **Frontend Vite (tuỳ chọn)**  
- UI tách riêng để bạn build bằng công cụ AI (Bolt/Lovable/Firebase hosting) nhưng vẫn dùng chung backend Next.
- Khi dev: Vite proxy `/api` sang backend Next.

## Mục tiêu bảo mật
- **API Key** để nhận diện ứng dụng/domain gọi API.
- **Scopes** để giới hạn quyền theo nhóm tính năng.
- **strictScopes**: route nhạy cảm (NFT_WRITE, USER_WRITE, VIEW_WRITE) phải có scope thì mới cho chạy.
- **Auth**: JWT cookie (web) + Bearer (mobile).
- **PIN**: bắt PIN cho hành động nhạy cảm (mua NFT, tặng sao, đúc NFT) nếu user đã set PIN.
