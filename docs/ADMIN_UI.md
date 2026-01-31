# ADMIN_UI.md — v4.16.22

Mục tiêu: liệt kê nhanh **admin pages + admin APIs** theo đúng contract, kèm notes bảo mật (guard, pending apply, audit).

## Guard rules (bắt buộc)
- Admin pages: `app/admin/*` → **guard bằng role `ADMIN`**
- Admin APIs: `app/api/admin/*` → **guard bằng role `ADMIN`** (xem `lib/authz.ts`)
- Không đổi routes/contracts nếu không có migration + update toàn call-sites + contract-check.

---

## 1) Admin pages

### 1.1 Payments (contract)
- `/admin/payments` → `app/admin/payments/page.tsx`
- `/admin/payments/deposits` → `app/admin/payments/deposits/page.tsx`
- `/admin/payments/deposits/[id]` → `app/admin/payments/deposits/[id]/page.tsx`
- `/admin/payments/unmatched` → `app/admin/payments/unmatched/page.tsx`
- `/admin/payments/events` → `app/admin/payments/events/page.tsx`
- `/admin/payments/webhooks` → `app/admin/payments/webhooks/page.tsx`
- `/admin/payments/config` → `app/admin/payments/config/page.tsx`
- `/admin/payments/fraud` → `app/admin/payments/fraud/page.tsx` (Fraud Radar)
- `/admin/payments/bundles` → `app/admin/payments/bundles/page.tsx` (Topup bonusStars)
- `/admin/payments/coupons` → `app/admin/payments/coupons/page.tsx` (Topup bonus / Season Pass discount)

### 1.2 Storage redundancy (R2 + FTP + Drive)
- `/admin/storage` → `app/admin/storage/page.tsx`
- `/admin/storage/events` → `app/admin/storage/events/page.tsx`

**Security model:** thay đổi storage config luôn **pending apply 24h** + audit feed + notify admins.

`/admin/storage` hiện quản lý thêm **R2 Playback A/B** (public base URL A/B + split %) dùng cho Watch/Player routing (DB override; fallback env).

### 1.3 HLS packaging
- `/admin/hls` → `app/admin/hls/page.tsx`
  - TS / fMP4 / Hybrid

### 1.4 Moderation / Reports
- `/admin/moderation` → `app/admin/moderation/page.tsx`
- `/admin/moderation/actions` → `app/admin/moderation/actions/page.tsx`
- `/admin/moderation/keywords` → `app/admin/moderation/keywords/page.tsx`
- `/admin/reports` → `app/admin/reports/page.tsx`
- `/admin/reports/comments` → `app/admin/reports/comments/page.tsx`

### 1.5 Site config / Ads
- `/admin/config` → `app/admin/config/page.tsx`
- `/admin/ads` → `app/admin/ads/page.tsx`

### 1.6 NFT (admin)
- `/admin/nft/contracts` → `app/admin/nft/contracts/page.tsx`
- `/admin/nft/events` → `app/admin/nft/events/page.tsx`

### 1.7 Docs (contract)
- `/admin/docs` → `app/admin/docs/page.tsx`
  - render từ `docs/docs.nav.json`

---

## 2) Admin APIs

### 2.1 Payments (contract)
- `GET /api/admin/payments/dashboard` → `app/api/admin/payments/dashboard/route.ts`
- `GET /api/admin/payments/export/deposits` → `app/api/admin/payments/export/deposits/route.ts`
- `GET /api/admin/payments/export/events` → `app/api/admin/payments/export/events/route.ts`
- `GET /api/admin/payments/export/webhooks` → `app/api/admin/payments/export/webhooks/route.ts`
- `GET/POST /api/admin/payments/config` → `app/api/admin/payments/config/route.ts`
- `GET/POST /api/admin/payments/secrets` → `app/api/admin/payments/secrets/route.ts`
- `POST /api/admin/payments/deposits/assign-user` → `app/api/admin/payments/deposits/assign-user/route.ts`
- `POST /api/admin/payments/deposits/reconcile` → `app/api/admin/payments/deposits/reconcile/route.ts`
- `POST /api/admin/payments/deposits/manual-credit` → `app/api/admin/payments/deposits/manual-credit/route.ts`
- `POST /api/admin/payments/deposits/refund` → `app/api/admin/payments/deposits/refund/route.ts`
- `GET/POST /api/admin/payments/bundles` → `app/api/admin/payments/bundles/route.ts`
- `GET/POST /api/admin/payments/coupons` → `app/api/admin/payments/coupons/route.ts`
- `DELETE /api/admin/payments/coupons/[id]` → `app/api/admin/payments/coupons/[id]/route.ts`
- `GET /api/admin/payments/fraud/alerts` → `app/api/admin/payments/fraud/alerts/route.ts`
- `POST /api/admin/payments/fraud/alerts/ack` → `app/api/admin/payments/fraud/alerts/ack/route.ts`
- `POST /api/admin/payments/fraud/alerts/resolve` → `app/api/admin/payments/fraud/alerts/resolve/route.ts`

### 2.2 Storage redundancy
- `POST /api/admin/storage/config` → `app/api/admin/storage/config/route.ts`
  - set pending / apply now / cancel pending (theo rules)
- `POST /api/admin/storage/ftp/verify` → `app/api/admin/storage/ftp/verify/route.ts`
- `POST /api/admin/storage/ftp/test-upload` → `app/api/admin/storage/ftp/test-upload/route.ts`
- `POST /api/admin/storage/drive/verify` → `app/api/admin/storage/drive/verify/route.ts`

> Yêu cầu: `APP_ENCRYPTION_KEY` phải set để encrypt secrets trong DB.

### 2.3 HLS packaging
- `GET/POST /api/admin/hls/config` (tuỳ phiên bản) → `app/api/admin/hls/*`
- UI `/admin/hls` chỉ là form; encode thực tế do worker `encodeHls`.

### 2.4 Moderation
- `POST /api/admin/moderation/actions` → `app/api/admin/moderation/actions/route.ts`

### 2.5 Site config / Ads
- `GET/POST /api/admin/site-config` → `app/api/admin/site-config/route.ts`
- `GET/POST /api/admin/ad-placement` → `app/api/admin/ad-placement/route.ts`

### 2.6 NFT contracts rotation
- `GET/POST /api/admin/nft/contracts` → `app/api/admin/nft/contracts/route.ts`

---

## 3) Worker hooks liên quan Admin
### Payments queue (`payments`)
- repeatables: `reconcile_stale_scan`, `retry_dead_letters_scan`, `alert_cron`
- `alert_cron` cũng chạy best-effort moderation escalation scan

### Storage queue (`storage`)
- repeatables: `apply_pending_config`, `health_scan`
- jobs: `backup_origin`, `mirror_hls`, `rebuild_hls_from_drive`

---
Nếu thêm trang admin mới: update file này + `docs/docs.nav.json` (nếu cần show trong `/admin/docs`).


## Share Cards (OG)

- Video: `/api/og/video/[id]`
- Clip: `/api/og/clip/[id]`
- Creator: `/api/og/creator/[id]`
## Growth / Monetization (Payments Config)
- UI: `/admin/payments/config`
  - Season Pass: enable + price (Stars)
  - Referral Stars: enable + percent (1–20) + apply-to TOPUP/EARN

### Related APIs
- `GET/POST /api/admin/payments/config`
- Season Pass:
  - `GET /api/season-pass/status`
  - `POST /api/season-pass/purchase`
- Referrals:
  - `GET /api/referrals/me`
  - `POST /api/referrals/claim`
