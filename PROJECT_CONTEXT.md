# PROJECT_CONTEXT.md — “Tờ giấy nhớ” dự án VideoShare

## Current snapshot — v4.16.24 (Jan 2026)

- **Storage redundancy**: R2 primary + optional FTP Origin (MP4) + FTP HLS (fallback playback) + Google Drive origin (deep backup). Admin `/admin/storage` dùng **pending apply 24h** + audit + notify. Worker queue `storage` chạy `apply_pending_config`, `health_scan`, `backup_origin`, `mirror_hls`, `rebuild_hls_from_drive`.
- **HLS packaging**: Admin `/admin/hls` chọn TS / fMP4 / Hybrid; encode chạy trong worker `worker/src/jobs/encodeHls.ts`; HLS keys immutable theo `encodeId`.
- **Payments pipeline**: webhooks `/api/webhooks/*` → audit log + worker reconcile; repeatables trong queue `payments` (stale scan, DLQ scan, alert cron).
- **Fraud Radar**: Admin `/admin/payments/fraud` xem `FraudAlert` (OPEN/ACKED/RESOLVED) + signals (dup txHash, submit velocity, large manual credit, webhook fail spike, NEEDS_REVIEW burst). Worker `payments:alert_cron` chạy scan idempotent.
- **Trust & Safety**: moderation escalation scan (auto mute/ban) chạy best-effort trong `payments:alert_cron`; weekly digest in-app + optional email (Resend, env-gated).
- **Player roadmap**: PeerTube vibe (hls.js ABR + stats + retry/failover + mirror switching) + R2 A/B caching plan nằm trong `TASK_TEMPLATE_CONTINUE.md`.
- **User QoL**: `/watch-later` (resume) + `/stars/topup` UI wired to existing payments pipeline.
- **Growth/ARPU**:
  - **Season Pass 30d** mua bằng Stars (site-wide premium gating) + coupon discount fields in `SeasonPassPurchase`.
  - **Referral Stars**: 1–20% (admin configurable) bonus on TOPUP and EARN flows with idempotency via `ReferralBonus`.
  - **Bundles** (Topup bonus stars) and **Coupons** (Topup bonus / Season Pass discount) — Admin: `/admin/payments/bundles`, `/admin/payments/coupons`.

### Source of truth (bắt buộc)
Xem `CHATKITFULL.txt` + `AI_REQUIREMENTS.md` + `CONTRACT_CHECKLIST.md` để tránh lệch contract.

## v4.13.1 — Creator Monetization: Fan Club + Premium video + Goals

### Highlights
 - Fan Club recurring billing chạy trong worker (`payments:membership_billing_scan`) → charge Stars + extend membership (idempotent).
 - Premium videos: `Video.access=PREMIUM` chỉ xem được khi có membership hoặc đã unlock bằng Stars; watch page có paywall join/unlock.
 - Creator Goals: progress bar theo Stars tháng (tổng từ `VideoMetricDaily.stars`).

## v4.12.0 — Growth Hacker Phase A (Studio Analytics + CTR)

### Highlights
 - CTR tracking (impressions/clicks) on key surfaces (Home/Feed/Search/Trending) via `POST /api/analytics/events` (queued).
 - Studio Analytics dashboard `/studio/analytics`: daily views/unique/watch time + CTR chart + top traffic sources table.
 - Per-video analytics page `/studio/videos/[id]/analytics` shows CTR alongside watch/retention (MVP).

### Notes
 - Best-effort metrics: impressions/clicks are client-side (directional), aggregated by worker into daily tables.


### Highlights
 - Stars ledger filters + CSV export: `/admin/stars/transactions` + `GET /api/admin/stars/export/ledger`.
 - Anti-fraud risk rules for Stars credit: Redis-backed caps/velocity; risky -> `NEEDS_REVIEW` + `RISK_REVIEW` event.
 - Moderation queue: report video/comment -> enqueue `moderation:review_report` (worker, optional Discord notify).
 - CDN smart purge queue: enqueue `cdn:purge_paths` on publish/hide/delete/update metadata (Cloudflare purge optional).
 - Search: `GET /api/search` uses MySQL FULLTEXT relevance when possible + Redis hot-query cache.

### Data model
 - No breaking schema changes; fixed bad indexes in `StarDeposit` and `VideoReport`.



