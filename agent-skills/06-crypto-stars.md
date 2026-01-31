# 06. Nạp sao bằng Crypto (USDT/USDC) + Auto-credit

## Luồng chuẩn
1) Frontend gọi `POST /api/external/stars/topup/deposits/create` để tạo deposit.
2) Backend trả địa chỉ nạp + memo (nếu chain hỗ trợ).
3) User chuyển USDT/USDC vào địa chỉ đó.
4) **Watcher/Webhook** phát hiện giao dịch:
   - TRON: polling TronGrid (TRC20 transfer)
   - BSC: polling RPC logs ERC20 Transfer
   - SOLANA: polling RPC (jsonParsed) + memo match (nếu có)
   - ETHEREUM/POLYGON/BASE: polling RPC logs ERC20 Transfer (giống BSC)
5) Match giao dịch -> cập nhật StarDeposit -> `CONFIRMED`
6) `creditDepositStars()` -> `CREDITED`, cộng `starBalance`, tạo `StarTransaction`

## Trạng thái quan trọng
- CREATED / SUBMITTED / OBSERVED / CONFIRMED / CREDITED
- NEEDS_REVIEW: amount lệch tolerance / nghi gian lận / token không khớp

## Tolerance
- `PAYMENTS_TOLERANCE_BPS` (mặc định 150 = 1.5%)
- Nếu lệch quá -> NEEDS_REVIEW (không auto-credit)

## Thông báo Telegram (tuỳ chọn)
- Bật: `TELEGRAM_NOTIFY_ENABLED=true`
- Khi CREDITED hoặc NEEDS_REVIEW sẽ gửi Telegram.
## Deadman alert (watcher bị dừng)
Worker có cron `alert_cron` sẽ kiểm tra heartbeat `ChainWatcherCursor(key="lastRun")`.
Nếu quá `PAYMENTS_WATCHER_STALE_MINUTES` phút không thấy cập nhật → gửi Telegram cảnh báo.

ENV:
```env
PAYMENTS_WATCHER_STALE_MINUTES=10
TELEGRAM_NOTIFY_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```
