# ARCHITECTURE.md — v4.16.22

Tài liệu này mô tả kiến trúc tổng thể VideoShare, các “luồng xương sống” và các invariants không được phá.

## 1) High-level components
- **Web (Next.js App Router)**: `app/`
- **DB (MySQL/Prisma)**: `prisma/schema.prisma`
- **Auth (NextAuth)**: session + role `ADMIN/USER`
- **Worker (BullMQ)**: `worker/` — chạy jobs nặng + repeatables
- **Cache/Queues (Redis)**: BullMQ + cache keys (similar, rate-limit, realtime, …)
- **Storage (Cloudflare R2 + CDN)**: object keys immutable/versioned

## 2) Repo layout (định vị nhanh)
- `app/` — pages/routes, route handlers `app/api/*`
- `components/` — UI, player, admin components
- `lib/` — domain logic (payments, video access, storage, caching, authz)
- `worker/` — jobs, queue registration, ffmpeg pipeline, background scans
- `prisma/` — schema + seed
- `docs/` — docs mirror (root sync)

## 3) Invariants (không thương lượng)
### 3.1 Heavy work chạy worker
- ffmpeg, encode HLS, rebuild/mirror storage, reconcile scans, batch exports → **worker**
- web request chỉ validate/persist/enqueue

### 3.2 Server/Client boundary
- Server Component không dùng handler DOM/hook browser
- Interactive UI tách `"use client"`

### 3.3 Storage keys immutable
- Không overwrite HLS public assets
- Đổi `encodeId/buildId` để tạo bộ assets mới; CDN cache ổn định

### 3.4 Idempotency (webhooks + credits)
- webhook retry / job retry là bình thường
- credit/refund/reconcile phải có unique keys + transaction

### 3.5 Admin security
- Admin pages + admin APIs phải guard `role=ADMIN`
- Config nhạy cảm dùng **pending apply 24h + audit + notify**

## 4) Core flow: Upload → Process → Encode → Publish
1) Web upload multipart lên R2 (`app/api/upload/*`)
2) Tạo `Video` status `PROCESSING`
3) Enqueue processing (`lib/queues.ts` + `app/api/videos/queue-process/route.ts`)
4) Worker:
   - `worker/src/jobs/processVideo.ts`: ffprobe, thumb/preview, metadata
   - `worker/src/jobs/encodeHls.ts`: encode HLS theo mode (TS/fMP4/Hybrid)
5) Update `Video` (master playlists keys) → status `PUBLISHED`
6) Playback tại `/v/[id]`

## 5) HLS packaging (Admin `/admin/hls`)
Ba mode:
1) **TS segments (.ts)**
2) **fMP4**: `init.mp4` + `.m4s`
3) **Hybrid**: TS ladder 1080/720/480 + thêm fMP4 “source”
- Worker implementation: `worker/src/jobs/encodeHls.ts`
- Object keys nằm dưới `videos/{videoId}/hls/{encodeId}/...` (immutable)

## 6) Playback resolution + fallback
- Watch page lấy master playlist URL từ `Video.masterM3u8Key` (+ base URL)
- Khi bật storage redundancy:
  - Worker `storage:health_scan` cập nhật health
  - Playback có thể fallback sang FTP HLS public base URL (nếu cấu hình)

### 6.1 PeerTube-ish player UX (Phase 1–2 implemented)
- Client player: `components/player/VideoPlayer.tsx` (hls.js)
- Features:
  - ABR Auto + quality manual selector (persisted)
  - Stats overlay
  - Retry/backoff + origin failover (R2 A/B ↔ FTP HLS)
  - Playlist URL rewrite to absolute (stability across mirrors)
  - Optional prefetch next segments (light)
  - Theater mode + mini-player + PiP + hotkeys (J/K/L, arrows, F, M)

### 6.2 P2P (experimental)
- Admin flag: `SiteConfig.playerP2PEnabled` (OFF by default) tại `/admin/config`
- Ghi chú: P2P loader integration yêu cầu dependency `p2p-media-loader-hlsjs`; nếu chưa cài thì player fallback HTTP bình thường.
## 7) Storage redundancy (R2 + FTP + Google Drive)
### 7.1 Mục tiêu
- R2 là primary origin
- Có đường “hot backup” (FTP HLS) để fallback playback
- Có “deep backup” (FTP Origin/Drive) để rebuild HLS khi mất assets

### 7.2 Admin + delayed apply
- Admin UI: `/admin/storage` + `/admin/storage/events`
- Mọi thay đổi config:
  - tạo bản **pending**
  - **apply sau 24h**
  - audit log + notify admins

### 7.3 Worker queue `storage`
- Repeatables: `apply_pending_config`, `health_scan`
- Jobs: `backup_origin`, `mirror_hls`, `rebuild_hls_from_drive`
- Files: `worker/src/jobs/storage/*`

## 8) Payments pipeline (queue: `payments`)
### 8.1 Ingest
- `POST /api/webhooks/helius|alchemy|quicknode` (optional `trongrid`)
- ghi `WebhookAuditLog` + enqueue processing

### 8.2 Reconcile & scans (worker)
- `worker/src/jobs/payments/processWebhookAudit.ts`
- `worker/src/jobs/payments/reconcileDeposit.ts`
- repeatable scans:
  - `reconcileStaleScan.ts`
  - `retryDeadLettersScan.ts`
  - `alertCron.ts`

### 8.3 Alert cron + Trust/Safety hook
- `payments:alert_cron` (repeatable) gửi Discord alert khi fail-rate spike
- Đồng thời trigger best-effort:
  - `worker/src/jobs/moderation/escalationScan.ts`
  - `worker/src/jobs/payments/fraudRadarScan.ts` (tạo `FraudAlert` idempotent cho Fraud Radar admin)

## 9) Moderation & Reports
- Report video/comment → tạo report + enqueue moderation review
- Admin review pages: `/admin/reports`, `/admin/moderation/*` (xem `docs/ADMIN_UI.md`)
- Escalation scan (auto mute/ban) chạy từ `payments:alert_cron`

## 10) Notifications digest
- Worker `worker/src/jobs/notifications/weeklyDigest.ts`
- In-app digest: type `WEEKLY_DIGEST`
- Optional email via Resend (env-gated)

## 11) Caching & rate-limit (Redis)
- Similar:
  - `videoshare:similar:v1:{videoId}`
  - `videoshare:similar:index:v1:child:{childId}`
- Rate-limit:
  - `videoshare:ratelimit:{bucketKey}`



## Notifications digests

- `weekly_digest` (repeatable): in-app weekly summary.
- `continue_watching_digest` (repeatable): daily in-app reminder for unfinished videos (opt-out via Notification settings).
## Stars ledger invariants (Season Pass + Referral)
- Mọi thay đổi Stars phải đi qua:
  - `User.starBalance` (counter) **và**
  - `StarTransaction` (append-only ledger)
- Idempotency:
  - Season Pass purchase: `SeasonPassPurchase.txId` unique (hỗ trợ retry).
  - Referral bonus: `ReferralBonus` unique `(sourceKind, sourceId)` để chống double-credit.
- Premium gating:
  - `SeasonPass` active (endsAt > now) được xem/interact premium (site-wide), vẫn tôn trọng block/banned/owner rules ở `canViewVideo`.
