# FEATURE_MAP.md — v4.12.0

## v4.12.0 — Growth Hacker Phase A
- CTR tracking: `POST /api/analytics/events` (CARD_IMPRESSION/CARD_CLICK) → queue `analytics`.
- Studio Analytics: `/studio/analytics`, per-video: `/studio/videos/[id]/analytics`.

Map nhanh: tính năng ↔ file/folder chính. Mục tiêu là để AI/chat mới định vị code nhanh.

## Upload & xử lý video
- Multipart upload init/sign/complete:
  - `app/api/upload/init/route.ts`
  - `app/api/upload/sign-part/route.ts`
  - `app/api/upload/complete/route.ts`
- Queue xử lý video:
  - `app/api/videos/queue-process/route.ts`
  - `lib/queues.ts`
- Worker:
  - `worker/src/jobs/processVideo.ts`
  - `worker/src/jobs/encodeHls.ts`
  - `worker/src/utils/exec.ts`, `worker/src/utils/r2io.ts`

## Playback
- Player component: `components/player/VideoPlayer.tsx`
- Video page: `app/v/[id]/page.tsx`

## Analytics & Insights (MVP)
- Ingest API: `app/api/analytics/events/route.ts` → queue `analytics`
- Realtime viewers: `app/api/analytics/realtime/route.ts` + Redis ZSET key `videoshare:realtime:viewers:v1:{videoId}`
- Worker job: `worker/src/jobs/analytics/ingestEvents.ts` + worker `analytics` in `worker/src/index.ts`
- Studio:
  - `/studio/analytics`: `app/studio/analytics/page.tsx`
  - `/studio/videos/[id]/analytics`: `app/studio/videos/[id]/analytics/page.tsx`
- A/B testing (title/thumb) MVP:
  - Assignment: `lib/experiments/assign.ts`
  - Create/end: `app/api/studio/experiments/*`

## Performance (MVP)
- Image optimization:
  - Wrapper: `components/media/SmartImage.tsx`
  - Next config remote patterns: `next.config.mjs` (reads `R2_PUBLIC_BASE_URL` at build time)
- Video preload:
  - Player: `components/player/VideoPlayer.tsx` (`preload="metadata"` default)

## Creator Tools (MVP)
- Batch upload:
  - Page: `app/upload/page.tsx` (multiple file select; sequential multipart upload)
- SEO Analyzer:
  - Page: `/studio/videos/[id]/seo` → `app/studio/videos/[id]/seo/page.tsx`
- Tags suggestion (heuristic):
  - API: `app/api/studio/videos/[id]/tags/suggest/route.ts`
  - Logic: `lib/seo/tagsSuggest.ts`

## Video password gate (401)
- Password hashing + signed cookie: `lib/videoPassword.ts`
- Watch gate: `app/v/[id]/page.tsx` + `app/v/[id]/unauthorized.tsx`
- Unlock API: `app/api/videos/[id]/unlock/route.ts`
- Set/Clear password (admin/owner): `app/api/videos/[id]/password/route.ts`

## Sensitive videos (PeerTube-like)
- Viewer mode resolver: `lib/sensitive.ts`
- Thumb blur/label: `components/sensitive/SensitiveThumb.tsx`
- Watch overlay gate: `components/sensitive/SensitiveVideoGate.tsx`
- User preference API: `app/api/user/preferences/sensitive/route.ts`
- Site default: `app/api/admin/site-config/route.ts` (fields `sensitiveDefaultMode`)
- OG blur image: `app/api/og/video/[id]/route.ts`

## Ads targeting (device/bot) + global banners
- UA/device detection: `lib/userAgent.ts`
- Ads API: `app/api/ads/route.ts`
- Admin ads config: `app/api/admin/ad-placement/route.ts` + UI `app/admin/ads/page.tsx`
- Global top/bottom banners: `components/ads/GlobalBannerAds.tsx` (wired từ `app/layout.tsx`)

## Super Thanks (comments)


## Retention & Community (v4.10.0)
- Playlists v2 (collab + series):
  - Pages: `app/playlists/page.tsx`, `app/p/[id]/page.tsx`, `app/series/*`
  - API: `app/api/playlists/*` (items, reorder, cover, collaborators)
  - UI: `app/v/[id]/ui/AddToPlaylistButton.tsx`, `app/p/[id]/ui/*`, `app/playlists/ui/*`
- Continue Watching + History:
  - Progress read: `app/api/progress/route.ts` (GET)
  - History page: `app/history/page.tsx`
  - Player resume: `components/player/VideoPlayer.tsx`
- Comment pin/heart:
  - API: `app/api/comments/moderate/route.ts`
  - UI: `app/v/[id]/ui/Comments.tsx`
