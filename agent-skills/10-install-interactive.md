# 10. Cài đặt tự động (hỏi thông tin + build)

Script:
- `scripts/install/install_interactive.sh`

## Chạy
```bash
chmod +x scripts/install/install_interactive.sh
./scripts/install/install_interactive.sh
```

## Script sẽ làm gì?
- Hỏi thông tin cần thiết (SITE_URL, MySQL, Redis, R2, RPC, Telegram)
- Tạo file `.env`
- `npm install`
- `npx prisma migrate deploy`
- `npm run build` (có `SKIP_REDIS_DURING_BUILD=1`)

## Sau đó chạy web + worker
- PM2: `pm2 start ecosystem.config.cjs`
- aaPanel Node Project: tạo 2 project (web + worker) như file `agent-skills/07-deploy-aapanel.md`
