# Ghi chú triển khai & kiến trúc (Tiếng Việt)

## Mục tiêu
- Backend Next.js (VideoShare) dùng chung cho nhiều frontend:
  - Next UI (trang web chính)
  - Vite frontend (UI tách riêng)
  - Bolt.new / Lovable / Firebase Hosting
  - Ứng dụng di động (Expo)

## 1) UI stack
- Tailwind CSS
- shadcn/ui (core components)
- Radix (primitives)
- next-themes (Dark/Light/System)
- (tuỳ chọn) Aceternity/Magic UI để làm hiệu ứng “luxury”

## 2) Vite frontend vẫn dùng API Next
Thư mục: `frontend-vite/`
- dev: proxy `/api` về backend Next.
- production: cấu hình base URL backend + gửi cookie/headers.

## 3) API Key (multi-domain)
- Admin tạo key tại: `POST /api/admin/api-keys`
- Frontend khác domain phải gửi: `X-API-Key`
- allowedOrigins: danh sách domain được phép gọi từ browser.

## 4) Auth API riêng (JWT Cookie)
- `POST /api/auth-jwt/register`
- `POST /api/auth-jwt/login`
- `GET /api/auth-jwt/me`
- `POST /api/auth-jwt/refresh`
- `POST /api/auth-jwt/logout`

### Cookie cross-domain
- Production: cookie `SameSite=None; Secure` => bắt buộc HTTPS.
- Frontend fetch phải có: `credentials: "include"`

### Mobile (Expo)
- Gửi `returnTokens: true` (hoặc header `x-return-tokens: 1`) để nhận `accessToken/refreshToken` trong JSON.
- Dùng Bearer:
  `Authorization: Bearer <accessToken>`

## 5) Bảo mật cho API
### 5.1 Input validation
- Dùng Zod validate body/query ở các route quan trọng.

### 5.2 Rate limiting
- `lib/api/rateLimit.ts`: fixed-window limiter.
- Có Redis: dùng INCR + TTL
- Không có Redis: fail-open (phù hợp dev; production nên bật Redis)

### 5.3 Authentication & Authorization
- NextAuth vẫn dùng cho web Next (cookie session)
- Auth-jwt dùng cho external frontends
- Admin routes check role ADMIN.

## 6) File cho AI frontend
- `frontend-api.txt`: hướng dẫn gọi API (tiếng Việt), copy vào Bolt/Lovable để họ tự build UI.



## API External (dành cho frontend/app khác domain)

Xem `frontend-api.txt` (phần API DÀNH CHO FRONTEND NGOÀI) để biết cách dùng `X-API-Key`, cookie/Bearer, CORS, scopes.


## Migration mới: PIN bảo mật (UserPin)
Mình đã thêm model `UserPin` vào Prisma để hỗ trợ xác thực mã PIN khi mua NFT / tặng sao / đúc NFT.

Bạn cần chạy migrate:

Dev:
```bash
npx prisma migrate dev
npx prisma generate
```

Production:
```bash
npx prisma migrate deploy
npx prisma generate
```


## Watcher TRON/BSC: tự phát hiện nạp USDT/USDC và auto-credit sao
Hệ thống hỗ trợ 2 cơ chế để detect nạp tiền:
- **Webhook provider** (ví dụ Alchemy Notify cho BSC/EVM)
- **Polling watcher** chạy trong worker (quét chain theo chu kỳ)

### BSC (USDT/USDC)
- **Webhook (Alchemy Notify)**: gọi `/api/webhooks/crypto/alchemy` (có `x-webhook-secret`)
- **Polling watcher**: worker chạy job `watch_bsc_deposits` theo `PAYMENTS_WATCH_BSC_EVERY_MS`.
  - Quét log `Transfer(address,address,uint256)` của USDT/USDC contract trên BSC
  - Match `toAddress` với `CustodialAddress.address` của các `StarDeposit` đang pending
  - Ghi `txHash + actualAmount` rồi enqueue `reconcile_deposit` để tự confirm + credit.

### TRON (TRC20 USDT/USDC)
- Polling watcher job `watch_tron_deposits` dùng TronGrid API:
  - Query lịch sử TRC20 transfer cho địa chỉ nạp
  - Match theo `toAddress` (TRON thường không có memo)
  - Ghi `txHash + actualAmount` rồi enqueue `reconcile_deposit`.

### ENV bắt buộc
```env
# BSC watcher
EVM_RPC_URL_BSC=...
PAYMENTS_WATCH_BSC_EVERY_MS=60000
PAYMENTS_EVM_CONFIRMATIONS=5
PAYMENTS_WATCH_BLOCK_WINDOW=2000

# TRON watcher
TRONGRID_API_URL=https://api.trongrid.io
TRONGRID_API_KEY=...
PAYMENTS_WATCH_TRON_EVERY_MS=60000
```

### Database migration (bắt buộc)
Watcher cần bảng `ChainWatcherCursor` để lưu cursor (lastBlock/lastTx) tránh quét trùng.
Chạy:
```bash
npx prisma migrate dev
npx prisma generate
```
