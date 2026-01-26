# VideoShare Contracts Checklist (Anti-drift)

> Checklist này dùng để tránh lệch contract (paths, API routes, worker/queues, Redis keys) giữa các bản ZIP và khi deploy.

## Chạy nhanh

```bash
bash scripts/contract-check.sh
```

---

## 1) Pages contracts (PHẢI GIỮ NGUYÊN PATH)

### User pages
- [ ] `/v/[id]`  → `app/v/[id]/page.tsx`
- [ ] `/upload` → `app/upload/page.tsx`
- [ ] `/history` → `app/history/page.tsx`
- [ ] `/watch-later` → `app/watch-later/page.tsx`
- [ ] `/stars/topup` → `app/stars/topup/page.tsx`

### Admin payments pages
- [ ] `/admin/payments` → `app/admin/payments/page.tsx`
- [ ] `/admin/payments/deposits` → `app/admin/payments/deposits/page.tsx`
- [ ] `/admin/payments/deposits/[id]` → `app/admin/payments/deposits/[id]/page.tsx`
- [ ] `/admin/payments/unmatched` → `app/admin/payments/unmatched/page.tsx`
- [ ] `/admin/payments/events` → `app/admin/payments/events/page.tsx`
- [ ] `/admin/payments/webhooks` → `app/admin/payments/webhooks/page.tsx`
- [ ] `/admin/payments/config` → `app/admin/payments/config/page.tsx`
- [ ] `/admin/docs` → `app/admin/docs/page.tsx`

### Storage/HLS admin (v4.16.x)
- [ ] `/admin/storage` → `app/admin/storage/page.tsx`
- [ ] `/admin/storage/events` → `app/admin/storage/events/page.tsx`
- [ ] `/admin/hls` → `app/admin/hls/page.tsx`

---

## 2) API routes contracts (PHẢI GIỮ NGUYÊN PATH)

### Similar videos
- [ ] `lib/videos/similar.ts`
- [ ] `lib/videos/similarCache.ts`

### Stars topup
- [ ] `POST /api/stars/topup/intent` → `app/api/stars/topup/intent/route.ts`
- [ ] `POST /api/stars/topup/submit-tx` → `app/api/stars/topup/submit-tx/route.ts`
- [ ] `GET  /api/stars/topup/history` → `app/api/stars/topup/history/route.ts`
- [ ] `POST /api/stars/topup/retry` → `app/api/stars/topup/retry/route.ts`

### Webhooks
- [ ] `POST /api/webhooks/helius` → `app/api/webhooks/helius/route.ts`
- [ ] `POST /api/webhooks/alchemy` → `app/api/webhooks/alchemy/route.ts`
- [ ] `POST /api/webhooks/quicknode` → `app/api/webhooks/quicknode/route.ts`
- [ ] *(optional)* `POST /api/webhooks/trongrid` → `app/api/webhooks/trongrid/route.ts`

### Admin payments APIs (ADMIN guard bắt buộc)
- [ ] `GET  /api/admin/payments/dashboard` → `app/api/admin/payments/dashboard/route.ts`
- [ ] `GET  /api/admin/payments/export/deposits` → `app/api/admin/payments/export/deposits/route.ts`
- [ ] `GET  /api/admin/payments/export/events` → `app/api/admin/payments/export/events/route.ts`
- [ ] `GET  /api/admin/payments/export/webhooks` → `app/api/admin/payments/export/webhooks/route.ts`
- [ ] `GET/POST /api/admin/payments/config` → `app/api/admin/payments/config/route.ts`
- [ ] `GET/POST /api/admin/payments/secrets` → `app/api/admin/payments/secrets/route.ts`
- [ ] `POST /api/admin/payments/deposits/assign-user` → `app/api/admin/payments/deposits/assign-user/route.ts`
- [ ] `POST /api/admin/payments/deposits/reconcile` → `app/api/admin/payments/deposits/reconcile/route.ts`
- [ ] `POST /api/admin/payments/deposits/manual-credit` → `app/api/admin/payments/deposits/manual-credit/route.ts`
- [ ] `POST /api/admin/payments/deposits/refund` → `app/api/admin/payments/deposits/refund/route.ts`

---

## 3) Worker / Queues contracts

> Rule: tác vụ nặng (scan, reconcile, encode, mirror, rebuild) chạy trong **/worker**, không chạy trong web request.

### Queue: payments (PHẢI GIỮ NGUYÊN)
- [ ] `process_webhook_audit`
- [ ] `reconcile_deposit`
- [ ] `reconcile_stale_scan` *(repeatable)*
- [ ] `retry_dead_letters_scan` *(repeatable)*
- [ ] `alert_cron` *(repeatable)*

### Queue: storage (v4.16.x)
- [ ] repeatables: `apply_pending_config`, `health_scan`
- [ ] jobs: `backup_origin`, `mirror_hls`, `rebuild_hls_from_drive`

---

## 4) Redis keys contracts (PHẢI GIỮ NGUYÊN)

- [ ] Similar cache: `videoshare:similar:v1:{videoId}`
- [ ] Fan-out index: `videoshare:similar:index:v1:child:{childId}`
- [ ] Rate-limit: `videoshare:ratelimit:{bucketKey}`

---

## 5) Manual review checklist (điểm hay trượt)

### A) Server/Client boundary (Next.js App Router)
- [ ] Server Component không dùng `onClick/onSubmit`, hooks, DOM APIs.
- [ ] Nếu cần tương tác: tách `"use client"` component hoặc dùng `<form action>` + route handler.

### B) Prisma sync / drift
- [ ] Nếu schema đổi: đảm bảo `prisma db push` (dev) hoặc migration (prod) đã áp đúng.
- [ ] Các unique/index cho idempotency phải còn nguyên.

### C) Webhook parsing + signature + raw body
- [ ] Provider cần verify signature: đọc `req.text()` để giữ raw body, verify rồi mới `JSON.parse`.
- [ ] Không làm work nặng trong request: chỉ validate + persist tối thiểu + enqueue.

### D) Idempotency credit (tránh double-credit)
- [ ] Credit Stars phải có idempotency key ở DB (unique) + xử lý retry safe.
- [ ] Worker job phải transaction-safe, retry không tăng Stars 2 lần.

### E) Strict allowlist + storage delay 24h
- [ ] Admin APIs/pages đều guard role `ADMIN`.
- [ ] Webhooks chỉ accept đúng provider + allowlist/verify.
- [ ] Storage config: validate strict (host/scheme/port), và **apply delay 24h + event log + notify admin**.
