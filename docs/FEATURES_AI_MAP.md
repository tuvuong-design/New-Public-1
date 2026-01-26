# FEATURES_AI_MAP.md — v4.13.0

> Mục tiêu: giúp AI (khi mở chat mới) tìm đúng file/entrypoint nhanh nhất.
> **Lưu ý:** File này map theo **code hiện có** trong repo, không mô tả các tính năng chưa được implement.

**Current version:** v4.13.0

---

## 0) Source of truth
- `PROJECT_CONTEXT.md` — kiến trúc + flows + contracts
- `AI_REQUIREMENTS.md` — checklist + non-negotiables
- `TASK_TEMPLATE_CONTINUE.md` — roadmap tasks 1–6 (DONE/PARTIAL/TODO)
- `CHANGELOG.md` — timeline các phiên bản

---

## 1) Core flows

### Analytics (CTR / Studio)
- Client tracking link: `components/analytics/TrackedVideoLink.tsx` (impression + click).
- Ingest API: `app/api/analytics/events/route.ts` (queues to BullMQ).
- Queue: `lib/queues.ts` → `analytics`.
- Worker ingest: `worker/src/jobs/analytics/ingestEvents.ts` wired in `worker/src/index.ts`.
- Studio dashboard: `app/studio/analytics/page.tsx` + per-video: `app/studio/videos/[id]/analytics/page.tsx`.


### Upload → Worker → Playback
- Upload UI: `app/upload/page.tsx` (single + batch/multi select; sequential multipart uploads)
- Upload API: `app/api/upload/*`
- Enqueue process: `app/api/videos/queue-process/route.ts` → `lib/queues.ts`
- Worker video jobs:
  - `worker/src/jobs/processVideo.ts`
  - `worker/src/jobs/encodeHls.ts`
  - (optional) `worker/src/jobs/subtitles.ts`, `worker/src/jobs/clamavScan.ts`
- Playback:
  - Watch page: `app/v/[id]/page.tsx`
  - Player components: `components/player/*`

### Similar videos
- Ranking logic: `lib/videos/similar.ts`
- Cache + invalidate: `lib/videos/similarCache.ts`
- Weights/scoring: `lib/videos/similarScoring.ts`
- Redis keys: `videoshare:similar:v1:{videoId}` + fan-out index `videoshare:similar:index:v1:child:{childId}`

### Payments / Stars topup
- User UI: `app/stars/topup/*`
- Webhooks:
  - `app/api/webhooks/helius/route.ts`
  - `app/api/webhooks/alchemy/route.ts`
  - `app/api/webhooks/quicknode/route.ts`
- Admin UI: `app/admin/payments/*`
- Admin APIs: `app/api/admin/payments/*`
- Payments libs: `lib/payments/*`
- Worker payments jobs:
  - `worker/src/jobs/payments/*`
  - `worker/src/index.ts` registers repeatable jobs (`reconcile_stale_scan`, `retry_dead_letters_scan`, `alert_cron`, `membership_billing_scan`)


### Creator Fan Club (Membership) + Premium videos
- Membership models: `CreatorMembershipPlan`, `CreatorMembership`, `CreatorMembershipInvoice` in `prisma/schema.prisma`.
- Plan manage UI: `app/studio/membership/page.tsx` + `app/api/studio/membership/plans/*`.
- Join API: `POST /api/creators/[id]/membership/join` (`app/api/creators/[id]/membership/join/route.ts`).
- Billing worker: `worker/src/jobs/memberships/billingScan.ts` scheduled as repeatable job `payments:membership_billing_scan` in `worker/src/index.ts`.
- Premium unlock API: `POST /api/videos/[id]/unlock` (`app/api/videos/[id]/unlock/route.ts`) writes `VideoUnlock`.
- Access guard: `lib/videoAccessDb.ts` (`canViewVideoDb` / `canInteractWithVideoDb`).
- Watch paywall UI: `app/v/[id]/ui/PremiumGateClient.tsx` + `app/v/[id]/page.tsx`.
- Creator goals (Stars/month): `CreatorGoal` (Prisma) + watch progress bar (`components/creator/CreatorGoalBar.tsx`).

### Analytics & Insights (MVP)
- Ingest API: `app/api/analytics/events/route.ts` → worker `analytics`
- Realtime viewers API: `app/api/analytics/realtime/route.ts`
- Studio overview: `app/studio/analytics/page.tsx`
- Studio per-video: `app/studio/videos/[id]/analytics/page.tsx`

### Creator tools (MVP)
- SEO analyzer: `app/studio/videos/[id]/seo/page.tsx` + `app/studio/videos/[id]/seo/SeoPanel.tsx`
- Tags suggestion endpoint: `app/api/studio/videos/[id]/tags/suggest/route.ts` + logic `lib/seo/tagsSuggest.ts`

### Performance (MVP)
- Image optimization wrapper: `components/media/SmartImage.tsx` + config `next.config.mjs`
- Player preload: `components/player/VideoPlayer.tsx`

