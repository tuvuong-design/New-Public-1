# ARCHITECTURE.md — v4.13.0

## v4.13.0 — Creator Monetization: Fan Club + Premium video + Goals
- Fan Club recurring billing runs in worker: repeatable `payments:membership_billing_scan` charges Stars and extends memberships.
- Premium videos (Early Access): `Video.access=PREMIUM` requires active Fan Club membership or one-time Stars unlock; enforced by `canViewVideoDb`.
- Creator goals: `CreatorGoal` progress uses `VideoMetricDaily.stars` (monthly).

## v4.12.0 — Growth Hacker Phase A
- CTR tracking: `POST /api/analytics/events` (CARD_IMPRESSION/CARD_CLICK) → queue `analytics`.
- Studio Analytics: `/studio/analytics`, per-video: `/studio/videos/[id]/analytics`.

## 1) Tổng quan
- Web: Next.js App Router trong `app/`
- DB: Prisma + MySQL (`prisma/schema.prisma`)
- Auth: NextAuth + roles `ADMIN`/`USER`
- Background jobs: Redis + BullMQ; tác vụ nặng chạy trong `worker/` (không chạy trong web request)
- Storage: Cloudflare R2 (S3 compatible) + CDN cache; keys versioned/immutable để giảm Class A/B
- Images: `next/image` (wrapper `SmartImage`) + `images.remotePatterns` from `R2_PUBLIC_BASE_URL`.

## 2) Luồng xử lý video (high-level)
1) Upload (web) → multipart upload lên R2 (`/upload` hỗ trợ batch upload)
2) Tạo record `Video` (status = `PROCESSING`)
3) Queue processing → đẩy job vào Redis (BullMQ)
4) Worker chạy:
   - `processVideo`: ffprobe metadata, generate thumb/preview
   - `encodeHls`: encode HLS ABR
5) Publish (status = `PUBLISHED`)
6) Client playback (HLS)

## 3) HLS packaging
Mặc định hướng tới giảm số object:
- Option: `SINGLE_FILE` (byterange) tạo file mp4 lớn + playlist m3u8
- CDN cache Range requests để giảm origin GET/HEAD về R2

## 4) Payments pipeline (queue: payments)
- Webhooks ingest (native payload):
  - `POST /api/webhooks/helius`
  - `POST /api/webhooks/alchemy`
  - `POST /api/webhooks/quicknode`
- Admin payments: `/admin/payments/*` và `app/api/admin/payments/*`
- Worker queue `payments` handlers: `worker/src/jobs/payments/*`
  - `process_webhook_audit`
  - `reconcile_deposit`
  - `reconcile_stale_scan` (repeatable)
  - `retry_dead_letters_scan` (repeatable)
  - `alert_cron` (repeatable)

## 4b) NFT marketplace + export (queue: nft)
### Internal marketplace
- Listings + auctions chạy trong web request (Stars ledger/holds...) nhưng **không** làm việc nặng.
- Bid escrow dùng `StarHold` để tránh double-spend.

### Export on-chain (foundation)
Nguyên tắc: **freeze marketplace nội bộ ngay khi export pending**.
1) Web: `POST /api/nft/export/request` tạo `NftExportRequest` (status `PENDING`), set `NftItem.exportStatus=PENDING` + `marketplaceFrozen=true`.
2) Worker `nft_export_prepare`: upload metadata JSON lên nft.storage → set `tokenUri` + status `READY`.
3) User mint ngoài hệ thống (wallet/tool) rồi submit `txHash` (`POST /api/nft/export/submit-tx`).
4) Worker `nft_export_verify_tx`: verify receipt/events → status `EXPORTED`.

### Admin contract rotation (delay)
- `/admin/nft/contracts`: set pending contract per chain + delay apply (default 24h) + audit `NftEventLog`.
- `/admin/nft/events`: view audit trail.

