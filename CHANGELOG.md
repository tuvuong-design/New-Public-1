## 4.16.24 - 2026-01-28
### Added
- Admin (Payments):
  - **Bundles** config UI: `/admin/payments/bundles` + API `GET/POST /api/admin/payments/bundles` (bonusStars + label per package).
  - **Coupons** config UI: `/admin/payments/coupons` + APIs `GET/POST /api/admin/payments/coupons`, `DELETE /api/admin/payments/coupons/[id]`.
  - Payments dashboard links updated to include Bundles/Coupons.

### Fixed
- Manual credit/refund flow now matches worker reconcile: idempotency by `(depositId, type)`; supports bundle bonus + coupon bonus; refund sums TOPUP/BUNDLE_BONUS/COUPON_BONUS.

### Docs
- Core docs refreshed (root + `/docs`) to cover Season Pass, Referral bonus, Bundles, Coupons, and aaPanel deploy checklist.

---

## 4.16.23 - 2026-01-27
### Added
- **Season Pass 30 ngày** mua bằng Stars:
  - API: `GET /api/season-pass/status`, `POST /api/season-pass/purchase`
  - Ledger: `StarTransaction.type=SEASON_PASS_PURCHASE`, `discountReason=SEASON_PASS_30D`
  - Premium gating: Season Pass cho phép xem/interact với premium videos (site-wide).
- **Referral Stars** (1–20% do admin cấu hình):
  - User claim referral: `GET /api/referrals/me`, `POST /api/referrals/claim`
  - Auto bonus khi user (được giới thiệu) **TOPUP** hoặc **EARN** Stars
  - Ledger: `StarTransaction.type=REFERRAL_BONUS`, idempotency via `ReferralBonus` unique `(sourceKind, sourceId)`
- Docs: `docs/AAPANEL_DEPLOY.md` (checklist deploy aaPanel + Prisma rules).

### Changed
- Payments config (/admin/payments/config) thêm section Growth/Monetization (Season Pass + Referral config).

# CHANGELOG













## 4.16.22 - 2026-01-27

### Added
- Fraud Radar (Admin): `/admin/payments/fraud` + admin APIs to list/ack/resolve fraud alerts.
- Fraud signals:
  - Duplicate txHash across deposits → auto mark deposit NEEDS_REVIEW at submit-time + FraudAlert.
  - submit-tx rate limit (per-user) → FraudAlert.
  - Large manual credit → FraudAlert.
- Worker: payments `alert_cron` now also runs `fraudRadarScanJob` to create idempotent alerts for webhook fail spikes / NEEDS_REVIEW bursts / duplicate txHash scans.

### Updated
- Docs “xương sống” + `CHATKITFULL.txt` updated to reflect Fraud Radar and ops workflow.

## 4.16.20 - 2026-01-27

### Added
- Share Cards (OG images): `/api/og/video/[id]`, `/api/og/clip/[id]`, `/api/og/creator/[id]`.
- Daily “Continue Watching” digest (in-app) via worker notifications repeatable job `continue_watching_digest` (opt-out in notification settings).

### Updated
- `TASK_TEMPLATE_CONTINUE.md` roadmap markers for Share Cards + Continue Watching.

## 4.16.19 - 2026-01-27
### Added
- Watch Later: implemented DB model `WatchLaterItem`, APIs (`GET /api/me/watch-later`, `POST /api/me/watch-later/toggle`), and a real `/watch-later` UI with resume support (uses `VideoProgress`).
- Watch page: added Watch Later toggle button (form-based, no client event handlers) in both desktop and mobile action bars.
- Stars Topup: implemented functional `/stars/topup` UI that lists active packages, creates deposit intents, submits txHash, and shows history/retry (reuses existing topup APIs).
- Prisma: added first explicit migration for Watch Later (`prisma/migrations/20260127000000_add_watch_later_item`) so production can use `prisma migrate deploy` incrementally.

## 4.16.18 - 2026-01-27
### Added
- Player UX: **Theater mode**, **mini-player** (auto pin when scrolled out while playing), and **PiP** button.
- Player UX: Hotkeys (PeerTube-ish): **J/K/L**, **ArrowLeft/Right**, **F** (theater), **M** (mute). Ignores keystrokes while typing in inputs.
- Admin `/admin/config`: new flag `SiteConfig.playerP2PEnabled` (experimental, PUBLIC only). (P2P loader integration requires installing `p2p-media-loader-hlsjs`; fallback HTTP remains default.)

### Fixed
- Player: removed duplicated segment prefetch handler definitions that could cause TS compile errors.

## 4.16.17 - 2026-01-27
### Added
- Player Phase 2: Playlist rewrite (custom hls.js loader) to convert relative URIs inside `.m3u8` into **absolute URLs** rooted at the active origin (R2 A/B or FTP HLS), reducing mixed-origin issues when failover happens.
- Player Phase 2: Light **prefetch** of the next 1–2 segments (rate-limited) to warm cache and reduce small stalls.
- Player UX: Fatal error overlay with buttons **Try another mirror** / **Retry**.
- Admin `/admin/storage`: R2 Playback A/B overrides (public base URL A/B + split %) stored in DB with the existing **pending apply 24h + audit + notify** flow.

### Changed
- Stream resolver `lib/playback/resolveStream.ts`: now prefers DB overrides for R2 A/B routing (fallback to env).