- Comments API: `app/api/comments/route.ts` (fields `isSuperThanks`, `superThanksStars`, `senderAnonymous`, `isTopSupporter`)
- Watch comments UI: `app/v/[id]/ui/Comments.tsx`
- Styles: `app/globals.css`

## Similar videos (advanced)
- Logic: `lib/videos/similar.ts`
- Redis cache + invalidation: `lib/videos/similarCache.ts`
- UI block: `app/v/[id]/page.tsx`

## Payments / Stars topup
- User pages:
  - `/stars/topup` → `app/stars/topup/page.tsx`
  - history pages: `app/history/*` nếu có
- Core payment logic: `lib/payments/*`
- Webhooks:
  - `app/api/webhooks/helius/route.ts`
  - `app/api/webhooks/alchemy/route.ts`
  - `app/api/webhooks/quicknode/route.ts`
- Admin payments:
  - UI: `app/admin/payments/*`
  - API: `app/api/admin/payments/*`
- Worker queue: `worker/src/jobs/payments/*` (queue name `payments`)

## External sync foundation (PeerTube / Zone3s)
- User UI: `app/my-channel/sync/page.tsx`
- User APIs: `app/api/me/sync-sources/*`
- Worker sync: `worker/src/jobs/syncApiSource.ts`
- Media URL resolver (R2 key vs absolute URL): `lib/mediaUrl.ts`

## Notifications / Mentions / Nested comments (v4.4.0)
- Prisma:
  - `NotificationType` + `Notification` model
  - `User.username` (unique)
  - `Comment.parentId/rootId/depth`
- UI/API (v4.15.0):
  - Inbox: `/notifications`
  - Settings: `/settings/notifications` (disable per type)
  - APIs: `GET /api/me/notifications`, `POST /api/me/notifications/read`, `GET/POST /api/me/notifications/settings`
  - Worker: repeatable `weekly_digest` tạo in-app digest (type `WEEKLY_DIGEST`)

## Reports & Moderation (v4.15.0)
- Report video/comment:
  - `POST /api/reports/video`, `POST /api/reports/comment`
  - Admin review: `/admin/reports`, `/admin/reports/comments`
- Admin moderation actions + audit:
  - `POST /api/admin/moderation/actions`
  - Dashboard: `/admin/moderation` + `.../actions`, `.../keywords`
- Keyword filter per creator: `CreatorModerationSetting` (auto-hide comment on create)

## NFT (internal) + Marketplace (Task 4/5)
- NFT home + market:
  - `/nft` → `app/nft/page.tsx`
  - `/nft/market` → `app/nft/market/page.tsx`
  - `/nft/items/[id]` → `app/nft/items/[id]/page.tsx`
  - Mint: `/nft/mint` → `app/nft/mint/page.tsx`
- APIs:
  - Mint: `POST /api/nft/mint` → `app/api/nft/mint/route.ts`
  - Avatar set/clear: `POST /api/nft/avatar` → `app/api/nft/avatar/route.ts`
  - Listings (fixed-price):
    - `POST /api/nft/listings/create` → `app/api/nft/listings/create/route.ts`
    - `POST /api/nft/listings/[id]/cancel` → `app/api/nft/listings/[id]/cancel/route.ts`
    - `POST /api/nft/listings/[id]/buy` → `app/api/nft/listings/[id]/buy/route.ts`

  - Auctions (bid escrow bằng StarHold):
    - `POST /api/nft/auctions/create` → `app/api/nft/auctions/create/route.ts`
    - `POST /api/nft/auctions/[id]/bid` → `app/api/nft/auctions/[id]/bid/route.ts`
    - `POST /api/nft/auctions/[id]/cancel` → `app/api/nft/auctions/[id]/cancel/route.ts`
    - `POST /api/nft/auctions/[id]/settle` → `app/api/nft/auctions/[id]/settle/route.ts`
- Fee/royalty/hold helpers:
  - Fee breakdown: `lib/nft/fees.ts`
  - StarHold auto-release: `lib/stars/holds.ts`
- Prisma models (foundation): `NftCollection`, `NftItem`, `NftListing`, `NftSale`, `StarHold`, ...

## NFT export on-chain (Task 6 foundation)
- User:
  - Export tracking page: `/nft/exports` → `app/nft/exports/page.tsx`
  - Request export: `POST /api/nft/export/request` → `app/api/nft/export/request/route.ts`
  - Submit txHash: `POST /api/nft/export/submit-tx` → `app/api/nft/export/submit-tx/route.ts`
- Deterministic tokenId helper: `lib/nft/tokenId.ts`
- Enqueue helper: `lib/nft/exportQueue.ts` (queue name `nft`)
- Worker jobs:
  - `worker/src/jobs/nft/exportPrepare.ts` (nft.storage upload metadata)
  - `worker/src/jobs/nft/exportVerify.ts` (EVM receipt Transfer verify)