## 5) Caching & rate-limit
- Similar cache Redis keys:
  - `videoshare:similar:v1:{videoId}`
  - `videoshare:similar:index:v1:child:{childId}`
- Rate-limit Redis key:
  - `videoshare:ratelimit:{bucketKey}`

## 6) Storage layout (R2)
Mục tiêu: keys bất biến cho assets public để CDN cache hit, tránh purge khi re-encode.
- `uploads/{YYYY}/{MM}/{userId}/...` (source upload)
- `videos/{videoId}/thumb/{buildId}.jpg`
- `videos/{videoId}/preview/{buildId}.mp4`
- `videos/{videoId}/hls/{encodeId}/master.m3u8`
- `videos/{videoId}/hls/{encodeId}/*.mp4` (SINGLE_FILE) hoặc `seg_*.m4s|ts` (segmented)


## 6.1) Storage redundancy (FTP/Drive)
R2 remains the primary origin. Optionally, the platform can:
- Mirror HLS playlists/segments to **FTP HLS** (public base URL) as hot backup
- Backup original MP4 to **FTP Origin** and/or **Google Drive** (service account) as deep backup
- Worker repeatable `storage:health_scan` can auto-trigger `rebuild_hls_from_drive` if R2 HLS is missing and Drive backup exists

Admin config + 24h delayed apply: `/admin/storage` (all changes are logged + SYSTEM-notified).
## 7) Các gate quan trọng
- Sensitive videos (PeerTube-like): `lib/sensitive.ts` + `components/sensitive/*`
- Password gate (401): `lib/videoPassword.ts` + `app/v/[id]/unauthorized.tsx`

## 8) v4.8.x additions (Task 9–15) — kiến trúc
- Search & Discovery: server-rendered pages + API routes (`app/search`, `app/api/search/*`).
- Offline Mode (PWA): `public/sw.js` + client register `components/pwa/PwaRegister.tsx` + `/offline` fallback + offline upload queue (IndexedDB) trong `lib/pwa/offlineUploadQueue.ts`.
- Creator monetization: tips dùng Stars ledger, tạo outbox `CreatorWebhookDelivery` và worker queue `creatorWebhooks` để deliver async.
- Gamification: XP idempotent bằng `XpEvent(userId, sourceKey)`, badges + daily tasks, leaderboard endpoint.
- Chapters: studio editor replace-list transactional + public chapters API; UI dưới player bắn seek event.
- Public API + RSS: read-only, CORS + rate-limit; RSS routes trả XML.
- Editor/Record: trim request enqueue `editor` queue → worker ffmpeg; screen recording dùng `MediaRecorder` + upload pipeline hiện có.

## v4.10.0 — Retention & Community

### Data model additions
- `Playlist` (ownerId, title, description?, visibility).
- `PlaylistItem` (playlistId, videoId, sort).
- `Comment` thêm pin/heart metadata (isPinned/isHearted + by/at).

### Request flows
- Continue Watching: `POST /api/progress` lưu progress → `GET /api/progress?videoId=...` để player resume (cross-device).
- Playlists: user CRUD playlists + add/remove video items; playlist public page `/p/[id]`.


## Storage redundancy (R2 primary + 2 FTP + Google Drive)
- R2 primary (CDN/custom domain; keys immutable)
- FTP HLS mirror (fallback playback)
- FTP Origin (backup MP4 gốc)
- Google Drive origin (service account) để rebuild HLS khi cần
- Admin `/admin/storage`: pending apply 24h + audit + notify
- Worker queue `storage`: apply_pending_config, health_scan, backup_origin, mirror_hls, rebuild_hls_from_drive

## HLS packaging (TS / fMP4 / Hybrid)
- Config trong `/admin/hls`:
  1) TS segments (.ts)
  2) fMP4 (init.mp4 + .m4s)
  3) Hybrid: TS ladder 1080/720/480 + fMP4 source playlist
- Worker encode: `worker/src/jobs/encodeHls.ts`