## 4.16.16 - 2026-01-27
### Added
- Player Phase 1 (watch page): HLS **origin failover** (R2 A/B + FTP HLS mirror) with automatic switch on fatal Hls.js errors, plus **quality selector** (Auto / 1080p / 720p…) and **stats overlay** (origin, rendition, bandwidth estimate, buffer, dropped frames).
- New stream resolver `lib/playback/resolveStream.ts` returning ordered candidates based on video health + A/B split (`R2_PUBLIC_BASE_URL_A/B`, `R2_AB_SPLIT_PERCENT`).

### Changed
- Worker HLS upload cache headers: **segments immutable** (`max-age=31536000, immutable`) but **playlists short + SWR** (`max-age=30, stale-while-revalidate=60`) for smoother ABR and safer CDN behavior.
- Updated `.env.example` with optional R2 A/B player env vars.

## 4.16.15 - 2026-01-27
### Changed
- Docs refresh (root + `/docs`): updated README, ARCHITECTURE, ADMIN_UI, FEATURE_MAP, AI_UPDATE_GUIDE, and CHATKITFULL so chat mới AI bám đúng roadmap v4.16.x (storage redundancy, HLS packaging, Trust & Safety, player phases).
- Updated core mapping docs: `FEATURES_AI_MAP.md` and `docs/*` copies; bumped target_version in `TASK_TEMPLATE_CONTINUE.md`.

## 4.16.14 - 2026-01-27
### Added
- Worker moderation escalation scan (auto mute/ban by strike thresholds + report velocity) integrated into repeatable `payments:alert_cron`.
- Weekly digest email (optional) via Resend (env-gated) + Notification Settings toggle `WEEKLY_DIGEST_EMAIL`.

### Changed
- Updated `TASK_TEMPLATE_CONTINUE.md` to mark Membership, Moderation escalation, and Digest email as DONE.

## 4.16.13 - 2026-01-26
### Added
- Added `CONTRACT_CHECKLIST.md` (root + `/docs`) and `scripts/contract-check.sh` to prevent contract drift across releases.

### Fixed
- Added missing contract pages `/watch-later` and `/stars/topup` (placeholder UIs; backend APIs already exist for topup).

## 4.16.12 - 2026-01-26
### Changed
- Synced **core docs (“xương sống”)** across root + `/docs` to reflect the latest roadmap and implementation notes:
  - Storage redundancy (R2 primary + FTP Origin + FTP HLS + Google Drive origin), 24h delayed apply, admin notify + audit log
  - `/admin/hls` packaging modes (TS / fMP4 / Hybrid)
  - Player roadmap “PeerTube vibe” + R2 A/B (2 domains) plan in `TASK_TEMPLATE_CONTINUE.md`
- Updated `CHATKITFULL.txt` (root + `/docs`) so a new chat can start with the correct **Source of Truth** and execution rules.
## 4.16.11 - 2026-01-26
### Changed
- Updated `README.md` (and `docs/README.md`) to include the **PeerTube-like HLS player + R2 A/B roadmap** (phased plan) so a new chat can start implementing immediately.


## 4.16.10 - 2026-01-26
### Changed
- `TASK_TEMPLATE_CONTINUE.md` (and `docs/` copy): added a detailed phased backlog for **PeerTube-like HLS player** (ABR, stats, retry/failover, mirror switching) and **Cloudflare R2 A/B** optimization (dual domains + cache headers strategy).

## 4.16.9 - 2026-01-26
### Added
- Admin `/admin/hls`: added a third packaging option **Hybrid** — **TS segments (.ts) ladder 1080/720/480** + an additional **fMP4 "source"** HLS output (init.mp4 + .m4s) that keeps original resolution.

### Changed
- Worker `encodeHls`: when Hybrid is selected, it produces two immutable HLS outputs under the same encodeId (`.../ts` and `.../fmp4_source`) and stores the fMP4 keys in `Video.hlsBasePathFmp4`/`Video.masterM3u8KeyFmp4`.

## 4.16.8 - 2026-01-26
### Added
- `package-lock.json` placeholder committed to repo (generated in sandbox). On a normal dev/CI machine with registry access, run `npm install` to regenerate a full lock before using `npm ci`.

### Changed
- Admin `/admin/hls` packaging labels clarified: **TS segments (.ts)** vs **fMP4 (init.mp4 + .m4s)**.
- `TASK_TEMPLATE_CONTINUE.md`: documented lockfile + HLS packaging choice.

## 4.16.7 - 2026-01-26
### Changed
- Updated `README.md` (and `docs/README.md`) to reflect latest v4.16.x features: storage redundancy (R2 + 2x FTP + Google Drive), admin storage flows, and NFT-gated foundations.

## 4.16.6 - 2026-01-24
### Added
- Storage redundancy (Admin-configurable): **R2 primary** + optional **FTP Origin** (MP4 backup) + optional **FTP HLS** (playlist/segments mirror) + optional **Google Drive Origin** (service account) as deep backup.
- Admin UI `/admin/storage`: verify connections, schedule config changes with **24h delay**, manual apply/cancel, and `/admin/storage/events` audit feed.
- Worker `storage` queue: repeatable `apply_pending_config` + `health_scan`; jobs `backup_origin` (MP4 to FTP/Drive) and `rebuild_hls_from_drive` (auto rebuild HLS into R2 if HLS missing and Drive backup exists).

### Changed
- Watch page playback now resolves HLS master URL with fallback to FTP HLS when `VideoAsset.healthStatus` indicates R2 HLS is down/degraded.

### Security
- All storage config changes are logged (actor, from→to, applyAt) to `NftEventLog` and broadcast to all admins via SYSTEM notifications.
## 4.16.4 - 2026-01-24
### Added
- TASK_TEMPLATE_CONTINUE: added a consolidated "Ideas backlog (Jan 2026+)" section with growth/viral/retention/trust suggestions for future phases.

