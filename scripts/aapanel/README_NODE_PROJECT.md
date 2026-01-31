# aaPanel Node Project (Web + Worker)

## 1) Build
```bash
npm install
npx prisma migrate deploy
npx prisma generate
SKIP_REDIS_DURING_BUILD=1 npm run build
```

## 2) Tạo Node Project (Web)
- Start command:
```bash
npm run start -- -p 3000
```

## 3) Tạo Node Project (Worker)
- Start command:
```bash
node worker/dist/index.js
```

## 4) ENV
Bạn copy `.env.example` -> `.env` và điền đủ:
- DATABASE_URL
- REDIS_URL
- SITE_URL
- R2_*
- EVM_RPC_URL_* / SOLANA_RPC_URL / TRONGRID_*
- TELEGRAM_*

## 5) Reverse Proxy
Nginx proxy -> `http://127.0.0.1:3000`