---

## 2) Moderation / Safety

### Sensitive videos (PeerTube-like)
- Server policy: `lib/sensitive.ts`
- Thumbnail gate/blur components: `components/sensitive/*`
- Docs: `docs/SENSITIVE_VIDEOS.md`

### Video password gate (HTTP 401)
- Watch gating: `app/v/[id]/page.tsx` (calls `unauthorized()` when locked and not unlocked)
- Unauthorized UI: `app/v/[id]/unauthorized.tsx`
- Unlock endpoint: `app/api/videos/[id]/unlock/route.ts`
- Password + cookie utils: `lib/videoPassword.ts`

---

## 3) Monetization / Social

### Ads targeting (device/bot) + global banners
- UA detection: `lib/userAgent.ts`
- Ads API: `app/api/ads/route.ts`
- Admin config: `app/admin/ads/page.tsx` + `app/api/admin/ad-placement/route.ts`
- Global banners: `components/ads/GlobalBannerAds.tsx` (used in `app/layout.tsx`)
- Docs: `docs/ADS_TARGETING.md`

### Super Thanks (comment highlight)
- Comments API (sorting + top supporter + anonymous): `app/api/comments/route.ts`
- UI: `app/v/[id]/ui/Comments.tsx` + `app/v/[id]/ui/StarGiftButton.tsx`
- Effects CSS: `app/globals.css`
- Docs: `docs/SUPERTHANKS.md`

### Membership (Premium / Premium+)
- Membership utils: `lib/membership.ts`
- Purchase API: `app/api/membership/purchase/route.ts`
- Settings API: `app/api/membership/settings/route.ts` (`premiumPlusHideBoostAds`)
- UI: `app/premium/page.tsx`

---

## 4) Community / NFT

### Community posts + polls
- API: `app/api/community/*`
- UI: `components/community/*` + `app/u/[id]/community/*`

### NFT INTERNAL (không on-chain)
- Mint: `app/api/nft/mint/route.ts` + UI `app/nft/mint/page.tsx`
- Avatar: `app/api/nft/avatar/route.ts`
- UI: `app/nft/*` + `app/u/[id]/nfts/*`
- Marketplace (fixed-price listings):
  - APIs: `app/api/nft/listings/create/route.ts`, `app/api/nft/listings/[id]/cancel/route.ts`, `app/api/nft/listings/[id]/buy/route.ts`
  - Pages: `app/nft/market/page.tsx`, `app/nft/items/[id]/page.tsx`
- Helpers: `lib/nft/fees.ts`, `lib/stars/holds.ts`

### NFT Auctions (internal)
- APIs: `app/api/nft/auctions/create/route.ts`, `app/api/nft/auctions/[id]/bid/route.ts`, `app/api/nft/auctions/[id]/cancel/route.ts`, `app/api/nft/auctions/[id]/settle/route.ts`
- UI: integrated into `app/nft/market/page.tsx` + `app/nft/items/[id]/page.tsx`

### NFT export on-chain (foundation + beta verify)
- Export request flow: `app/api/nft/export/request/route.ts` → enqueue `lib/nft/exportQueue.ts`
- Submit tx: `app/api/nft/export/submit-tx/route.ts` (Solana: optional `mintAddress`)
- Tracking page: `app/nft/exports/page.tsx`
- Deterministic tokenId: `lib/nft/tokenId.ts`
- Worker: `worker/src/jobs/nft/exportPrepare.ts`, `worker/src/jobs/nft/exportVerify.ts`
- Admin: `/admin/nft/contracts` + `/admin/nft/events` + API `app/api/admin/nft/contracts/route.ts`


---

## 5) External sync (PeerTube / PHP API)

### Admin ApiSource
- Admin page: `app/admin/api-sources/page.tsx`
- Worker job: `worker/src/jobs/syncApiSource.ts`

### User self-service (PeerTube vibe)
- Page: `/my-channel/sync` (under `app/my-channel/sync/*` if present in repo)
- APIs: `app/api/me/sync-sources/*`

---

## 6) v4.4.0 delta (trong repo hiện tại)
- Prisma schema added groundwork for Notifications:
  - `NotificationType` enum + `Notification` model in `prisma/schema.prisma`
- Docs sync + packaging for v4.4.0 (`CHANGELOG.md`, `PROJECT_CONTEXT.md`, `AI_REQUIREMENTS.md`, `ALL_FEATURES.txt`).


---

## 7) Roadmap Tasks 9–15 (implemented in v4.8.x)

### Task 9 — Search & Discovery MVP
- Pages: `app/search/page.tsx`, `app/explore/page.tsx`, `app/tag/[slug]/page.tsx`, `app/category/[slug]/page.tsx`
- APIs: `app/api/search/route.ts`, `app/api/search/suggest/route.ts`

