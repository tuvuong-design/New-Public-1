# FEATURE_MAP.md — v4.16.22

Map nhanh: **tính năng ↔ file/folder chính**. Mục tiêu: AI/chat mới định vị code nhanh, tránh sửa nhầm chỗ / phá contract.

> Contracts: xem `CONTRACT_CHECKLIST.md`.

---

## 1) Upload & xử lý video
- Multipart upload init/sign/complete:
  - `app/api/upload/init/route.ts`
  - `app/api/upload/sign-part/route.ts`
  - `app/api/upload/complete/route.ts`
- Enqueue xử lý video:
  - `app/api/videos/queue-process/route.ts`
  - `lib/queues.ts`
- Worker:
  - `worker/src/jobs/processVideo.ts`
  - `worker/src/jobs/encodeHls.ts`
  - helpers: `worker/src/utils/*`

## 2) Playback
- Watch page: `app/v/[id]/page.tsx`
- Player components: `components/player/*`
- Stream resolver (origins/candidates): `lib/playback/resolveStream.ts` (R2 A/B + FTP HLS)
- Media URL helpers: `lib/mediaUrl.ts` (resolve R2 key vs absolute URL)

## 3) HLS packaging (Admin `/admin/hls`)
- Admin UI: `app/admin/hls/*`
- Admin API: `app/api/admin/hls/*`
- Worker encode: `worker/src/jobs/encodeHls.ts`
- Modes: TS / fMP4 / Hybrid

## 4) Storage redundancy (R2 + FTP + Drive)
- Admin UI:
  - `/admin/storage` → `app/admin/storage/page.tsx`
  - `/admin/storage/events` → `app/admin/storage/events/page.tsx`
- Admin APIs:
  - `app/api/admin/storage/*` (config/apply/cancel + verify + test upload)
- Worker queue `storage`:
  - `worker/src/jobs/storage/applyPendingConfig.ts`
  - `worker/src/jobs/storage/healthScan.ts`
  - `worker/src/jobs/storage/backupOrigin.ts`
  - `worker/src/jobs/storage/rebuildHlsFromDrive.ts`
- Core helpers:
  - `lib/storage/*`, `lib/r2/*` (tùy phiên bản)

## 5) Similar videos (advanced)
- Logic: `lib/videos/similar.ts`
- Redis cache + invalidation: `lib/videos/similarCache.ts`

## 6) Payments / Stars topup
- User pages:
  - `/history` → `app/history/page.tsx` (uses `VideoProgress`)
  - `/watch-later` → `app/watch-later/page.tsx` (uses `WatchLaterItem` + `VideoProgress`)
  - `/stars/topup` → `app/stars/topup/page.tsx` + `app/stars/topup/TopupClient.tsx`

- Watch Later APIs:
  - `GET /api/me/watch-later` → `app/api/me/watch-later/route.ts`
  - `POST /api/me/watch-later/toggle` → `app/api/me/watch-later/toggle/route.ts`

- Prisma models:
  - `VideoProgress` + `WatchLaterItem` → `prisma/schema.prisma`
- Stars topup APIs (contract):
  - `app/api/stars/topup/*`
- Webhooks:
  - `app/api/webhooks/helius/route.ts`
  - `app/api/webhooks/alchemy/route.ts`
  - `app/api/webhooks/quicknode/route.ts`
- Admin payments:
  - UI: `app/admin/payments/*`
    - Fraud Radar: `/admin/payments/fraud` → `app/admin/payments/fraud/*`
    - Bundles: `/admin/payments/bundles` → `app/admin/payments/bundles/*`
    - Coupons: `/admin/payments/coupons` → `app/admin/payments/coupons/*`
  - API: `app/api/admin/payments/*`
    - Fraud alerts: `GET/POST /api/admin/payments/fraud/*`
    - Bundles: `GET/POST /api/admin/payments/bundles`
    - Coupons: `GET/POST /api/admin/payments/coupons`, `DELETE /api/admin/payments/coupons/[id]`
- Prisma:
  - `FraudAlert` model → `prisma/schema.prisma`
- Worker (queue `payments`):
  - `worker/src/jobs/payments/*`
    - `fraudRadarScanJob` runs from `payments:alert_cron`

