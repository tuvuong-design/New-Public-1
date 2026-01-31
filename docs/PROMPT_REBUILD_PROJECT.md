Current Version: 4.16.20

## v4.16.x additions (Storage + HLS + Trust & Safety)
- Storage redundancy: Admin `/admin/storage` (verify + test upload + pending apply 24h + audit) + worker queue `storage` (apply_pending_config, health_scan, backup_origin, mirror_hls, rebuild_hls_from_drive).
- HLS packaging: Admin `/admin/hls` chọn TS / fMP4 / Hybrid; worker `encodeHls` sinh output immutable theo encodeId.
- Trust & Safety: moderation escalation scan (auto mute/ban) chạy best-effort trong repeatable `payments:alert_cron` + weekly digest in-app + optional email (Resend).


## v4.12.0 additions (Growth Hacker Phase A)
- CTR tracking: client-side card impression/click events (`CARD_IMPRESSION`, `CARD_CLICK`) via `POST /api/analytics/events` queued to `analytics` worker.
- Studio Analytics: `/studio/analytics` tổng quan views/unique/watch time + CTR chart + top traffic sources.
- Per-video analytics: `/studio/videos/[id]/analytics` hiển thị CTR theo ngày (MVP).


## v4.11.0 additions (Trust, safety & infra)
- Admin Stars ledger + export CSV
- Stars credit risk rules + alert_cron spike alerts
- Moderation queue pipeline for reports
- CDN purge queue (Cloudflare optional)
- Search FULLTEXT relevance + Redis hot cache

# PROMPT_REBUILD_PROJECT.md

> Dùng file này làm **prompt gốc** khi mở chat mới để AI có thể **rebuild toàn bộ dự án VideoShare Next.js từ đầu** đúng stack/contract.

**Target version:** v4.16.22

---

## v4.8.x scope (Task 9–15)
Khi rebuild, repo target **phải** bao gồm các phần đã implement ở v4.8.x:
- Task 9 (Search & Discovery): pages `/search`, `/explore`, `/tag/[slug]`, `/category/[slug]`; API `GET /api/search`, `GET /api/search/suggest`.
- Task 10 (Offline Mode/PWA): `public/sw.js`, `/offline`, client register component `components/pwa/PwaRegister.tsx`, offline upload queue `lib/pwa/offlineUploadQueue.ts` (tích hợp trong `/upload`).
- Task 11 (Creator monetization): tip API `POST /api/creator/tip`, notifications `CREATOR_TIP`, studio revenue `/studio/revenue`, creator webhooks outbox + manager `/studio/webhooks`.
- Task 12 (Gamification): XP/Level + badges + daily tasks + leaderboard `/leaderboard`, APIs `GET /api/gamification/me`, `GET /api/gamification/leaderboard`.
- Task 13 (Chapters): public API `GET /api/videos/[id]/chapters`, studio editor `/studio/videos/[id]/chapters`, chapters UI dưới player với seek.
- Task 14 (Public API + RSS): public read-only API `GET /api/public/videos`, `GET /api/public/video/[id]` (alias `.../videos/[id]`), `GET /api/public/search`; RSS `/rss.xml` và `/u/[id]/rss.xml`.
- Task 15 (Editor + Record MVP): studio editor `/studio/editor` (trim enqueue `POST /api/studio/editor/trim` → worker queue `editor`), screen recording `/studio/record`.


## 0) Context
Bạn là Senior Engineer/Tech Lead. Hãy tạo một repository **VideoShare Next.js (App Router)** từ đầu, theo đúng spec dưới đây.

## 1) Non-negotiables (không được phá)
### 1.1 Stack
- Next.js App Router (`app/`) + TypeScript
- Tailwind + shadcn-like components tự implement (`components/ui/*`)
- Prisma + MySQL
- NextAuth (role `ADMIN`/`USER`) — admin pages + admin APIs phải guard
- Redis + BullMQ; tác vụ nặng chạy trong `/worker` (không chạy trong web request)
- Cloudflare R2 (S3 compatible) + CDN; object keys versioned/immutable để giảm Class A/B