## v4.11.0 (Trust, safety & infra)
 - **Stars ledger (Admin)**: filters theo user/type/date + export CSV (`/admin/stars/transactions`, `GET /api/admin/stars/export/ledger`).
 - **Ledger audit quick checks**: payments dashboard returns counters for double-credit/mismatch (`GET /api/admin/payments/dashboard`).
 - **Risk rules for Stars credit**: Redis counters enforce caps/velocity; risky credits are moved to `StarDeposit.status=NEEDS_REVIEW` and logged via `StarDepositEvent.type=RISK_REVIEW`.
 - **Content reporting pipeline**: report video (`POST /api/reports/video`) + report comment (`POST /api/comments/report`) now enqueue moderation review job (`moderation:review_report`).
 - **CDN smart purge**: video publish/hide/delete/update metadata enqueue `cdn:purge_paths` (Cloudflare purge optional via `CLOUDFLARE_ZONE_ID` + `CLOUDFLARE_API_TOKEN`).
 - **Search performance**: `GET /api/search` uses MySQL FULLTEXT relevance when possible + Redis hot-query cache.
**Current version:** v4.16.22

> **Mục tiêu:** 1 file duy nhất tóm tắt kiến trúc, ENV, pages, flows, tips update.
> 
> **Chat mới:** Upload zip source + gửi **PROJECT_CONTEXT.md** và **AI_REQUIREMENTS.md**. Nếu cần rebuild toàn bộ, gửi thêm `PROMPT_REBUILD_PROJECT.md`.

---

## 0) Quick context (copy/paste cho chat mới)