## 7) Reports & Moderation
- Report APIs:
  - `POST /api/reports/video` → `app/api/reports/video/route.ts`
  - `POST /api/reports/comment` → `app/api/reports/comment/route.ts`
- Admin moderation:
  - UI: `app/admin/moderation/*`
  - API: `app/api/admin/moderation/actions/route.ts`
- Worker:
  - Review: `worker/src/jobs/moderation/review.ts`
  - Escalation scan: `worker/src/jobs/moderation/escalationScan.ts` (triggered from `payments:alert_cron`)

## 8) Notifications
- Inbox/settings:
  - `/notifications`, `/settings/notifications`
  - APIs: `app/api/me/notifications/*`
- Weekly digest:
  - worker: `worker/src/jobs/notifications/weeklyDigest.ts`
  - optional email: `worker/src/email/resend.ts`

## 9) Sensitive videos + password gate
- Sensitive:
  - `lib/sensitive.ts`, `components/sensitive/*`
  - user pref API: `app/api/user/preferences/sensitive/route.ts`
- Password gate (401):
  - `lib/videoPassword.ts`
  - unlock API: `app/api/videos/[id]/unlock/route.ts`
  - unauthorized page: `app/v/[id]/unauthorized.tsx`

## 10) Analytics (MVP)
- Ingest: `app/api/analytics/events/route.ts` → queue `analytics`
- Worker: `worker/src/jobs/analytics/ingestEvents.ts`
- Studio dashboards: `app/studio/analytics/*`

## 11) Editor / Clips
- Enqueue trim/clip:
  - `app/api/studio/editor/trim/route.ts`
  - `app/api/studio/editor/clip/route.ts` (nếu có)
- Worker:
  - `worker/src/jobs/editor/trimVideo.ts`
  - `worker/src/jobs/editor/createClip.ts`

## 12) NFT (internal + export)
- UI: `app/nft/*`, `app/studio/clips/*`, `app/studio/membership/*`
- APIs: `app/api/nft/*`
- Worker queue `nft`: `worker/src/jobs/nft/*`

---
Nếu thêm feature mới: update file này + `FEATURES_AI_MAP.md` + `CHANGELOG.md`, và sync core docs.


## Player / HLS (PeerTube-ish)
- hls.js player (ABR Auto + manual quality)
- Stats overlay
- Retry/backoff + origin failover (R2 A/B + FTP HLS)
- Playlist rewrite to absolute URLs
- Optional prefetch next segments (light)
- Theater mode + mini-player + PiP
- Hotkeys: J/K/L, arrows, F, M
- Experimental: P2P flag `SiteConfig.playerP2PEnabled` (dependency required)


### Engagement
- Share Cards OG (video/clip/creator)
- Continue Watching digest (daily in-app, optional)
## Season Pass (30 ngày)
- UI: `app/stars/topup/TopupClient.tsx` (purchase + status)
- APIs:
  - `app/api/season-pass/status/route.ts`
  - `app/api/season-pass/purchase/route.ts`
- Access gate:
  - `lib/videoAccessDb.ts` (premium gating bypass if SeasonPass active)
- DB:
  - `SeasonPass`, `SeasonPassPurchase` (Prisma)
  - Ledger: `StarTransaction.type=SEASON_PASS_PURCHASE`, `discountReason=SEASON_PASS_30D`

## Referral Stars (1–20%)
- UI:
  - `/settings/referral` → `app/settings/referral/*`
- APIs:
  - `app/api/referrals/me/route.ts`
  - `app/api/referrals/claim/route.ts`
- Core logic:
  - `lib/referrals.ts` (`applyReferralBonusTx`)
  - Worker TOPUP hook: `worker/src/jobs/payments/reconcileDeposit.ts`
  - EARN hooks: `app/api/creator/tip/route.ts`, `app/api/creator/membership/join/route.ts`
- DB:
  - `User.referralCode`, `User.referredById`
  - `ReferralBonus` (idempotency: unique `(sourceKind, sourceId)`)
  - Ledger: `StarTransaction.type=REFERRAL_BONUS`