## 4.16.5 - 2026-01-24
### Changed
- Updated `CHATKITFULL.txt` so starting a new chat only requires pasting it (reflects v4.16.x NFT layer, paywall UX, and key feature flags).
- Added `/docs/CHATKITFULL.txt` (docs mirror) to keep root + docs in sync.

## 4.16.3 - 2026-01-24
### Added
- Premium paywall: quick "Unlink" button for each linked wallet (no need to leave watch page).



## 4.16.2 - 2026-01-24
### Added
- Premium paywall UX: inline wallet connect + sign message directly on watch page (Phantom for SOL, MetaMask/EVM with chain selector).
- Premium paywall NFT unlock: "Sync & Check" button triggers wallet sync + short polling to reduce false negatives after recent transfers.
- Premium paywall displays linked wallets summary (chain + shortened address) and quick refresh.


## 4.16.1 - 2026-01-24
### Added
- Clip as NFT (Option 1): worker job `nft:clip_mint_nft` mints Solana NFT on-chain using public R2-hosted metadata (immutable key) and tracks limited editions via `ClipNftMint`.
- Clip as NFT (Option 2): upgraded `/studio/clips` UI to set `priceStars`, `listNow`, `editionSize`, `royaltyBps`, and view mint/listing status.
- NFT retry scan: worker repeatable `nft:nft_retry_dead_letters_scan` auto-retries failed clip mints (bounded attempts).

### Fixed
- Worker NFT queue wiring: `nft_gate_sync` repeatable is now scheduled and handled by worker.


## 4.16.0 - 2026-01-24
### Added
- Wallet linking foundation: `/settings/wallets` + signature verification (Solana/EVM) + rate-limit (`videoshare:ratelimit:{bucketKey}`).
- NFT Gated Membership (Proof-of-Fandom): `NftGateRule` + Studio UI `/studio/membership` (NFT Gate) + worker job `nft:nft_gate_sync` (repeatable + webhook-triggered).
- NFT Unlock for PREMIUM videos: `VideoNftGate` + Studio Video Access config `/studio/videos/[id]/access` + watch paywall CTA "Unlock with NFT".
- Admin config toggles for NFT gated features + `clipNftMarketplaceMode` (Option 1/2/Both).

### Fixed
- Membership billing scan excludes `CreatorMembership.source=NFT_GATE` (no accidental renew charge).


## 4.15.1 - 2026-01-23
### Docs
- Update `TASK_TEMPLATE_CONTINUE.md` (root + `/docs`) to reflect Playlist v2 status as DONE and clarify Membership badge status.


## 4.15.0 - 2026-01-23
### Added
- Moderation actions (Admin): `POST /api/admin/moderation/actions` (hide/unhide video/comment, strike, mute 7d, ban/unban) + audit UI `/admin/moderation/actions`.
- Keyword filters: `CreatorModerationSetting` + admin UI `/admin/moderation/keywords`; comment create auto-hides when content matches creator keywords.
- Notifications inbox: `/notifications` + APIs `GET /api/me/notifications`, `POST /api/me/notifications/read`.
- Weekly in-app digest: worker repeatable job `notifications:weekly_digest` creates `WEEKLY_DIGEST` notifications (respects NotificationSetting disable list).

### Fixed
- Comment create blocks muted/banned users.


## 4.14.0 - 2026-01-23
### Added
- Playlists v2: cover image upload (immutable R2 key), collaborators (VIEWER/EDITOR), reorder endpoint, and Series landing pages (`/series`, `/series/[slug]`).
- Watch "Up Next" autoplay overlay: uses playlist context (`?list=`) first, falls back to Similar cache; `VideoPlayer` emits ended event.
- Fan Club badge in comments: show creator membership tier (Bronze/Silver/Gold) next to commenter name when active for the video's creator.

### Fixed
- `VideoPlayer` HLS attach logic to support MP4 sources (clip playback) without Hls.js errors.
- Duplicate UI elements on watch page (action buttons / chapters) removed.

## 4.13.1 - 2026-01-23
### Added
- Clip maker (MVP): `Clip` model + `POST /api/studio/clips/create` (enqueues `editor:create_clip`) + `/clip/[id]` page; worker generates 15–60s MP4 clip with watermark and uploads to immutable R2 key.
- Admin moderation alias routes: `/admin/moderation/*` redirects to existing reports UI (`/admin/reports/*`).

### Docs
- Update `TASK_TEMPLATE_CONTINUE.md` to track new wave tasks (Clip maker / moderation / playlists / Up Next).

## 4.13.0 - 2026-01-22
### Added
- Creator Fan Club recurring billing: worker repeatable job `payments:membership_billing_scan` charges Stars and extends `CreatorMembership` (idempotent via `CreatorMembershipInvoice`).
- Premium videos (Early Access): `Video.access=PREMIUM` gate uses DB-aware `canViewVideoDb` (membership/unlock); watch page shows Premium paywall with join/unlock actions.
- Creator monthly goals: `CreatorGoal` + progress bar on watch page using `VideoMetricDaily.stars` for current month.





## 4.12.1 - 2026-01-22
### Fixed
- `/boost`: refactor interactive handlers (form submit + cancel) into a Client Component (`app/boost/ui/BoostClient.tsx`) to avoid Next.js Server Component boundary errors.