### 1.2 Constraints quan trọng
- Không dùng `onClick/onSubmit` trong **server components**; tách client components hoặc dùng `form` + route handler.
- Giữ nguyên contracts (pages, API routes, queue/job names, Redis keys). Nếu đổi phải có migration + update toàn bộ call-sites.
- Payments phải idempotent (cùng txHash/signature không được credit 2 lần).

## 2) Contracts (giữ nguyên)
### 2.1 Pages
User:
- `/v/[id]`, `/upload`, `/history`, `/watch-later`, `/stars/topup`

Admin:
- `/admin/payments`, `/admin/payments/deposits`, `/admin/payments/deposits/[id]`, `/admin/payments/unmatched`
- `/admin/payments/events`, `/admin/payments/webhooks`, `/admin/payments/config`, `/admin/docs`

NFT Admin:
- `/admin/nft/contracts`, `/admin/nft/events`

### 2.2 API routes quan trọng
Similar:
- `lib/videos/similar.ts` + `lib/videos/similarCache.ts`

NFT (internal + export foundation):
- Listings: `POST /api/nft/listings/create`, `POST /api/nft/listings/[id]/cancel`, `POST /api/nft/listings/[id]/buy`
- Auctions: `POST /api/nft/auctions/create`, `POST /api/nft/auctions/[id]/bid`, `POST /api/nft/auctions/[id]/cancel`, `POST /api/nft/auctions/[id]/settle`
- Export: `POST /api/nft/export/request`, `POST /api/nft/export/submit-tx`
- Admin: `GET/POST /api/admin/nft/contracts`

Stars topup:
- `POST /api/stars/topup/intent`
- `POST /api/stars/topup/submit-tx`
- `GET  /api/stars/topup/history`
- `POST /api/stars/topup/retry`

Webhooks (native payload):
- `POST /api/webhooks/helius`
- `POST /api/webhooks/alchemy`
- `POST /api/webhooks/quicknode`
- (optional) `POST /api/webhooks/trongrid`

Admin payments:
- `GET /api/admin/payments/dashboard`
- `GET /api/admin/payments/export/deposits`
- `GET /api/admin/payments/export/events`
- `GET /api/admin/payments/export/webhooks`
- `GET/POST /api/admin/payments/config`
- `GET/POST /api/admin/payments/secrets`
- `POST /api/admin/payments/deposits/assign-user`
- `POST /api/admin/payments/deposits/reconcile`
- `POST /api/admin/payments/deposits/manual-credit`
- `POST /api/admin/payments/deposits/refund`

## 3) Worker / Queues (giữ nguyên tên)
Queue: `payments` jobs:
- `process_webhook_audit`
- `reconcile_deposit`
- `reconcile_stale_scan` (repeatable)
- `retry_dead_letters_scan` (repeatable)
- `alert_cron` (repeatable)

Defaults (nếu không override env):
- `PAYMENTS_RECONCILE_EVERY_MS=120000`
- `PAYMENTS_SUBMITTED_STALE_MINUTES=10`
- `PAYMENTS_TOLERANCE_BPS=50`

Video queues:
- `processVideo`
- `encodeHls`
- (optional) `subtitles`, `clamavScan`

NFT queue:
- Queue: `nft`
- Jobs: `nft_export_prepare`, `nft_export_verify_tx`

## 4) Redis keys (giữ nguyên)
- Similar cache: `videoshare:similar:v1:{videoId}`
- Fan-out index: `videoshare:similar:index:v1:child:{childId}`
- Rate-limit: `videoshare:ratelimit:{bucketKey}`

## 5) Feature requirements (high-level)
### 5.1 Upload + Worker pipeline
- Multipart upload lên R2
- Worker ffmpeg tạo thumbnail/preview + encode HLS ABR (ưu tiên SINGLE_FILE/byterange)

### 5.2 Similar videos + cache
- Advanced scoring (tags + category + full-text) + Redis cache + invalidation