```text
Dự án VideoShare chạy Next.js (App Router) + Prisma/MySQL + Redis/BullMQ Worker + Cloudflare R2.
Web: port 3000. Worker: chạy riêng (npm run worker:dev / npm run worker).
Video upload lên R2 (multipart). Worker ffmpeg tạo thumbnail/preview và encode HLS adaptive (SINGLE_FILE/byterange), ladder theo admin checkbox.
Có similar videos nâng cao + Redis cache + fan-out invalidation.
Có **Sensitive videos** kiểu PeerTube: `Video.isSensitive` + viewer preference `User.sensitiveMode` (SHOW/BLUR/HIDE) + site default `SiteConfig.sensitiveDefaultMode`; watch page hiển thị warning gate (giữ SEO/indexing), OG image dùng `/api/og/video/[id]`.
Có **Password gate** cho video: `Video.accessPasswordHash/accessPasswordHint`. Nếu set password, watch page `/v/[id]` sẽ trả **HTTP 401 Unauthorized** (không 404) cho user chưa unlock; unlock qua `POST /api/videos/[id]/unlock` (set HttpOnly signed cookie scoped theo video).
Có **External sync**: bảng `ApiSource` + worker job `syncApiSource` để đồng bộ video/channel từ nguồn ngoài (PeerTube / custom PHP API). Hỗ trợ user tự cấu hình trong **Kênh của tôi → Đồng bộ hóa**: `/my-channel/sync` (tạo cấu hình, bật/tắt, đồng bộ ngay). ApiSource user-created dùng `ownerId/channelId/lastSync*`; worker hỗ trợ `existingMode=NEW_ONLY` và `fixedChannelId`. Video external dùng `externalId` + `embedUrl/masterM3u8Key` có thể là absolute URL; UI dùng `resolveMediaUrl()` để render đúng.
Có **My Channel Sync (PeerTube vibe)**: `/my-channel/sync` cho chủ kênh tạo cấu hình đồng bộ (PeerTube/API PHP), chọn kênh nội bộ, chọn chế độ (nhập tất cả vs chỉ video mới), bật/tắt và bấm “Đồng bộ”.
Ads có device/bot targeting (mặc định chỉ mobile+tablet, ẩn bots): `AdPlacement.showOnMobile/showOnTablet/showOnDesktop/hideForBots`; có banner toàn trang: `GLOBAL_TOP` + `GLOBAL_BOTTOM`.
Có **External API sync**: bảng `ApiSource` + worker job sync (mappingJson) để đồng bộ video/channel từ nguồn ngoài (ví dụ PeerTube3, Zone3s posts API). Video đã DELETED sẽ không bị resurrect khi sync.
Có Premium membership (Premium/Premium+): badge Verified, Premium+ unlock video access `PREMIUM_PLUS`, member ẩn ads HTML (chỉ còn Boost ads), Premium+ có tuỳ chọn ẩn cả Boost ads.
Có Community posts (kiểu YouTube Community): `/u/[id]/community`, `/subscriptions` + Polls (options order theo `CommunityPollOption.sort`) + soft-delete `CommunityPost.isDeleted`.
Có NFT INTERNAL (không on-chain): Premium+ có thể mint NFT từ video (trừ stars fee), dùng NFT làm avatar (`User.avatarNftItemId`) và trưng bày trên kênh.
Có NFT marketplace nội bộ: fixed-price listings + auctions (bid escrow StarHold) trong `/nft/market` + `/nft/items/[id]`.
Có nền tảng export NFT on-chain (foundation): tạo `NftExportRequest` freeze marketplace, worker upload metadata to nft.storage → status READY, user submit txHash, worker verify on-chain → EXPORTED. Admin có `/admin/nft/contracts` (pending+delay 24h, validate theo chain, SYSTEM notifications cho admin, log from/to) + `/admin/nft/events`. Default SOLANA contract/program address seed: `EYXjrNBgpacCXo5a6smeGnUijFf5eiFHew5torEta216`.
Có hệ thống Stars/Payments: /stars/topup (Wallet/Web3 Apps/Manual), webhook ingest (Helius/Alchemy/QuickNode), audit log + rate-limit + dedupe, auto reconcile cron 2 phút, stale SUBMITTED > 10 phút tự reconcile.
Admin payments dashboard có charts (fail-rate multi-line theo chain, volume, total deposits), filters theo thời gian/chain/asset/provider, export CSV (deposits/events/webhooks), unmatched inbox, manual assign/credit/refund.
Admin payments dashboard có thêm tabs: Stars credited, Token totals theo symbol (cùng cụm Deposits analytics).
v4.4.0: nền tảng Notifications ở mức schema (Prisma `NotificationType` + `Notification`) và refresh docs “xương sống” để chat mới AI không bị lệch.
Có Search & Discovery MVP: /search, /explore, /tag/[slug], /category/[slug] + API search suggestions.
Có Offline Mode (PWA) MVP: service worker + /offline + offline upload queue (IndexedDB).
Có Creator tips (stars) + creator revenue dashboard /studio/revenue.
Có Gamification: XP/Level + badges + daily tasks + leaderboard (/leaderboard).
Có Video chapters: studio editor + chapters hiển thị dưới player (click để seek).
Có Public API + RSS: /api/public/* + /rss.xml + /u/[id]/rss.xml; creator webhooks outbox + studio manager /studio/webhooks; worker delivery queue.
Có Studio editor/record MVP: /studio/editor (trim enqueue worker) + /studio/record (screen recording + upload).
Có **Playlists (MVP)**: `/playlists`, `/p/[id]`, API `/api/playlists*`.
Có **Continue Watching / History**: `VideoProgress` sync đa thiết bị; player auto-resume bằng `GET /api/progress?videoId=...` hoặc `?t=`; page `/history`.
Có **Comment pin/heart**: chủ video/admin có thể ghim 1 comment (pin) và thả tim; sort pinned → hearted → SuperThanks → newest.
Yêu cầu: update code phải build được, giữ security (role guard + webhook signature verify + strict allowlist per chain).
```

---

## 1) Kiến trúc tổng quan

---

## 0.1) Version timeline (high level)
- **v4.2.0**: Payments/Stars topup + webhooks ingest + admin payments pages + worker payments queue.
- **v4.2.3**: Sensitive videos (PeerTube-like) + ads targeting device/bot + global banners.
- **v4.3.0**: Fix/align SiteConfig fields, Premium+ free boost quota tracking, comments highlight, NFT mint fee + metadata lock.
- **v4.3.6–v4.3.8**: Password gate (401) + external sync foundation (ApiSource + worker) + My Channel Sync UI `/my-channel/sync`.
- **v4.4.0**: Docs “xương sống” refresh + thêm Prisma groundwork cho Notifications.
- **v4.5.0**: NFT marketplace nội bộ (fixed-price listings) + fee/royalty split + hold first UNVERIFIED sale.
- **v4.6.0**: Auctions MVP + export on-chain foundation (metadata worker + tx verify) + admin contract rotation/events.
- **v4.6.1**: Export on-chain (EVM) — optional media upload to IPFS + mirror ownerOf display; remove accidental ethers import.
- **v4.6.2**: Export on-chain verify beta for SOLANA/TRON (Solana requires mintAddress) + enable chain selector UI.
- **v4.8.0**: Roadmap Tasks 9–15: Search/Discovery, Offline PWA, Creator tips+revenue, Gamification, Chapters, Public API+RSS+Creator webhooks, Studio editor+screen record.