## 4.12.0 - 2026-01-22
### Added
- Growth Hacker Phase A (CTR tracking): client-side card impression/click events (`CARD_IMPRESSION`, `CARD_CLICK`) via `POST /api/analytics/events` (best-effort, queued).
- Studio analytics (creator): `/studio/analytics` now shows daily views/unique/watch time + CTR chart and top traffic sources table.
- Per-video analytics page: `/studio/videos/[id]/analytics` includes CTR metrics alongside watch/retention (MVP).

### Changed
- Analytics pipeline: analytics events are queued to `analytics` BullMQ queue (`analytics_ingest_events`) and aggregated into `VideoMetricDaily` + `VideoTrafficSourceDaily`.

## 4.11.0 - 2026-01-22
### Added
- Stars ledger filters + CSV export: enhanced `/admin/stars/transactions` and new `GET /api/admin/stars/export/ledger`.
- Anti-fraud / risk rules for Stars credit (best-effort, Redis-backed): velocity + daily/hourly caps; risky credits are moved to `NEEDS_REVIEW` with `RISK_REVIEW` event logs.
- Moderation review pipeline queue: enqueue on report creation (video + comment) to `moderation:review_report` (best-effort Discord notify).
- CDN smart purge queue: enqueue UI path purges on video publish/hide/delete/metadata changes (Cloudflare purge optional via `CLOUDFLARE_*`).

### Changed
- Search API: `GET /api/search` now uses MySQL FULLTEXT relevance (when possible) + Redis hot-query cache (`videoshare:search:cache:v1:*`).
- Payments dashboard: add quick ledger-audit counters (credited-without-tx / tx-without-deposit / double-credit) in `GET /api/admin/payments/dashboard`.

### Fixed
- Prisma schema: removed invalid `access` indexes from `StarDeposit` and `VideoReport`.
- Worker payments: reconcile auto-credit now writes `StarTransaction` using canonical fields (`delta`, `stars`, `type`, `depositId`).

## 4.10.0 - 2026-01-22
### Added
- Search trending (Redis ZSET): `GET /api/search/trending` and best-effort tracking in `GET /api/search`.
- Notification settings: `GET/POST /api/me/notifications/settings` + page `/settings/notifications`.
- Comment reports: `POST /api/comments/report` + admin status update `POST /api/admin/reports/comments` + page `/admin/reports/comments`.
- Creator Fan Club (membership) MVP: studio manage plans `/studio/membership` + API `/api/studio/membership/plans*` and join API `POST /api/creator/membership/join`.
### Changed
- Studio nav: thêm mục `Membership`.
- Creator tips notifications respect `NotificationSetting` (disable `CREATOR_TIP`).

## 4.9.0 - 2026-01-22
### Added
- Playlists (MVP): user playlists page `/playlists`, public playlist page `/p/[id]`, and API `GET/POST /api/playlists`, `GET/PATCH/DELETE /api/playlists/[id]`, `POST/DELETE /api/playlists/[id]/items`.
- Continue Watching (cross-device): `GET /api/progress?videoId=...` and player auto-resume using saved progress (or `?t=`).
- History page `/history` (watch progress list).
- Comment creator engagement (MVP): pin/unpin (single pinned per video) + heart/unheart for video owner/admin via `/api/comments/moderate`.

### Changed
- Comments sorting: pinned → hearted → SuperThanks → newest.

### Fixed
- Server/Client boundary: playlist item removal moved to client component.


## 4.8.1 - 2026-01-22
### Changed
- Docs sync (xương sống): update version headers and align root + /docs copies for required docs files.
- Refresh AI maps and rebuild prompt to reflect v4.8.x (Tasks 9–15 implemented).
### Fixed
- Documentation file-path references for PWA SW register and offline upload queue.


## 4.8.0 - 2026-01-21
### Added
- Task 9 (Search & Discovery MVP): `/search`, `/explore`, `/tag/[slug]`, `/category/[slug]`, API `GET /api/search` + suggestions `GET /api/search/suggest`.
- Task 10 (Offline Mode MVP): PWA service worker + `/offline` fallback + SW registration client component + offline upload queue (IndexedDB) on `/upload`.
- Task 11 (Creator monetization MVP): stars-based tips API `POST /api/creator/tip`, notifications `CREATOR_TIP`, creator revenue dashboard `/studio/revenue`.
- Task 12 (Gamification MVP): XP/Level + badges + daily tasks + leaderboard (`/leaderboard`, `GET /api/gamification/me`, `GET /api/gamification/leaderboard`).
- Task 13 (Chapters): public chapters API `GET /api/videos/[id]/chapters`, studio editor `/studio/videos/[id]/chapters`, chapters list under player with seek.
- Task 14 (Public API + RSS + creator webhooks): public read-only API `GET /api/public/*`, RSS feeds `/rss.xml` & `/u/[id]/rss.xml`, studio webhooks manager `/studio/webhooks` + worker delivery queue.
- Task 15 (Editor + Record MVP): worker-assisted trim job + `/studio/editor`, browser screen recording `/studio/record`.

## 4.7.3 - 2026-01-21
### Added
- NFT Contracts admin hardening (Task 6):
  - Seed default SOLANA contract/program address: `EYXjrNBgpacCXo5a6smeGnUijFf5eiFHew5torEta216` (editable via Admin UI).
  - Admin contract changes now validate address format by chain (SOLANA/TRON/EVM).
  - Admin contract rotation UX: status banners on `/admin/nft/contracts` with scheduled apply time / not-due blocking.
  - Admin notifications: each set/apply action emits **SYSTEM** notifications to all admins.
  - Event log improved: includes `fromAddress` → `toAddress` for pending+apply.


