#!/usr/bin/env bash
set -euo pipefail

# Interactive installer for VideoShare (Next.js + Worker) on Linux (aaPanel friendly)
# - Creates .env
# - Runs npm install, prisma migrate, build
#
# Requirements:
# - Node 18/20
# - MySQL + Redis running
# - (Optional) PM2

read_yn () {
  local prompt="$1"
  local def="${2:-y}"
  local ans
  read -r -p "$prompt [y/n] (default: $def): " ans || true
  ans="${ans:-$def}"
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

read_val () {
  local prompt="$1"
  local def="${2:-}"
  local ans
  if [[ -n "$def" ]]; then
    read -r -p "$prompt (default: $def): " ans || true
    echo "${ans:-$def}"
  else
    read -r -p "$prompt: " ans || true
    echo "$ans"
  fi
}

echo "== VideoShare Interactive Installer =="

SITE_URL=$(read_val "SITE_URL (vd: https://yourdomain.com)" "https://example.com")

echo ""
echo "== MySQL (Prisma DATABASE_URL) =="
DB_HOST=$(read_val "MySQL host" "127.0.0.1")
DB_PORT=$(read_val "MySQL port" "3306")
DB_NAME=$(read_val "MySQL database name" "videoshare")
DB_USER=$(read_val "MySQL user" "root")
read -r -s -p "MySQL password (leave blank if none): " DB_PASS || true
echo ""

# URL encode password minimal (space/!/etc not handled fully; use simple passwords)
DB_PASS_ESC="${DB_PASS//\/\\}"
DB_PASS_ESC="${DB_PASS_ESC//@/%40}"
DB_PASS_ESC="${DB_PASS_ESC/:/%3A}"
DB_PASS_ESC="${DB_PASS_ESC//\//%2F}"

if [[ -n "$DB_PASS_ESC" ]]; then
  DATABASE_URL="mysql://${DB_USER}:${DB_PASS_ESC}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
  DATABASE_URL="mysql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

echo ""
echo "== Redis (BullMQ) =="
REDIS_HOST=$(read_val "Redis host" "127.0.0.1")
REDIS_PORT=$(read_val "Redis port" "6379")
read -r -s -p "Redis password (leave blank if none): " REDIS_PASS || true
echo ""
if [[ -n "$REDIS_PASS" ]]; then
  REDIS_URL="redis://:${REDIS_PASS}@${REDIS_HOST}:${REDIS_PORT}"
else
  REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"
fi

echo ""
echo "== Cloudflare R2 (required) =="
R2_ACCOUNT_ID=$(read_val "R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID=$(read_val "R2_ACCESS_KEY_ID")
read -r -s -p "R2_SECRET_ACCESS_KEY: " R2_SECRET_ACCESS_KEY || true
echo ""
R2_BUCKET=$(read_val "R2_BUCKET")
R2_PUBLIC_BASE_URL=$(read_val "R2_PUBLIC_BASE_URL (vd: https://pub-xxx.r2.dev)")

echo ""
echo "== Web3 RPC (optional but recommended for auto-credit) =="
SOLANA_RPC_URL=$(read_val "SOLANA_RPC_URL (Helius/QuickNode RPC URL)" "")
EVM_RPC_URL_BSC=$(read_val "EVM_RPC_URL_BSC" "")
EVM_RPC_URL_ETHEREUM=$(read_val "EVM_RPC_URL_ETHEREUM" "")
EVM_RPC_URL_POLYGON=$(read_val "EVM_RPC_URL_POLYGON" "")
EVM_RPC_URL_BASE=$(read_val "EVM_RPC_URL_BASE" "")
TRONGRID_API_KEY=$(read_val "TRONGRID_API_KEY (TRON)" "")
TRONGRID_API_URL=$(read_val "TRONGRID_API_URL" "https://api.trongrid.io")

echo ""
echo "== Telegram notify (optional) =="
TELEGRAM_NOTIFY_ENABLED="false"
if read_yn "Enable Telegram notifications?" "y"; then
  TELEGRAM_NOTIFY_ENABLED="true"
  TELEGRAM_BOT_TOKEN=$(read_val "TELEGRAM_BOT_TOKEN")
  TELEGRAM_CHAT_ID=$(read_val "TELEGRAM_CHAT_ID")
else
  TELEGRAM_BOT_TOKEN=""
  TELEGRAM_CHAT_ID=""
fi

echo ""
echo "Writing .env ..."
cat > .env <<EOF
# --- Core ---
APP_ENV=prod
SITE_URL=${SITE_URL}

# --- Database / Redis ---
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}

# --- R2 ---
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET=${R2_BUCKET}
R2_PUBLIC_BASE_URL=${R2_PUBLIC_BASE_URL}

# --- Payments watchers ---
SOLANA_RPC_URL=${SOLANA_RPC_URL}
EVM_RPC_URL_BSC=${EVM_RPC_URL_BSC}
EVM_RPC_URL_ETHEREUM=${EVM_RPC_URL_ETHEREUM}
EVM_RPC_URL_POLYGON=${EVM_RPC_URL_POLYGON}
EVM_RPC_URL_BASE=${EVM_RPC_URL_BASE}
TRONGRID_API_KEY=${TRONGRID_API_KEY}
TRONGRID_API_URL=${TRONGRID_API_URL}

PAYMENTS_WATCH_BSC_EVERY_MS=60000
PAYMENTS_WATCH_TRON_EVERY_MS=60000
PAYMENTS_WATCH_SOLANA_EVERY_MS=60000
PAYMENTS_WATCH_EVM_EVERY_MS=60000
PAYMENTS_WATCHER_STALE_MINUTES=10

# --- Telegram ---
TELEGRAM_NOTIFY_ENABLED=${TELEGRAM_NOTIFY_ENABLED}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
EOF

echo "== Install deps =="
npm install

echo "== Prisma migrate + generate =="
npx prisma migrate deploy
npx prisma generate

echo "== Build =="
export SKIP_REDIS_DURING_BUILD=1
npm run build

echo ""
echo "✅ Done build."
echo ""
echo "Next steps:"
echo "- If you use PM2:  pm2 start ecosystem.config.cjs && pm2 save"
echo "- If you use aaPanel Node Project:"
echo "    Web:    npm run start -- -p 3000"
echo "    Worker: node worker/dist/index.js"
