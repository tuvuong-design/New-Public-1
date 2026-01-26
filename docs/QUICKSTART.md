# Quickstart (Local Dev)

## 0) Yêu cầu
- Node.js 18+ (khuyến nghị 20+)
- Docker (để chạy MySQL + Redis)
- `ffmpeg` + `ffprobe` có trong PATH (worker dùng để encode HLS)
- Có sẵn thông tin Cloudflare R2 (S3) để upload/playback

## 1) Chạy MySQL + Redis
```bash
docker compose up -d
# hoặc
npm run db:up
```

Kiểm tra container:
```bash
docker ps
```

## 2) Cấu hình env
```bash
cp .env.example .env
```

- Sửa `R2_*` + `R2_PUBLIC_BASE_URL`.
- Mặc định DB/Redis trỏ vào docker-compose local.

## 3) Install deps + Prisma (generate/push/seed)
```bash
npm i
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

> Lưu ý: repository đang **không** commit folder `prisma/migrations`. Vì vậy local dev khuyến nghị dùng `prisma db push`.

## 4) Chạy web + worker
Terminal A:
```bash
npm run dev
```

Terminal B:
```bash
npm run worker:dev
```

Mở:
- Web: `http://localhost:3000`
- Install Wizard (nếu cần): `http://localhost:3000/install`

## 5) Smoke test nhanh
1) Login admin (seed tạo sẵn) → vào `/admin`.
2) Upload 1 video ở `/upload`.
3) Bấm “Queue processing” để đẩy job.
4) Worker chạy: tạo thumbnail, encode HLS.
5) Publish video trong `/admin/videos` (nếu flow bật manual publish).

Gợi ý:
- Mở **Docs Index** trong admin: `/admin/docs`
- Similar videos có Redis cache: xem `docs/CACHING.md`

## 6) Chạy test
```bash
npm test
```

---

## Packaging (Slim vs Full)
Dự án phát hành 2 loại ZIP:

- **Slim ZIP**: không kèm `node_modules/`, `.next/`, `worker/dist/` (nhẹ, phù hợp CI/CD và upload source).
- **Full ZIP**: có kèm `node_modules/`, `.next/`, `worker/dist/` (phù hợp deploy nhanh, không phải build lại).
  - Luu y: full zip chi day du khi da chay `npm install` + `npm run build` de tao `node_modules/`, `.next/`, `worker/dist/`.
  - Khuyến nghị: chạy `npm install` để tạo `package-lock.json`, commit lockfile để deploy ổn định (có thể dùng `npm ci`).
  - Lưu ý: full zip chỉ “đầy đủ” khi bạn đã chạy `npm install` + `npm run build` để tạo `node_modules/`, `.next/`, `worker/dist/`.

Tạo ZIP tự động bằng scripts:

```bash
# Slim
npm run package:slim

# Full (sẽ npm install + npm run build rồi zip)
npm run package:full

# Nếu bạn đã build sẵn và chỉ muốn zip:
SKIP_BUILD=1 npm run package:full
```

Output sẽ nằm cạnh thư mục project:
- `videoshare-nextjs-v<version>-final-slim.zip`
- `videoshare-nextjs-v<version>-final-full.zip`

### Release artifacts (4.3.5)
- Slim: `videoshare-nextjs-v4.5.0-final-slim.zip`
- Full: `videoshare-nextjs-v4.5.0-final-full.zip`

Ghi chú môi trường sandbox: bản `full` trong sandbox có thể trùng với `slim` nếu chưa chạy build để tạo `.next/` và `worker/dist/`. Khi deploy thực tế, hãy chạy `npm run package:full` trên máy/CI để có full zip đúng nghĩa.