## 4.7.2 - 2026-01-21
### Added
- NFT Export (Task 6) polish:
  - Solana verify can auto-detect `mintAddress` from transaction token balance deltas (no longer required from user).
  - TRON owner mirror support (`ownerOf`) when `SiteConfig.nftExportMirrorMode=MIRROR`, with Redis cache.

### Changed
- `/nft/exports`: removed Solana `mintAddress` input (auto-detect in worker verify).


## 4.7.1 - 2026-01-21
### Added
- Performance (MVP):
  - `next/image` optimization via `SmartImage` wrapper + `next.config.mjs` `images.remotePatterns` from `R2_PUBLIC_BASE_URL`.
  - Video preload defaults: player sets `preload="metadata"` + `crossOrigin="anonymous"`.
- Creator tools (MVP):
  - Batch Upload: `/upload` now supports selecting multiple files and uploads sequentially (multipart R2) then queues processing.
  - SEO Analyzer: `/studio/videos/[id]/seo` heuristic score for title/description/tags/thumb/category, with quick links to Admin metadata.
  - Tags Suggestion (heuristic): `GET /api/studio/videos/[id]/tags/suggest` suggests tag slugs from title/description.

### Changed
- Studio video analytics page links to SEO page.


## 4.7.0 - 2026-01-21
### Added
- Analytics & Insights (MVP):
  - Event ingest API: `POST /api/analytics/events` (queued to worker, no heavy work in web request).
  - Realtime viewers API: `GET /api/analytics/realtime?videoId=...` (Redis ZSET, last 60s).
  - Viewer cookie: middleware sets `vsid` (stable anonymous id) for analytics + A/B assignment.
  - Prisma models:
    - `VideoMetricDaily` extended with `uniqueViews`, `watchSeconds`, `completes`, `avgWatchPct`.
    - New: `VideoMetricHourly`, `VideoAudienceCountryDaily`, `VideoRetentionDaily`.
    - New A/B: `VideoExperiment`, `VideoExperimentVariant` (aggregated counters).
  - Worker:
    - New queue `analytics` + job `analytics_ingest_events` updating Redis + metrics tables.
  - UI:
    - Watch page shows realtime badge and emits analytics events from player.
    - Studio pages:
      - `/studio/analytics` overview.
      - `/studio/videos/[id]/analytics` charts + audience + retention + A/B controls.
      - A/B create/end endpoints: `POST /api/studio/experiments/create`, `POST /api/studio/experiments/[id]/end`.

### Notes
- Payments/Worker/Redis keys contracts unchanged (existing keys preserved; analytics introduces new prefixed keys under `videoshare:analytics:*` and `videoshare:realtime:*`).
- Retention is cumulative threshold counts (P25/P50/P75/P90/P95). Audience country is inferred from CF/Vercel headers; unknown = `ZZ`.

## 4.6.2 - 2026-01-20
### Added
- NFT export verification for **SOLANA** and **TRON** (beta):
  - `/api/nft/export/request` now supports `SOLANA` and `TRON` in allowlist (requires chain contract configured).
  - `/api/nft/export/submit-tx` accepts optional `mintAddress` for Solana (used in verify step).
  - Worker `nft_export_verify_tx`:
    - SOLANA: verifies tx success + token balance delta for `(walletAddress, mintAddress)`.
    - TRON: verifies Transfer event in tx via TronGrid events API (`/v1/transactions/{txid}/events`).
- UI:
  - `/nft/items/[id]`: enable Solana/Tron in chain selector.
  - `/nft/exports`: shows Solana `mintAddress` field when submitting tx.

### Changed
- Deterministic tokenId chain namespace: TRON uses mainnet chainId `728126428`.

### Notes
- Solana export verify currently requires user to provide `mintAddress` (manual mint flow). Full mint program integration remains TODO.
- Payments/Worker/Redis keys contracts unchanged.

## 4.6.1 - 2026-01-20
### Added
- NFT export (EVM) enhancements:
  - Optional **media upload to IPFS** when `metadataStrategy=IPFS_MEDIA`:
    - Uploads image (and optionally direct video URL if `includeVideoInIpfs=1`) to `nft.storage`.
    - Charges stars by uploaded size using `SiteConfig.nftExportUploadMediaFeePerGbStars`.
    - Size safeguard: skip/limit uploads > 200MB and emit audit events.
  - Read-only on-chain owner mirror (configurable):
    - `SiteConfig.nftExportMirrorMode=MIRROR` shows ERC721 `ownerOf(tokenId)` for EXPORTED NFTs (EVM only).
    - Cached in Redis key `videoshare:nft:owner:v1:{chain}:{contract}:{tokenIdHex}` (TTL 5m).
### Fixed
- Remove accidental `ethers` import (no dependency) by switching deterministic tokenId + EVM Transfer topic hashing to `@noble/hashes`.

### Notes
- Solana/Tron export verification is still TODO; export request API now rejects `SOLANA/TRON` with `CHAIN_UNSUPPORTED_YET` to avoid freezing items.
- Payments/Worker/Redis keys contracts unchanged.

## 4.6.0 - 2026-01-20
### Added
- Internal NFT marketplace (auctions MVP):
  - Auction APIs: POST `/api/nft/auctions/create`, `/api/nft/auctions/[id]/bid`, `/api/nft/auctions/[id]/cancel`, `/api/nft/auctions/[id]/settle`.
  - Auction UI integrated into:
    - `/nft/market` (auctions list)
    - `/nft/items/[id]` (create/bid/cancel/settle) via **form POST** (Server Component safe).
  - Escrow bids using `StarHold` with outbid refunds and settle transfer + audit.
