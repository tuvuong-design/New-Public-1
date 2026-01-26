# Deploy lên aaPanel

Tài liệu này hướng dẫn deploy **VideoShare Next.js (web) + worker (BullMQ)** trên aaPanel.

> Mục tiêu: chạy **2 process**:
> - Web: Next.js server (port 3000)
> - Worker: BullMQ consumer (ffmpeg + payments jobs)
>
> Và có **MySQL + Redis** (qua Docker hoặc extension trong aaPanel).

---

## 0) Yêu cầu tối thiểu
- Server Linux (Ubuntu 20+ hoặc Debian 11+ khuyến nghị)
- aaPanel + Nginx
- Node.js 20+ (18+ cũng chạy được)
- `ffmpeg` + `ffprobe` (worker bắt buộc)
- MySQL 8 + Redis 7

Cài ffmpeg (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install -y ffmpeg
ffmpeg -version
ffprobe -version
```

---

## 1) Chuẩn bị MySQL + Redis
Bạn có 2 lựa chọn (chọn 1):

### Lựa chọn A: Dùng Docker (khuyến nghị nếu server đã bật Docker)
Trong thư mục source, chạy:
```bash
docker compose up -d
```

- MySQL: `127.0.0.1:3306`
- Redis: `127.0.0.1:6379`

> Ưu điểm: nhanh, đúng version (MySQL8/Redis7) như dev.

### Lựa chọn B: Dùng MySQL/Redis có sẵn trong aaPanel
- Tạo database/user trong aaPanel
- Bật Redis extension (nếu có)

Sau đó cấu hình trong `.env`:
- `DATABASE_URL="mysql://user:pass@127.0.0.1:3306/dbname"`
- `REDIS_URL="redis://127.0.0.1:6379"` (hoặc host/port của Redis trên server)

---

## 2) Upload code lên server
Gợi ý folder:
- `/www/wwwroot/videoshare`

Có thể dùng Git hoặc upload ZIP rồi giải nén.

---

## 3) Cấu hình môi trường (.env)
Trong thư mục project:
```bash
cp .env.example .env
```

Cần set tối thiểu:
- `NODE_ENV="production"`
- `SITE_URL="https://your-domain.com"`
- `NEXTAUTH_URL="https://your-domain.com"`
- `AUTH_SECRET="<random-long-string>"`
- `DATABASE_URL=...`
- `REDIS_URL=...`
- `R2_*` + `R2_PUBLIC_BASE_URL` (để playback HLS/thumbnail)

> Lưu ý: **R2_PUBLIC_BASE_URL** nên là CDN domain (Cloudflare) để tối ưu cache/Class B.

---

## 4) Cài deps + Prisma (generate/push/seed)
```bash
npm i
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

> Repo đang ưu tiên `prisma db push` vì không commit migrations.

---

## 5) Build production
```bash
npm run build
```

---

## 6) Chạy Web + Worker bằng PM2 (khuyến nghị)
Cài PM2:
```bash
npm i -g pm2
```

### 6.1) Start Web
```bash
pm2 start "npm run start" --name videoshare-web
```

### 6.2) Start Worker
```bash
pm2 start "npm run worker" --name videoshare-worker
```

Lưu config để reboot tự chạy:
```bash
pm2 save
pm2 startup
```

Kiểm tra:
```bash
pm2 status
pm2 logs videoshare-web
pm2 logs videoshare-worker
```

---

## 7) Reverse proxy trong aaPanel (Nginx)
Tạo website trong aaPanel trỏ domain (ví dụ `your-domain.com`).

Cấu hình proxy tới:
- `http://127.0.0.1:3000`

Gợi ý headers:
- `Upgrade` / `Connection` (websocket)
- `X-Forwarded-For`
- `X-Forwarded-Proto`

Bật HTTPS bằng aaPanel (Let's Encrypt) và nhớ update `.env`:
- `SITE_URL` + `NEXTAUTH_URL` dùng `https://...`

---

## 8) Checklist production
- [ ] `NODE_ENV=production`
- [ ] `AUTH_SECRET` đủ dài và private
- [ ] MySQL/Redis đã chạy (docker hoặc aaPanel)
- [ ] Worker đang chạy (pm2 logs không error)
- [ ] R2 credentials đúng, `R2_PUBLIC_BASE_URL` truy cập được
- [ ] Mở firewall: chỉ expose 80/443; port 3000 không cần mở public (nên chỉ local)

---

## 9) Troubleshooting nhanh
### 9.1 Prisma connect error
- Check `DATABASE_URL`
- Check MySQL user/pass
- Check MySQL bind-address/firewall

### 9.2 Worker encode lỗi
- Check `ffmpeg`/`ffprobe` tồn tại
- Check permission folder temp (nếu worker dùng /tmp)
- Check R2 credentials

### 9.3 Không login được
- Check `NEXTAUTH_URL` đúng domain/https
- Check `AUTH_SECRET` set
- Nếu dùng reverse proxy: đảm bảo `X-Forwarded-Proto=https`

---

## Deploy bằng ZIP “Full”
Nếu bạn dùng **Full ZIP** (đã kèm `node_modules/`, `.next/`, `worker/dist/`), bạn có thể bỏ qua bước `npm install` + `npm run build`:

1) Upload và giải nén full zip vào `/www/wwwroot/videoshare`
2) Chỉ cần cập nhật `.env` và chạy Prisma:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

3) PM2 chạy:

```bash
pm2 start "npm run start" --name videoshare-web
pm2 start "npm run worker" --name videoshare-worker
pm2 save
```

> Khuyến nghị: Dù dùng full zip, khi đổi version lớn bạn vẫn nên build lại để đảm bảo `.next/` tương thích.
