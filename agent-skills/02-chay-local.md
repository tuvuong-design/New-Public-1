# 02. Chạy local (nhanh)

## Backend Next
```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Worker (watcher)
Worker cần Redis (BullMQ). Nếu chưa có Redis, bạn có thể chạy docker-compose hoặc cài Redis.

- Build worker:
```bash
npm run build
```

- Chạy worker:
```bash
node worker/dist/index.js
```

## Frontend Vite
```bash
cd frontend-vite
npm install
VITE_NEXT_BASE_URL=http://localhost:3000 VITE_API_KEY=xxx npm run dev
```

## Tip
- Build CI muốn **bỏ Redis**: `SKIP_REDIS_DURING_BUILD=1 npm run build`