- NFT export on-chain (foundation):
  - User export flow:
    - POST `/api/nft/export/request` (creates `NftExportRequest`, freezes internal marketplace immediately)
    - POST `/api/nft/export/submit-tx` (submit txHash for verification)
    - `/nft/exports` (user tracking page)
  - Deterministic tokenId: `uint256(keccak256(abi.encodePacked("SRNFT:", chainid, nftId)))`.
  - Worker queue `nft` jobs:
    - `nft_export_prepare` → upload metadata JSON to nft.storage → set request status `READY`.
    - `nft_export_verify_tx` → verify EVM Transfer event by txHash → set status `EXPORTED`.
- Admin NFT management:
  - `/admin/nft/contracts` + `/api/admin/nft/contracts` with **pending + delay** (default 24h) and audit logs.
  - `/admin/nft/events` audit trail page.

### Changed
- `prisma/seed.ts`: seed Polygon primary export contract (`0xF6E5fEB76959f59c80023392386B997B068c27c6`) and optional chain contract env overrides.
- `.env.example`: documented NFT export contract env vars.

### Notes
- Payments/Worker/Redis keys contracts unchanged.

## 4.5.0 - 2026-01-20
### Added
- Internal NFT marketplace (fixed-price MVP):
  - Market page: /nft/market
  - Item detail page: /nft/items/[id] with create/cancel/buy listing via form POST (Server Component safe).
  - Listing APIs: POST /api/nft/listings/create; POST /api/nft/listings/[id]/cancel; POST /api/nft/listings/[id]/buy.
- Fee + royalty breakdown helper: lib/nft/fees.ts (platform fee bps + royalty bps + creator/author split).
- StarHold auto-release helper: lib/stars/holds.ts (release matured holds with audit HOLD_RELEASE transactions).

### Changed
- Stars spend/balance endpoints opportunistically release matured holds before checking balance:
  - GET /api/stars/balance
  - POST /api/stars/send
  - POST /api/gifts/send
  - POST /api/membership/purchase
  - POST /api/boost/start
  - POST /api/nft/mint

### Notes
- Payments/Worker/Redis keys contracts unchanged.



## 4.4.1 - 2026-01-20
### Updated
- Docs refresh for new-chat AI reliability: README.md, AI_UPDATE_GUIDE.md, docs/README.md, docs/ARCHITECTURE.md, docs/FEATURE_MAP.md, docs/ADMIN_UI.md.
- Keep behavior unchanged; this is documentation-only.

> Ghi chú: lịch sử v1.0.0 → v3.9.0 đã được gom vào `docs/HISTORY_v1.0.0_to_v3.9.0.md`.

## 4.4.1 - 2026-01-20
### Updated
- Docs sync: refreshed README/ARCHITECTURE/FEATURE_MAP/ADMIN_UI/AI_UPDATE_GUIDE (+ copies in /docs) to avoid drift in new chats.
- No runtime behavior change; keep existing contracts/queues/redis keys.

## 4.4.0 - 2026-01-20
### Added
- Prisma groundwork for Notifications + Nested Comments + Mentions:
  - `NotificationType` enum + `Notification` model
  - `User.username` (unique) for `@username` mentions
  - `Comment.parentId`, `Comment.rootId`, `Comment.depth` for nested threading

### Notes
- This release introduces **database schema support** for the above features; application routes/UI hooks should be implemented in a follow-up release if not already present.


## 4.3.8 - 2026-01-19
### Added
- My Channel: thêm trang **Đồng bộ hóa** theo vibe PeerTube: `/my-channel/sync` (modal tạo đồng bộ, bảng danh sách, nút đồng bộ ngay).
- User APIs cho đồng bộ hóa:
  - `GET/POST /api/me/sync-sources`
  - `POST /api/me/sync-sources/[id]/run`
  - `PATCH/DELETE /api/me/sync-sources/[id]`
### Changed
- Prisma `ApiSource`: thêm fields `ownerId`, `channelId`, `lastSyncAt`, `lastSyncStatus`, `lastSyncError` để hỗ trợ đồng bộ theo user và hiển thị trạng thái.
- Worker `syncApiSource`: hỗ trợ `existingMode=NEW_ONLY` (chỉ lấy video mới), `fixedChannelId` (đẩy video vào 1 kênh cố định), và cập nhật lastSync status/error.

## 4.3.7 - 2026-01-19
### Updated
- Password gate UI: tăng "PeerTube vibe" cho màn nhập mật khẩu (icon khóa, warning strip, nền blur cover từ thumbnail, typography/contrast tốt hơn).

## 4.3.6 - 2026-01-19
### Added
- Video password gate: trả **HTTP 401 Unauthorized** (thay vì 404) khi truy cập trang watch `/v/[id]` nếu video có `accessPasswordHash` và viewer chưa unlock.
  - UI màn che “PeerTube vibe” trong `app/v/[id]/unauthorized.tsx` + nút “Tôi hiểu và muốn xem”.
  - API unlock: `POST /api/videos/[id]/unlock` (form POST, set HttpOnly signed cookie theo video).
- External sync: seed 2 ApiSource mẫu (disabled by default):
  - PeerTube3 (REST API)
  - Zone3s posts API (`api-posts_mysqli.php`)
