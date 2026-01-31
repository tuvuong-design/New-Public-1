# 07. Deploy aaPanel Stable 7 (PM2 hoặc Node Project)

## 1) Chuẩn bị
- Node 18/20
- MySQL
- Redis (BullMQ)
- SSL cho domain (quan trọng nếu dùng cookie cross-domain)

## 2) Cài & build
```bash
npm install
npx prisma migrate deploy
npx prisma generate
SKIP_REDIS_DURING_BUILD=1 npm run build
```

## 3) Chạy bằng PM2
```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

## 4) Reverse proxy trong aaPanel
- Proxy domain -> `http://127.0.0.1:3000`

## 5) Worker watchers
Worker chạy trong PM2 app `videoshare-worker`.

## 6) ENV Telegram
```env
TELEGRAM_NOTIFY_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```