- Admin:
  - `/admin/nft/contracts` + API `/api/admin/nft/contracts` (pending+delay apply)
  - `/admin/nft/events` (audit trail)



## NFT gated (Proof-of-Fandom) + Premium unlock + Clip as NFT (v4.16.x)
- Wallet link: `/settings/wallets` + APIs `POST /api/wallets/challenge` + `POST /api/wallets/link` (signature verify) + `POST /api/wallets/unlink`.
- Membership gate: `NftGateRule` + Studio `/studio/membership` tab **NFT Gate**.
- Premium video unlock: `VideoNftGate` + Studio Video Access `/studio/videos/[id]/access` + watch paywall CTA "Unlock with NFT".
  - Paywall UX v4.16.2: inline connect (Phantom / MetaMask) + chain selector (EVM) + "Sync & Check" to reduce false negatives.
  - Paywall UX v4.16.3: quick **Unlink** button for linked wallets directly on the paywall.
- Background holdings sync: worker job `nft:nft_gate_sync` (repeatable + webhook triggered).
- Clip as NFT: `/studio/clips` -> `POST /api/studio/clips/[id]/mint`
  - Admin: `SiteConfig.clipNftMarketplaceMode` (Option 1/2/BOTH) + `SiteConfig.clipNftOnChainMintEnabled` (Solana on-chain mint).
  - Worker: `nft:clip_mint_nft` mints on-chain using R2-hosted immutable metadata; `nft:nft_retry_dead_letters_scan` auto-retries failures.
## Search & Discovery (Task 9)
- Page `/search`: `app/search/page.tsx`
- Page `/explore`: `app/explore/page.tsx`
- APIs: `app/api/search/route.ts`, `app/api/search/suggest/route.ts`

## Offline Mode (PWA) (Task 10)
- SW: `public/sw.js`
- Offline page: `app/offline/page.tsx`
- Register: `components/pwa/PwaRegister.tsx`

## Creator tips + revenue (Task 11)
- Tip API: `app/api/creator/tip/route.ts`
- Studio revenue: `app/studio/revenue/page.tsx`

## Gamification (Task 12)
- APIs: `app/api/gamification/me/route.ts`, `app/api/gamification/leaderboard/route.ts`
- Page: `/leaderboard`: `app/leaderboard/page.tsx`

## Video chapters (Task 13)
- Public: `app/api/videos/[id]/chapters/route.ts`
- Studio: `app/studio/videos/[id]/chapters/page.tsx`

## Public API + RSS (Task 14)
- Public read-only API: `app/api/public/*`
- RSS feeds: `app/rss.xml/route.ts`, `app/u/[id]/rss.xml/route.ts`

## Creator webhooks (Task 14)
- Studio manager: `app/studio/webhooks/*`
- Worker delivery: `worker/src/jobs/creatorWebhooks/deliverPending.ts`

## Editor + Screen record (Task 15)
- Trim enqueue: `app/api/studio/editor/trim/route.ts` + worker `worker/src/jobs/editor/trimVideo.ts`
- Pages: `app/studio/editor/page.tsx`, `app/studio/record/page.tsx`

## v4.13.0 (Enhancements)
- Creator Fan Club recurring billing (worker): `worker/src/jobs/memberships/billingScan.ts` scheduled via repeatable `payments:membership_billing_scan` in `worker/src/index.ts`.
- Premium (Early Access) videos: `Video.access=PREMIUM` + unlock `POST /api/videos/[id]/unlock` + DB gate `lib/videoAccessDb.ts`.
- Creator monthly goals: `CreatorGoal` (Prisma) + progress bar UI on watch page (`app/v/[id]/page.tsx`).

## v4.11.0 (Enhancements)
- Trust/Safety/Infra: Stars anti-fraud risk rules + ledger export, moderation review queue, CDN smart purge, search caching.

## v4.10.0 (Enhancements)
- Search trending (Redis) + API `GET /api/search/trending`
- Notification settings (`/settings/notifications`, `/api/me/notifications/settings`)
- Comment reports (`/api/comments/report`, `/admin/reports/comments`)
- Creator Fan Club (membership plans + join)



## Storage redundancy (R2 + 2 FTP + Drive)
- Admin UI: `/admin/storage`, `/admin/storage/events`
- Admin API: `/api/admin/storage/*`
- Models: `StorageEndpointConfig`, `StorageSecret`, `VideoAsset`
- Worker: queue `storage`, jobs `backup_origin`, `mirror_hls`, `rebuild_hls_from_drive`, repeatables `apply_pending_config`, `health_scan`

## HLS packaging (/admin/hls)
- `/admin/hls` chọn 3 mode: TS / fMP4 / Hybrid
- Worker: `worker/src/jobs/encodeHls.ts`

## Player roadmap “PeerTube vibe” + R2 A/B
- Backlog phased plan: `TASK_TEMPLATE_CONTINUE.md`