### Updated
- Watch page mobile: layout theo vibe **m.youtube.com** (action bar scroll ngang dưới player; desktop giữ layout 2 cột).
- Worker `syncApiSource`: thêm hỗ trợ `kind=peertube` + assign owner qua env, sync channel, không resurrect video đã DELETED.
- Media URLs: thêm `resolveMediaUrl()` để hỗ trợ cả R2 keys và absolute URLs từ external sources.

## 4.3.5 - 2026-01-19
### Added
- Documentation: added `ALL_FEATURES.txt` (and `docs/ALL_FEATURES.txt`) listing full feature/function inventory for AI/new chats.

## 4.3.4 - 2026-01-19
### Updated
- Super Thanks UI: PeerTube vibe (accent bar), badge layout giống PeerTube, badge vàng gradient "Super Thanks • X stars" + star fill icon.
- Sparkles: dùng ký tự ★ + animation nhảy múa rõ hơn (1-5 theo tier).
- Anonymous sender: thêm checkbox “Gửi ẩn danh” trong modal; API gửi Stars/Gifts nhận `anonymous`; Comments API trả `senderAnonymous`.
- Top Supporter: Comments API tính top supporter theo tổng stars trong video (groupBy sum) và chỉ gắn badge cho Diamond (>50) của top supporter.
- Comment sorting: Super Thanks lên đầu (isSuperThanks desc, superThanksStars desc, createdAt desc).

## 4.3.3 - 2026-01-19
### Added
- Super Thanks: thêm hiệu ứng đầy đủ theo tier (shimmer, sparkles 1-5, glow, spinning star, pulse, hover scale/shadow).
- Tier-based styling: Bronze/Silver/Gold/Platinum/Diamond + TOP SUPPORTER badge cho Diamond.
### Fixed
- Comments API trả thêm `isSuperThanks`, `superThanksStars`, `superThanksQty` để UI render đúng.
- CSS: giữ tương thích sticker overlay (`--st-hue` => `--st-border`/`--st-bg`).

## 4.3.2 - 2026-01-19
### Fixed
- Docs + packaging: bổ sung cảnh báo rõ ràng khi tạo full ZIP (yêu cầu có node_modules/.next/worker/dist).
- Packaging scripts: package:full in warning nếu chạy SKIP_BUILD=1 nhưng thiếu artifacts (tránh deploy nhầm).
- Docs: khuyến nghị tạo/commit package-lock.json để deploy ổn định (npm ci).

## 4.3.1 - 2026-01-19
### Added
- Packaging scripts: `npm run package:slim` và `npm run package:full` để tạo 2 bản ZIP phát hành (slim và full).
- `scripts/package-slim.sh` và `scripts/package-full.sh` (full sẽ chạy install + build trước khi zip).

### Docs
- QUICKSTART/aaPanel deploy: bổ sung mục “Packaging (Slim vs Full)” + hướng dẫn tạo full zip có `node_modules/.next/worker/dist`.

## 4.3.0 - 2026-01-19
### Fixed
- Admin Site Config: đồng bộ field names với Prisma schema (membership pricing/duration, NFT mint fees, export settings, treasuryUserId).
- Membership purchase: dùng `premiumDurationDays/premiumPlusDurationDays` đúng schema.
- Boost miễn phí Premium+: enforce theo `PremiumBenefitUsage` (tránh race, không dựa vào `BoostOrder.priceStars=0`).
- Comments: API trả thêm user `{id, name, membershipTier, membershipExpiresAt}` để client highlight Premium/Premium+.
- NFT mint: dùng `nftItemMintFeeStars` + `nftCollectionMintFeeStars`, trừ stars đúng, ghi `StarTransaction.stars`, và (nếu có) chuyển phí vào `treasuryUserId`.
- Video metadata lock: sau khi mint NFT, chặn đổi title/tags qua admin metadata update route (đảm bảo NFT metadata ổn định).

### Notes
- Release này tập trung “runtime correctness” + docs alignment. Các hạng mục NFT marketplace/export trong roadmap vẫn cần triển khai UI/API đầy đủ theo TASK 5/6.

## 4.2.5 - 2026-01-18
### Fixed
- Community polls: đồng bộ Prisma schema vs code
  - `CommunityPollOption.sort` (trước đây code dùng `index/idx` gây lỗi runtime).
  - `GET /api/community/posts`: viewer vote dùng relation `pollVotes`.
  - Thêm `CommunityPost.isDeleted` (soft-delete) + filter ở home/feed/subscriptions/channel community.
- Sensitive settings: form field đúng `sensitiveMode` + redirect về `#sensitive`.
- Comments API: `GET /api/comments` trả `{ comments: [...] }` đúng contract UI.
- NFT INTERNAL: đồng bộ Prisma schema vs UI/API
  - Fix `/api/nft/mint` + pages `/nft`, `/nft/mint`, `/u/[id]/nfts` (dùng `NftItem.name/createdAt/collection.creator`).
- Remove missing dependency: `VerifiedBadge` không còn import `lucide-react`.

### Changed
- Admin navigation: thêm link `/admin/ads`.

### Notes
- Release này tập trung ổn định (schema alignment), giúp project build/run sạch.

## 4.2.4 - 2026-01-18
### Added
- Docs: thêm:
  - `docs/SENSITIVE_VIDEOS.md`
  - `docs/ADS_TARGETING.md`
  - `docs/AAPANEL_DEPLOY.md` (hướng dẫn deploy aaPanel)

