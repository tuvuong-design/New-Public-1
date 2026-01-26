#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "❌ $1" >&2
  exit 1
}

ok() {
  echo "✅ $1"
}

check_path() {
  local p="$1"
  [ -e "$p" ] || fail "Missing: $p"
  ok "Found: $p"
}

check_contains() {
  local p="$1"; local needle="$2"; local label="$3"
  [ -e "$p" ] || fail "Missing file for check: $p"
  grep -qF "$needle" "$p" || fail "Missing text in $p: $label ($needle)"
  ok "Contains: $label"
}

echo "=== VideoShare contract-check ==="

# Pages
check_path "app/v/[id]/page.tsx"
check_path "app/upload/page.tsx"
check_path "app/history/page.tsx"
check_path "app/watch-later/page.tsx"
check_path "app/stars/topup/page.tsx"

# Admin pages (payments)
check_path "app/admin/payments/page.tsx"
check_path "app/admin/payments/deposits/page.tsx"
check_path "app/admin/payments/deposits/[id]/page.tsx"
check_path "app/admin/payments/unmatched/page.tsx"
check_path "app/admin/payments/events/page.tsx"
check_path "app/admin/payments/webhooks/page.tsx"
check_path "app/admin/payments/config/page.tsx"
check_path "app/admin/docs/page.tsx"

# Admin pages (storage/hls)
check_path "app/admin/storage/page.tsx"
check_path "app/admin/storage/events/page.tsx"
check_path "app/admin/hls/page.tsx"

# API routes
check_path "lib/videos/similar.ts"
check_path "lib/videos/similarCache.ts"
check_path "app/api/stars/topup/intent/route.ts"
check_path "app/api/stars/topup/submit-tx/route.ts"
check_path "app/api/stars/topup/history/route.ts"
check_path "app/api/stars/topup/retry/route.ts"

check_path "app/api/webhooks/helius/route.ts"
check_path "app/api/webhooks/alchemy/route.ts"
check_path "app/api/webhooks/quicknode/route.ts"
# optional: trongrid
if [ -e "app/api/webhooks/trongrid/route.ts" ]; then
  ok "Found optional: app/api/webhooks/trongrid/route.ts"
else
  echo "ℹ️ Optional missing: app/api/webhooks/trongrid/route.ts"
fi

check_path "app/api/admin/payments/dashboard/route.ts"
check_path "app/api/admin/payments/export/deposits/route.ts"
check_path "app/api/admin/payments/export/events/route.ts"
check_path "app/api/admin/payments/export/webhooks/route.ts"
check_path "app/api/admin/payments/config/route.ts"
check_path "app/api/admin/payments/secrets/route.ts"
check_path "app/api/admin/payments/deposits/assign-user/route.ts"
check_path "app/api/admin/payments/deposits/reconcile/route.ts"
check_path "app/api/admin/payments/deposits/manual-credit/route.ts"
check_path "app/api/admin/payments/deposits/refund/route.ts"

# Worker queue names / jobs
check_contains "worker/src/queues.ts" "new Queue(\"payments\"" "Queue name: payments"
check_contains "worker/src/queues.ts" "new Queue(\"storage\"" "Queue name: storage"

check_contains "worker/src/index.ts" "process_webhook_audit" "payments job: process_webhook_audit"
check_contains "worker/src/index.ts" "reconcile_deposit" "payments job: reconcile_deposit"
check_contains "worker/src/index.ts" "reconcile_stale_scan" "payments repeatable: reconcile_stale_scan"
check_contains "worker/src/index.ts" "retry_dead_letters_scan" "payments repeatable: retry_dead_letters_scan"
check_contains "worker/src/index.ts" "alert_cron" "payments repeatable: alert_cron"

check_contains "worker/src/index.ts" "apply_pending_config" "storage repeatable: apply_pending_config"
check_contains "worker/src/index.ts" "health_scan" "storage repeatable: health_scan"
check_contains "worker/src/index.ts" "backup_origin" "storage job: backup_origin"
check_contains "worker/src/index.ts" "rebuild_hls_from_drive" "storage job: rebuild_hls_from_drive"

# Redis keys
check_contains "lib/videos/similarCache.ts" "videoshare:similar:v1:" "Redis prefix: videoshare:similar:v1"
# fan-out index may live elsewhere; search whole repo for safety
if grep -R -qF "videoshare:similar:index:v1:child:" .; then
  ok "Contains: Redis prefix videoshare:similar:index:v1:child"
else
  fail "Missing Redis prefix videoshare:similar:index:v1:child"
fi
if grep -R -qF "videoshare:ratelimit:" .; then
  ok "Contains: Redis prefix videoshare:ratelimit"
else
  fail "Missing Redis prefix videoshare:ratelimit"
fi

echo "=== ✅ contract-check PASSED ==="