```
Browser
  │
  ▼
Next.js Web (app router)
  ├─ Prisma Client ─────► MySQL
  ├─ ioredis ───────────► Redis
  ├─ S3 SDK ────────────► Cloudflare R2 (origin)
  └─ (enqueue jobs) ────► BullMQ

Worker (BullMQ processors)
  ├─ ffmpeg/ffprobe (video processing)
  ├─ payments reconcile / webhook processing
  └─ writes DB + uploads R2

CDN (Cloudflare)
  └─ Cache static assets/HLS to reduce R2 Class A/B
```

**Ports (dev/prod):**
- Web: `3000`
- Worker: chạy process riêng (không phải HTTP server; chỉ consume queues)

---

## 2) Cấu trúc thư mục

```
/app
  /admin
  /api
  /stars
  /v
/components
  /ui                 # shadcn-like components
  /admin
  /stars
/lib
  auth, prisma, r2, redis
  /videos             # similar + search helpers
  /payments           # webhook ingest, explorer links, csv
/prisma
  schema.prisma, seed.ts
/worker
  /src/jobs           # payments + ffmpeg jobs
  index.ts            # registers workers + repeatable jobs
/docs
  (rendered in /admin/docs)
```

---

## 3) Pages chính

### User
- `/` feed
- `/search` (nếu có) hoặc search trong header
- `/v/[id]` watch page + Similar videos
- `/upload`
- `/history`
- `/watch-later`
- `/stars/topup` (Wallet / Web3 Apps / Manual)

### Admin
- `/admin/videos` + `/admin/videos/[id]`
- `/admin/config`
- `/admin/reports`
- `/admin/docs` (docs site)
- `/admin/payments` dashboard
- `/admin/payments/deposits` + `/admin/payments/deposits/[id]`
- `/admin/payments/unmatched`
- `/admin/payments/events`
- `/admin/payments/webhooks`
- `/admin/payments/config`

---

## 4) API routes quan trọng (ràng buộc contract)

### Similar videos
- `lib/videos/similar.ts` + `lib/videos/similarCache.ts`

### Stars topup
- `POST /api/stars/topup/intent`
- `POST /api/stars/topup/submit-tx`
- `GET  /api/stars/topup/history`
- `POST /api/stars/topup/retry`

### Webhooks (native payload)
- `POST /api/webhooks/helius`
- `POST /api/webhooks/alchemy`
- `POST /api/webhooks/quicknode`
- `POST /api/webhooks/trongrid` (tuỳ chọn)

### Admin payments
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

---

## 5) Worker queues & jobs

### Queue: video
- `processVideo`
- `encodeHls`

### Queue: payments
- `process_webhook_audit`
- `reconcile_deposit`
- `reconcile_stale_scan` (repeatable)
- `retry_dead_letters_scan` (repeatable)
- `alert_cron` (repeatable)

**Cron / repeatable defaults**
- reconcile scan: mỗi **2 phút** (`PAYMENTS_RECONCILE_EVERY_MS=120000`)
- stale threshold: **10 phút** (`PAYMENTS_SUBMITTED_STALE_MINUTES=10`)
- tolerance: **0.5%** (`PAYMENTS_TOLERANCE_BPS=50`)

---

## 6) Redis keys (để debug nhanh)

### Similar cache
- `videoshare:similar:v1:{videoId}`
- reverse index:
  - `videoshare:similar:index:v1:child:{childId}` (SET parentIds)
  - (optional) `videoshare:similar:index:v1:parent:{parentId}` (JSON list)

### Rate-limit locks (webhooks)
- `videoshare:ratelimit:{bucketKey}`

---

## 7) R2 storage layout (tối ưu cache/CDN)

**Nguyên tắc:** keys nên “versioned/immutable” để CDN cache **1 năm**.

Ví dụ:
- Original: `videos/{videoId}/source/{uploadId}.mp4`
- Thumb: `videos/{videoId}/thumb/{buildId}.jpg`
- Preview: `videos/{videoId}/preview/{buildId}.mp4`
- HLS (byterange single file):
  - `videos/{videoId}/hls/{encodeId}/master.m3u8`
  - `videos/{videoId}/hls/{encodeId}/v0.mp4`
  - `videos/{videoId}/hls/{encodeId}/v0.m3u8`

