# 09. Báo update GitHub → Telegram (không auto-deploy)

## Mục tiêu
- Server aaPanel tự **kiểm tra GitHub có commit mới** (hoặc release mới)
- Nếu có: **gửi Telegram** để bạn biết và tự quyết định deploy

## Script có sẵn
`scripts/update/check_github_updates.js`

### ENV cần
```env
GITHUB_REPO=owner/repo
GITHUB_BRANCH=main
# Nếu repo private hoặc bạn bị rate limit:
GITHUB_TOKEN=ghp_...

TELEGRAM_NOTIFY_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## Chạy thử
```bash
node scripts/update/check_github_updates.js
```

## Cài cron (khuyên dùng)
Mở crontab:
```bash
crontab -e
```

Thêm dòng (mỗi 10 phút):
```bash
*/10 * * * * cd /www/wwwroot/your-project && node scripts/update/check_github_updates.js >> .cache/update.log 2>&1
```

## Gợi ý thao tác deploy thủ công khi có update
- `git pull`
- `npm install`
- `npx prisma migrate deploy`
- `npm run build`
- restart web + worker (PM2/Node Project)