### Task 10 — Offline Mode (PWA) MVP
- Offline page: `app/offline/page.tsx`
- Service worker: `public/sw.js`
- Register component: `components/pwa/PwaRegister.tsx` (client)
- Upload offline queue: `lib/pwa/offlineUploadQueue.ts` + integration in `app/upload/page.tsx`

### Task 11 — Creator monetization (stars tips) MVP
- Tip API: `app/api/creator/tip/route.ts`
- Revenue dashboard: `app/studio/revenue/page.tsx`
- Models: `CreatorTip` + `NotificationType.CREATOR_TIP`

### Task 12 — Gamification MVP
- APIs: `app/api/gamification/me/route.ts`, `app/api/gamification/leaderboard/route.ts`
- Pages: `app/leaderboard/page.tsx`
- Models: `XpEvent`, `Badge`, `UserBadge`, `DailyTaskProgress`

### Task 13 — Video chapters
- Public API: `app/api/videos/[id]/chapters/route.ts`
- Studio editor API: `app/api/studio/videos/[id]/chapters/route.ts`
- Studio UI: `app/studio/videos/[id]/chapters/page.tsx`
- Player UI: `app/v/[id]/ui/Chapters.tsx`

### Task 14 — Public API + creator webhooks + RSS
- Public API (read-only): `app/api/public/videos/*`, `app/api/public/video/[id]`, `app/api/public/search`
- RSS: `app/rss.xml/route.ts`, `app/u/[id]/rss.xml/route.ts`
- Studio webhooks manager: `app/studio/webhooks/*` + API `app/api/studio/webhooks/*`
- Worker delivery: `worker/src/jobs/creatorWebhooks/deliverPending.ts` (queue `creatorWebhooks`)

### Task 15 — Video editor + screen recording (phased MVP)
- Studio editor: `app/studio/editor/page.tsx` + API `app/api/studio/editor/trim/route.ts` (queues to worker)
- Worker trim job: `worker/src/jobs/editor/trimVideo.ts` + queue `editor`
- Screen recording: `app/studio/record/page.tsx`

## v4.10.0 Retention & Community
- Playlists: `app/playlists/*`, `app/p/[id]/*`, `app/api/playlists/*`, models `Playlist`, `PlaylistItem`.
- Continue Watching/History: `GET /api/progress` (`app/api/progress/route.ts`), pages `app/history/page.tsx`, player `components/player/VideoPlayer.tsx`.
- Comment pin/heart: fields trong `Comment` (Prisma) + API `app/api/comments/moderate/route.ts` + UI `app/v/[id]/ui/Comments.tsx`.

### Retention & Community (v4.10.0)
- Playlists (CRUD + items): `app/api/playlists/*`, pages `app/playlists/*`, `app/p/[id]/*`, UI `app/v/[id]/ui/AddToPlaylistButton.tsx`.
- Continue Watching + History: `app/api/progress/route.ts` (GET support), pages `app/history/page.tsx`, home shelf `app/page.tsx`.
- Comment pin/heart: `app/api/comments/moderate/route.ts`, UI `app/v/[id]/ui/Comments.tsx`.

## v4.10.0 additions
- Search trending (Redis ZSET) + `/api/search/trending`
- Notification settings (disable per type) + `/settings/notifications`
- Comment reports + admin review page
- Creator Fan Club membership (plans + join API)


## Trust, safety & infra (v4.11.0)
- Stars ledger UI: `app/admin/stars/transactions/page.tsx`
- Stars ledger export API: `app/api/admin/stars/export/ledger/route.ts`
- Ledger audit counters (payments dashboard): `app/api/admin/payments/dashboard/route.ts`
- Stars risk rules (web): `lib/payments/risk.ts`
- Stars risk rules (worker): `worker/src/jobs/payments/risk.ts`
- Payments alert cron: `worker/src/jobs/payments/alertCron.ts`
- Moderation queue jobs: `worker/src/jobs/moderation/*` (review_report)
- Report endpoints: `app/api/reports/*`, `app/api/comments/report/route.ts`
- CDN purge helper: `lib/cdn/purge.ts`
- CDN purge worker job: `worker/src/jobs/cdn/purgePaths.ts`
- Search hot cache + FULLTEXT: `app/api/search/route.ts`


## Storage redundancy (R2 primary + 2 FTP + Google Drive)
- Admin UI: `app/admin/storage/*`
- Admin APIs: `app/api/admin/storage/*`
- Playback resolver: `lib/storage/playback.ts`
- Worker: `worker/src/jobs/storage/*` + ensure repeatables in `worker/src/index.ts`

## HLS packaging (/admin/hls)
- Admin UI: `app/admin/hls/page.tsx`
- Encode: `worker/src/jobs/encodeHls.ts`
- Hybrid output: TS ladder + fMP4 source playlist

## Player roadmap “PeerTube vibe” + R2 A/B
- Backlog + phases in `TASK_TEMPLATE_CONTINUE.md`