**Cache-Control gợi ý** (nếu upload set header):
- mp4 byterange, thumb, preview: `public, max-age=31536000, immutable`
- playlist m3u8: `public, max-age=3600`

---

## 8) Payments states (để hiểu flow)

Trạng thái điển hình của `StarDeposit`:
- `CREATED` → user thấy address/amount
- `SUBMITTED` → user submit txHash/signature
- `OBSERVED` → webhook thấy tx
- `CONFIRMED` → reconcile on-chain ok
- `CREDITED` → đã cộng stars (idempotent)
- `UNMATCHED` → chưa biết user (thiếu memo/txhash/...) → vào inbox admin
- `FAILED|MISMATCH` → fail với `failureReason`

**Auto-match ưu tiên (Solana):** memo `depositId`.

---

## 9) Strict provider per chain (rule gốc)

- EVM: chỉ accept `Alchemy` / `QuickNode` (tuỳ config allowlist)
- SOL: chỉ accept `Helius` / `QuickNode`
- Nếu `providerAccuracyMode=true`: signature fail → reject, lưu audit log.

---

## 10) Lệnh chạy nhanh

```bash
# db
npm run db:up
npm run prisma:generate
npm run prisma:push
npm run prisma:seed

# dev
npm run dev
npm run worker:dev

# tests/build
npm test
npm run build
```

---

## 11) Tips update để “không vỡ”

- Nếu thêm env mới: cập nhật **`.env.example` + `docs/ENV.md`** và nhắc rõ default.
- Khi thay đổi flow lớn: cập nhật **PROJECT_CONTEXT.md** (pages/jobs/keys/status).
- Luôn cập nhật `CHANGELOG.md` theo version.
- Tránh lỗi Next server/client:
  - Server component không dùng `onClick/onSubmit`; dùng route handler + form POST hoặc tách client component.
- Payments luôn cần idempotent:
  - unique txHash/signature
  - credit chỉ thực hiện 1 lần.

---

## 12) Điểm nối (integration points) + lỗi hay gặp

### 12.1 Khi cần “kết nối code khác” (import module, microservice, repo phụ)
- Ưu tiên tạo module mới trong `lib/` (pure functions) rồi gọi từ `app/api/*` hoặc server components.
- Nếu cần background/reconcile/ffmpeg: tạo job trong `worker/src/jobs/*`, enqueue từ web qua `lib/queues.ts`.
- Không nhồi logic vào client components (tránh leak secret + khó test).

### 12.2 Lỗi hay gặp khi AI sửa code
- **Server component dùng onClick/onSubmit** ⇒ tách client component hoặc dùng form POST + route handler.
- Prisma schema thay đổi nhưng quên update seed/queries ⇒ chạy `npm run prisma:push` + `npm run prisma:seed`.
- Webhooks parse nhầm shape ⇒ lưu raw payload trong `WebhookAuditLog` để debug và viết parser tolerant.
- Credit bị double ⇒ bắt buộc unique constraint (txHash/signature) + transaction idempotent.

### 12.3 Khi cần “tạo lại code từ đầu” (rebuild)
- Dùng file `PROMPT_REBUILD_PROJECT.md` để AI dựng lại toàn bộ. Sau rebuild phải cross-check với:
  - **AI_REQUIREMENTS.md** (checklist)
  - **PROJECT_CONTEXT.md** (flows + endpoints + jobs)
  - `docs/HISTORY_v1.0.0_to_v3.9.0.md` (legacy features)

## v4.10.0 additions
- Search trending stored in Redis (best-effort) and exposed via /api/search/trending
- User notification settings stored in NotificationSetting (disable per NotificationType)
- Comment reports stored in CommentReport + admin page /admin/reports/comments
- Creator Fan Club membership plans stored in CreatorMembershipPlan + join API

## v4.16.x notes (Storage + HLS + Player)
- Storage redundancy: R2 primary + FTP Origin (mp4) + FTP HLS (fallback) + Google Drive origin; quản lý qua `/admin/storage` (pending apply 24h + audit + notify).
- HLS packaging: `/admin/hls` có 3 mode: TS / fMP4 / Hybrid.
- Player roadmap PeerTube vibe + R2 A/B: xem `TASK_TEMPLATE_CONTINUE.md`.