### 5.3 Sensitive videos (PeerTube-like)
- `Video.isSensitive` flag
- Viewer preference `User.sensitiveMode` (SHOW/BLUR/HIDE) + site default `SiteConfig.sensitiveDefaultMode`
- Watch page có overlay gate “Tôi hiểu và muốn xem” (giữ SEO/indexing)
- OG image `/api/og/video/[id]` blur + warning

### 5.4 Ads targeting (device/bot)
- `AdPlacement.showOnMobile/showOnTablet/showOnDesktop/hideForBots`
- Mặc định: chỉ mobile+tablet, ẩn bots
- Global banners: `GLOBAL_TOP` + `GLOBAL_BOTTOM`

### 5.5 Payments / Stars topup
- Webhooks ingest (Helius/Alchemy/QuickNode) + audit log
- Worker reconcile pipeline + cron scans
- Admin payments dashboard + export CSV

## 6) Docs requirements
Repo phải có docs để mở chat mới AI không bị lệch:
- `PROJECT_CONTEXT.md`, `AI_REQUIREMENTS.md`, `TASK_TEMPLATE_CONTINUE.md`
- `FEATURES_AI_MAP.md`
- `CHANGELOG.md`
- `docs/` (rendered trong `/admin/docs`) gồm `docs/docs.nav.json`, `docs/QUICKSTART.md`, `docs/AAPANEL_DEPLOY.md`, ...

## 7) Commands / cách chạy
```bash
# db
npm run db:up
npm run prisma:generate
npm run prisma:push
npm run prisma:seed

# dev
npm run dev
npm run worker:dev

# prod
npm run build
npm run start
npm run worker
```

## 8) Version notes
- v4.2.0: Payments/Stars (topup) + admin payments pages + worker payments queue
- v4.2.3: Sensitive videos (PeerTube-like) + ads targeting by device/bot + global banners
- v4.2.4: docs/roadmap update + aaPanel deploy guide
- v4.3.0: schema alignment fixes (Admin SiteConfig fields, Premium+ free boosts quota, comments highlight, NFT mint fees + metadata lock)
- v4.3.8: My Channel Sync (PeerTube vibe) `/my-channel/sync` + user APIs `/api/me/sync-sources/*` + ApiSource ownership/status.
- v4.4.0: Docs “xương sống” refresh + add Prisma groundwork for Notifications (`NotificationType`, `Notification`).

---

### Output yêu cầu khi rebuild
1) Tạo full codebase (web + worker)
2) Bảo đảm chạy local bằng docker-compose (MySQL+Redis) + scripts
3) Bảo đảm giữ đúng contracts/keys/job names
4) Update docs & CHANGELOG đúng version

## Snapshot v4.10.0
Khi rebuild/continue, đảm bảo giữ nguyên contracts Payments/Stars/Similar/Webhooks, và đã có thêm: Playlists (`/playlists`, `/p/[id]`), Continue Watching + History (`GET /api/progress`), và comment pin/heart qua `/api/comments/moderate`.

## Bổ sung v4.10.0 (Retention & Community)
Khi rebuild/triage, ưu tiên giữ đúng các pages/API mới:
- `/playlists`, `/p/[id]`, `/history`
- `/api/playlists*`, `GET /api/progress?videoId=...`
- Comment moderation actions `PIN/UNPIN/HEART/UNHEART` (owner/admin).
Và đảm bảo Prisma có `Playlist/PlaylistItem` + comment pin/heart fields.

## v4.10.0 additions
- Add search trending tracking + endpoint
- Add notification settings table + API + settings page
- Add comment reporting + admin review
- Add creator fan club (membership plans + join) with idempotency

## Storage / HLS / Player notes
- Giữ contracts payments/similar/webhooks/stars topup.
- Storage redundancy: `/admin/storage` + worker `storage` queue là source of truth cho fallback/rebuild HLS.
- HLS packaging lựa chọn trong `/admin/hls`: TS / fMP4 / Hybrid.
- Player roadmap: triển khai theo Phase 1/2/3 trong `TASK_TEMPLATE_CONTINUE.md`.
