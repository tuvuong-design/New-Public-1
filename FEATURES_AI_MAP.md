# FEATURES_AI_MAP.md — v4.16.22

> Mục tiêu: giúp AI (khi mở chat mới) tìm đúng file/entrypoint nhanh nhất.
> File này map theo **code hiện có** trong repo (không phải wishlist).

**Current version:** v4.16.22

---

## 0) Source of truth
- `CHATKITFULL.txt` — bootstrap nhanh + invariants + contracts
- `PROJECT_CONTEXT.md` — kiến trúc + flows + env + contracts
- `AI_REQUIREMENTS.md` — checklist + non-negotiables
- `TASK_TEMPLATE_CONTINUE.md` — roadmap tasks (DONE/PARTIAL/TODO)
- `CHANGELOG.md` — timeline các phiên bản
- `CONTRACT_CHECKLIST.md` + `scripts/contract-check.sh` — chống drift contracts

---

## 1) Core flows

### Upload → Worker → Playback
- Upload UI: `app/upload/page.tsx`
- Upload API: `app/api/upload/*`
- Enqueue process: `app/api/videos/queue-process/route.ts` → `lib/queues.ts`
- Worker video jobs:
  - `worker/src/jobs/processVideo.ts`
  - `worker/src/jobs/encodeHls.ts`
  - optional: `worker/src/jobs/subtitles.ts`, `worker/src/jobs/clamavScan.ts`
- Playback:
  - Watch page: `app/v/[id]/page.tsx`
  - Player components: `components/player/*`

### HLS packaging (Admin `/admin/hls`)
- Admin UI: `app/admin/hls/page.tsx`
- Admin APIs: `app/api/admin/hls/*`
- Worker: `worker/src/jobs/encodeHls.ts`
- Modes: TS / fMP4 / Hybrid

### Storage redundancy (R2 + FTP + Drive)
- Admin UI:
  - `/admin/storage` → `app/admin/storage/page.tsx`
  - `/admin/storage/events` → `app/admin/storage/events/page.tsx`
- Admin APIs:
  - `app/api/admin/storage/*` (config + verify + test upload)
- Worker queue `storage`:
  - `worker/src/jobs/storage/applyPendingConfig.ts`
  - `worker/src/jobs/storage/healthScan.ts`
  - `worker/src/jobs/storage/backupOrigin.ts`
  - `worker/src/jobs/storage/rebuildHlsFromDrive.ts`

### Similar videos
- Ranking logic: `lib/videos/similar.ts`
- Cache + invalidate: `lib/videos/similarCache.ts`
- Redis keys:
  - `videoshare:similar:v1:{videoId}`
  - `videoshare:similar:index:v1:child:{childId}`

### Payments / Stars topup
- User UI: `app/stars/topup/*`
- Stars topup APIs (contract): `app/api/stars/topup/*`
- Webhooks:
  - `app/api/webhooks/helius/route.ts`
  - `app/api/webhooks/alchemy/route.ts`
  - `app/api/webhooks/quicknode/route.ts`
  - optional: `app/api/webhooks/trongrid/route.ts`
- Admin UI: `app/admin/payments/*`
  - Fraud Radar: `app/admin/payments/fraud/*`
  - Bundles (topup bonus): `app/admin/payments/bundles/*`
  - Coupons (topup bonus / season pass discount): `app/admin/payments/coupons/*`
- Admin APIs: `app/api/admin/payments/*`
  - Fraud alerts: `app/api/admin/payments/fraud/*`
  - Bundles API: `app/api/admin/payments/bundles/route.ts`
  - Coupons API: `app/api/admin/payments/coupons/*`
- Payments libs: `lib/payments/*`
- Worker payments jobs:
  - `worker/src/jobs/payments/*`
  - `worker/src/index.ts` registers repeatables (`reconcile_stale_scan`, `retry_dead_letters_scan`, `alert_cron`, `membership_billing_scan`)

### Moderation & reports
- Report APIs:
  - `app/api/reports/video/route.ts`
  - `app/api/reports/comment/route.ts`
- Admin moderation:
  - UI: `app/admin/moderation/*`, `app/admin/reports/*`
  - API: `app/api/admin/moderation/actions/route.ts`
- Worker:
  - review: `worker/src/jobs/moderation/review.ts`
  - escalation scan: `worker/src/jobs/moderation/escalationScan.ts` (triggered from `payments:alert_cron`)

### Notifications (in-app + email digest)
- Inbox/settings:
  - `/notifications`, `/settings/notifications`
  - APIs: `app/api/me/notifications/*`
- Weekly digest:
  - worker: `worker/src/jobs/notifications/weeklyDigest.ts`
  - email helper: `worker/src/email/resend.ts`

---

## 2) Studio modules (selected)
- Membership plans / gate: `app/studio/membership/*` + `app/api/studio/membership/*`
- SEO analyzer: `app/studio/videos/[id]/seo/*`
- Chapters: `app/studio/videos/[id]/chapters/*`
- Editor (trim/clip): `app/studio/editor/*` + worker `worker/src/jobs/editor/*`

---

## 3) Ops helpers
- Queue registration: `lib/queues.ts`, `worker/src/index.ts`
- Core docs sync: `scripts/sync-core-docs.sh`
- Contract-check: `scripts/contract-check.sh`

