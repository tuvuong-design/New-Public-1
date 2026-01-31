# 08. Runbook Debug (lỗi thường gặp)

## 401/403 khi gọi external API
- Thiếu `X-API-Key`
- Domain chưa nằm trong `allowedOrigins` (nếu request có Origin)
- Thiếu scope (strictScopes): VIEW_WRITE / USER_WRITE / NFT_WRITE

## Cookie không gửi qua domain khác
- Cần HTTPS
- Cookie phải `SameSite=None; Secure`
- Fetch phải `credentials: "include"`

## Watcher không chạy
- Worker chưa chạy (PM2 videoshare-worker)
- Redis không chạy (BullMQ cần Redis)
- Thiếu ENV: TRONGRID_API_KEY, EVM_RPC_URL_BSC

## Deposit không auto-credit
- Token không phải USDT/USDC
- Amount lệch tolerance -> NEEDS_REVIEW
- PAYMENTS_AUTO_CREDIT=false