### Changed
- Update docs để mở chat mới AI bám đúng lộ trình: `PROMPT_REBUILD_PROJECT.md`, `FEATURES_AI_MAP.md`, `PROJECT_CONTEXT.md`, `AI_REQUIREMENTS.md`, `TASK_TEMPLATE_CONTINUE.md`.
- Sync lại bản copy trong `docs/` (PROJECT_CONTEXT / AI_REQUIREMENTS / CHANGELOG) để Admin Docs Index hiển thị đúng.
- README + Quickstart: ghi rõ lệnh chạy (docker compose up -d, prisma generate/push/seed, dev + worker:dev).

### Notes
- Release này chủ yếu update docs/roadmap để mở chat mới AI bám đúng lộ trình. Runtime behavior không đổi so với v4.2.3.

## 4.2.3 - 2026-01-17
### Added
- PeerTube-like **Sensitive videos**:
  - `Video.isSensitive` flag.
  - Viewer preference: `User.sensitiveMode` (SHOW/BLUR/HIDE) + site default `SiteConfig.sensitiveDefaultMode`.
  - Watch page `/v/[id]` adds a **content warning gate** (blur/hide) while keeping SEO/indexing intact.
  - OpenGraph image endpoint `/api/og/video/[id]` shows a warning/blur for sensitive videos.
- Ads targeting by device/bot:
  - `AdPlacement` adds `showOnMobile/showOnTablet/showOnDesktop/hideForBots` (default: mobile+tablet only; hide for bots).
  - `/api/ads` now auto-disables ads for bots/desktop based on placement targeting.

### Changed
- Feed + Trending + Home + User page listings render sensitive thumbnails with blur/labels depending on viewer settings.
- Admin:
  - `/admin/videos/[id]` can toggle “Sensitive content”.
  - `/admin/config` can set site default sensitive mode.
  - `/admin/ads` can configure device/bot targeting per placement.

## 4.2.2 - 2026-01-17
### Fixed
- Fix `StarGiftButton` module to compile cleanly (remove broken JSX/duplicated blocks).
- Rewrite `prisma/seed.ts` to avoid TypeScript parse errors and keep idempotent seeds.

## 4.2.1 - 2026-01-16
### Added
- Admin payments dashboard: thêm tabs **Stars credited** và **Token totals** trong cụm “Deposits analytics”.
- Dashboard API (`/api/admin/payments/dashboard`): trả thêm `starsCredited` (time-series + leaderboard) và `tokenTotals` (tổng theo symbol) để phục vụ báo cáo.

## 4.2.0 - 2026-01-15
### Added
- Module **Payments/Stars (topup)**: user topup flows, webhook ingest + audit log, reconcile pipeline.
- Admin payments UI `/admin/payments/*`: dashboard charts (fail-rate/time-series, volume, total), deposits list/detail, unmatched inbox, logs pages.
- **Export CSV** theo filter: deposits/events/webhooks.
- Payments config + secrets API: `/api/admin/payments/config`, `/api/admin/payments/secrets`.
- Worker payments queue + repeatable jobs: reconcile scan mỗi **2 phút**, dead-letter retry, alert cron.
- Meta docs để update dễ khi mở chat mới: `AI_REQUIREMENTS.md`, `PROJECT_CONTEXT.md`.

### Changed
- Similar videos cache: bổ sung **fan-out invalidation** khi update metadata (giảm stale đề xuất).

### Notes
- Default: `PAYMENTS_RECONCILE_EVERY_MS=120000` (2 phút), `PAYMENTS_TOLERANCE_BPS=50` (0.5%), `PAYMENTS_SUBMITTED_STALE_MINUTES=10`.

## 4.1.0 - 2026-01-14
### Added
- Redis cache cho **Similar Videos** (cache theo videoId) + invalidation khi update metadata (title/category/tags) và một số admin actions (publish/hide/requeue/delete).
- Trang admin **Docs Index**: `/admin/docs` (sidebar + search + render markdown) dùng `docs/docs.nav.json`.
- Thêm file prompt rebuild: `PROMPT_REBUILD_PROJECT.md` (để viết lại dự án từ đầu ở chat mới).
- Docs mới:
  - `docs/CACHING.md`
  - `docs/R2_OPTIMIZATION.md`
  - `docs/ADMIN_UI.md`
  - `docs/DOCS_SITE.md`

### Changed
- Chuẩn hoá UI các trang admin lớn theo `components/ui/*`:
  - `/admin/videos`, `/admin/videos/[id]`, `/admin/config`, `/admin/reports`, `/admin/boost/*`
- Worker upload assets sử dụng **immutable keys** + `Cache-Control` phù hợp (tối ưu cache/CDN, giảm Class B).

### Notes
- Nếu bạn dùng Cloudflare CDN trước R2, hãy cấu hình cache rules theo `docs/R2_OPTIMIZATION.md`.

## 4.0.0 - 2026-01-14
### Added
- TailwindCSS + bộ UI components “shadcn-like” (`components/ui/*`) + layout mới.
- `docker-compose.yml` chạy MySQL 8 + Redis 7.
- `vitest` + unit tests cơ bản.
- Similar videos nâng cao: tags + category + full-text ranking + exclude current + prefer same channel.

### Changed
- Worker `encodeHls` tối ưu theo `ladderJson` sinh từ checkbox admin (doc v3.1+):
  - `split+scale` filter_complex
  - option theo từng rendition (`-preset:v:i`, `-b:v:i`, ...)
  - keyframe alignment bằng `-force_key_frames` + `independent_segments`
  - tránh upscale + detect audio stream

### Notes
- History v1.0.0 → v3.9.0: xem `docs/HISTORY_v1.0.0_to_v3.9.0.md`
