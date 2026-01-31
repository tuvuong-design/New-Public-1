#!/usr/bin/env bash
set -euo pipefail

# VideoShare deploy helper (aaPanel + PM2)
# Assumes: Node 18/20, git cloned repo, .env configured, MySQL + Redis running.

echo "== Install deps =="
npm install

echo "== Prisma migrate + generate =="
npx prisma migrate deploy
npx prisma generate

echo "== Build (skip redis during build if needed) =="
export SKIP_REDIS_DURING_BUILD=${SKIP_REDIS_DURING_BUILD:-1}
npm run build

echo "== Start with PM2 =="
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save

echo "Done. Check logs:"
echo "  pm2 ls"
echo "  pm2 logs videoshare-web"
echo "  pm2 logs videoshare-worker"
