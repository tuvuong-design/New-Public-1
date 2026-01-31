TASK REQUEST

## Progress snapshot
- ✅ Extra (v4.16.6): Storage redundancy (R2 primary + optional FTP Origin/HLS + Google Drive origin backup) — Admin UI `/admin/storage` (verify + 24h delayed apply + audit log) + worker `storage` queue (mirror HLS, backup MP4, health scan, auto rebuild from Drive).
- ✅ Extra (v4.16.9): HLS packaging selectable in Admin `/admin/hls` — (1) TS segments (.ts), (2) fMP4 (init.mp4 + .m4s), (3) Hybrid: TS 1080/720/480 + fMP4 "source".
- ✅ Extra (v4.16.8): Added lockfile placeholder `package-lock.json` (offline-generated). NOTE: regenerate đầy đủ bằng `npm install` trên môi trường có access registry.
- ✅ Extra (v4.16.19): Watch Later fully implemented: `WatchLaterItem` model + APIs + `/watch-later` UI with resume; watch page action button.
- ✅ Extra (v4.16.19): Stars Topup page `/stars/topup` now has a functional UI (packages -> intent -> submit tx -> history/retry).
- ✅ Extra (v4.16.23): **Season Pass 30 ngày** (Stars) + **Referral Stars** (1–20% admin configurable) + coupon discount ledger fields.
- ✅ Extra (v4.16.24): Bundles/Coupons ARPU:
  - Topup packages support `bonusStars` + `bundleLabel` and credit flow creates idempotent ledger tx (TOPUP + BUNDLE_BONUS).
  - Coupons: TOPUP coupon adds bonus stars; Season Pass coupon discounts price; redemptions are recorded.
  - Admin UI: `/admin/payments/bundles`, `/admin/payments/coupons`.
  - Manual credit/refund updated to match worker reconcile `(depositId,type)` idempotency.
 (v4.13.0)
- ✅ Task 1: Sensitive videos (SHOW/BLUR/HIDE), PeerTube-like gate + blur thumbnails + OG warning; admin/user settings; bulk actions; violator-only + interactions lock.
- ✅ Task 2: Premium/Premium+ (pay in stars) + badge; Premium hides non-boost ads; Premium+ can optionally hide boost ads + free boost quota tracking + comment highlight.
- ✅ Task 3: Community posts + polls (YouTube-like) + mixed into feeds.
- ✅ Task 0: Super Thanks (PeerTube vibe) — shimmer/sparkle/glow/spin/pulse + gold badge + anonymous sender + TOP SUPPORTER logic + comment sorting.
- ✅ Task 4: Internal NFT mint fee (stars, admin configurable) + mint fee goes to treasury + lock title/tags after mint.
- ✅ Extra: Video password gate (HTTP 401) + unlock form POST + signed cookie + PeerTube-style warning strip + blur cover.
- ✅ Extra: External sync foundation (ApiSource seeds + worker sync supports PeerTube + absolute URLs + skip DELETED).
- ✅ Extra: My Channel Sync UI (PeerTube vibe): `/my-channel/sync` + user APIs `/api/me/sync-sources/*` + ApiSource ownership/status fields.
- ✅ Extra (v4.4.0): Notifications groundwork (Prisma only): `NotificationType` + `Notification` model in `prisma/schema.prisma`.
- ✅ Extra (v4.4.1): Docs refresh (README, AI_UPDATE_GUIDE, ADMIN_UI, FEATURE_MAP, ARCHITECTURE, docs index) để chat mới AI không bị lệch.
- ✅ Task 5: Internal NFT marketplace — fixed-price listing + auctions MVP:
  - Listings: market + item detail + create/cancel/buy + fee/royalty split + first unverified sale hold.
  - Auctions: create/bid/outbid refund/cancel (no-bid)/settle with StarHold escrow.
-- ✅ Task 6: Export NFT on-chain — DONE (metadata + optional media upload + verification + mirror):
  - User flow: request export (freeze marketplace), prepare metadata on worker, submit txHash, verify on-chain, set EXPORTED.
  - Admin contract rotation delay 24h + event log + notify all admins (SYSTEM notifications).
  - Default SOLANA contract/program address seeded: `EYXjrNBgpacCXo5a6smeGnUijFf5eiFHew5torEta216` (changeable via Admin UI with 24h delay).
  - Optional upload media to IPFS (image + optional direct video url) with stars fee-by-size.
  - Read-only mirror owner on-chain (EVM ownerOf, TRON ownerOf) when `SiteConfig.nftExportMirrorMode=MIRROR`.
  - SOLANA verify auto-detects `mintAddress` from tx token balance deltas (no user input).

- ✅ Extra (v4.16.1): Clip as NFT on-chain mint (Solana) — worker job `nft:clip_mint_nft` + `ClipNftMint` editions + upgraded Studio UI `/studio/clips` (priceStars/listNow/editionSize/royalty) + Admin flag `clipNftOnChainMintEnabled`.

- ✅ Extra (v4.16.2): Premium paywall "Unlock with NFT" UX upgrade — inline wallet connect/sign (Phantom/EVM) on watch page + chain selector + "Sync & Check" (wallet sync + short polling) to reduce false negatives after transfers.

- ✅ Task 7: Analytics & Insights (MVP): realtime viewers, watch time, unique views, retention thresholds, audience by country, and A/B testing (title/thumbnail) with Studio dashboards.

- ✅ Task 8: Performance & Creator tools (MVP): next/image SmartImage wrapper + batch upload + SEO analyzer + tags suggestion endpoint.

- ✅ Task 9: Search & Discovery MVP: /search + /explore + /tag/[slug] + /category/[slug] + search suggestions endpoint.
- ✅ Task 10: Offline Mode (PWA) MVP: service worker + /offline + offline upload queue (IndexedDB) + SW register client component.
- ✅ Task 11: Creator monetization MVP: stars-based tips + notifications + creator revenue dashboard + creator webhooks outbox.
- ✅ Task 12: Gamification MVP: XP + levels + badges + daily tasks + leaderboard + idempotent XP events.
- ✅ Task 13: Video chapters: studio editor + public chapters API + display under player with seek.
- ✅ Task 14: Public API + creator webhooks + RSS feeds: /api/public/* + /rss.xml + /u/[id]/rss.xml + worker delivery.
- ✅ Task 15: Video editor + screen recording (phased MVP): trim job queued to worker + /studio/editor + /studio/record.

- ✅ Extra (v4.12.0): Growth Hacker Phase A — CTR tracking (card impressions/clicks) + Studio Analytics dashboards (creator + per-video).
- ✅ Extra (v4.12.1): Fix Next.js Server/Client boundary ở /boost (tách interactive sang Client Component).
- ✅ Extra (v4.13.0): Creator monetization v2 — Fan Club recurring billing (worker), Premium video paywall (membership/unlock), Creator monthly Goals progress bar.

A) Target Version
- target_version: v4.16.19

B) Ưu tiên (nếu có)
- priority_order: 1 → 2 → 3 → 4 → 5 → 6

C) Must-have features (liệt kê rõ)
1) chức năng làm mờ các video nhạy cảm như peertube ,( có thể tùy chọn hiển thị, làm mờ, hay ẩn video nhạy cảm trong admin và trang cá nhân user)
các video được làm mờ 
thêm chức năng xóa + ẩn + chỉ người đó xem được từng và toàn bộ video , bình luận (chỉ admin và chủ kênh , chủ video đó được làm)
cả chức năng chỉ cho người vi phạm xem nhưng không cho tương tác


2) thêm chức năng Premium và Premium+ ( thanh toán bằng sao, trong admin tùy chọn giá) có dấu tích xác nhận (có thể đúc video, bộ sưu tập làm avatar)
Premium chỉ thấy quảng cáo boots những quảng cáo khác sẽ không hiện ra
Premium+ có thể tùy chọn thấy quảng cáo boots hoặc không , có thể xem video riêng tư,
nổi bật khi bình luận và miễn phí boots 4 lần/ tháng
và nhiều quyền khác bổ sung thay.

3) thêm trang bài đăng chức năng và hiển thị như youtube
Các loại bài đăng:
Văn bản: Chia sẻ suy nghĩ, thông báo.
Hình ảnh/GIF: Minh họa cho nội dung.
Thăm dò ý kiến (Polls): Hỏi ý kiến người xem.
Video: Nhúng video YouTube khác.
Liên kết: Dẫn đến các trang web hoặc video khác. 
Nơi hiển thị:
Tab Cộng đồng trên kênh.
Trang chủ YouTube (trong mục "Bài đăng trên kênh").
Trang Đăng ký (Subscription Feed).
Trang Shorts của khán giả. 

4) và khi đúc nfts phải tốn chi phí là sao ( tùy chỉnh trong admin nhé) khi đúc nfts rồi video không sửa được tiêu đề , tag , nội dung thì sửa được nhé , tương lại nfts sẽ được lưu trữ lại
Mint fee Stars khi mint NFT cộng vào treasury/admin user để dàng cho các sự kiện khuyến mãi sau này
1. Phí nền tảng Khi bạn bán NFT trên chợ NFT sẽ phát sinh phí dịch vụ nền tảng cố định 1% trên giá bán. 2. Phí niêm yết Bạn không phải trả phí niêm yết NFT trên chợ NFT. 3. Phí bản quyền Mỗi khi một NFT được bán, một tỷ lệ phần trăm của giá bán (phí bản quyền) sẽ được trả cho người tạo NFT ban đầu và author video với tỷ lệ 20%-50%-80% (cái tuỳ chọn) tỷ lệ chia cho creator trong tổng royalty (phần còn lại cho author) nghĩa là Người bán cần trả phí bản quyền (0-10%) cho người tạo, theo phí bản quyền mà người tạo bộ sưu tập NFT quy định. Bạn có thể xem phí bản quyền trên mỗi trang thông tin NFT. Đối với các NFT được đúc trên hệ thồng, hệ thống sẽ áp dụng phí bản quyền giống nhau cho tất cả các NFT trong bộ sưu tập. Xin lưu ý, bạn chỉ có thể thiết lập tiền phí bản quyền trong quá trình tạo NFT. Phí này sẽ vẫn được tính mỗi khi NFTs được bán Đối với lần bán NFT Chưa xác minh đầu tiên (tức là lần đầu tiên một NFT Chưa xác minh mới đúc được người tạo bán cho người mua), 
người tạo sẽ bị hạn chế rút tiền thu được từ giao dịch trong 10 ngày. Sau khi NFT Chưa xác minh (được đúc trên thị trường hệ thống NFT) đã đáp ứng khoảng thời gian chờ thanh toán 10 ngày, nếu tài sản đã bán không cho thấy có khả năng vi phạm Quy tắc đúc NFT và Điều khoản dịch vụ của hệ thống, người tạo có thể sử dụng hoặc rút khoản tiền thu được. Thời hạn này có thể được điều chỉnh trong tương lai.

 50 Phí đúc bộ sưu tập ( gồm nhiều video ,bài đăng, mỗi video là 1 nft )
Mỗi bộ sưu tập NFT được yêu cầu trả một khoản phí đúc bộ sưu tập cố định, bao gồm phí triển khai hợp đồng thông minh và phí dịch vụ. Phí đúc bộ sưu tập được tính như dưới đây:
Giá Sao(hệ thống)/Polygon / solana = usdt= 1 bnb
Ethereum (ETH): 0,50 ETH
BNB Smart Chain (BSC): 1,00 BNB
Điều này nhằm ngăn chặn việc tạo các NFT chất lượng thấp và sử dụng sai tính năng này, đồng thời giải quyết phản hồi nhận được về tính năng đúc NFT từ cộng đồng của chúng tôi.

6)bạn có thể làm trang rút nft về ví cá nhân (on-chain) mà người trả phí gas và các phí khác là người dùng và mình tính lưu trữ nfts trên app.nft.storage/v1/docs/client/http-api hoặc docs.lighthouse.storage/ trước khi người rút được không ạ ưu tiên

Mình muốn mint on-chain ở chain Polygon / solana / BSC / ETH (có thể cho User chọn ) 
( NFT xuất on-chain cần “freeze marketplace nội bộ” ngay khi export pending , nhưng phải kết thúc đấu giá hoặc không đấu giá mới rút được, đang đấu gia không rút được nhé
 Metadata chứa video: Cho User lựa chọn ạ animation_url trỏ mp4/hls public URL (nhanh, nhẹ) = ít phí hơn hay upload video lên IPFS luôn (nặng, tốn phí, nhưng “chuẩn NFT” hơn) = phí cao hơn theo dung lượng video (màu sắc NFT đẹp hơn, sang trọng , quý phái hơn)

contract kiểu ERC721 + convert luôn sang “read-only mirror” (chỉ hiển thị owner on-chain) mặc định, có thể tuỳ chọn trong admin : NFT trong app vẫn tồn tại nhưng status EXPORTED (không trade nội bộ)

export contract “tokenId” là: Deterministic: tokenId = uint256(keccak256(abi.encodePacked("SRNFT:", chainid, nftId))) để tránh những lỗi “đụng format/namespace” và giúp phân biệt môi trường/version.

NFT export on-chain mình muốn deploy contract trước ở chain Polygon làm “primary”

Deploy sẵn contract :0xF6E5fEB76959f59c80023392386B997B068c27c6
và hoàn toàn có thể đổi contract sau này mà không làm hỏng NFTs đã rút, và đổi contract bằng Admin UI , nhưng phải sau 24h mới thực hiện , và thông báo cho admin , Log lại vào event log (ai đổi, lúc nào, đổi từ đâu sang đâu) để tránh bị hack ạ



D) Payments/Webhooks (nếu đụng tới)
- strict_allowlist_per_chain:
  - EVM: Alchemy/QuickNode
  - SOL: Helius/QuickNode
- providerAccuracyMode: true/false
- cron:
  - PAYMENTS_RECONCILE_EVERY_MS = 120000
  - PAYMENTS_SUBMITTED_STALE_MINUTES = 10 (nếu đổi phải ghi rõ)
- tolerance: PAYMENTS_TOLERANCE_BPS = 50 (0.5%)
- export CSV theo filter:
  - deposits/events/webhooks
- dashboards:
  - fail-rate multi-line theo chain
  - volume + total deposits
  - breakdown theo asset/provider
  - top failing reasons (24h)
  - top users causing failures
  - provider accuracy report

E) UI/UX (shadcn-like)
- pages_to_refactor:
  - /admin/payments...
  - /stars/topup (Wallet/Web3 Apps/Manual)
- wallet UX:
  - hiển thị “đang connect bằng ví nào”
  - auto-detect injected wallet type (MetaMask/OKX/BNB/Gate)
  - mobile deep-link mở đúng app theo WalletConnect wallet lists/redirect (nếu làm)

F) Output bắt buộc (DoD)
- ✅ Update: TASK_TEMPLATE_CONTINUE.md ( update các task đã làm và chưa làm)
- ✅ npm run build chạy OK (bao gồm tsc worker)
- ✅ npm test (nếu có test liên quan)
- ✅ Update: package.json version, CHANGELOG.md
- ✅ Update docs nếu có thay đổi: PROMPT_REBUILD_PROJECT.md / FEATURES_AI_MAP.md / PROJECT_CONTEXT.md / AI_REQUIREMENTS.md / docs nav
- ✅ ZIP source cuối cùng:
  - exclude: node_modules, .next, worker/dist
  - cung cấp link: sandbox:/...zip
- ✅ Ghi rõ “Cách chạy”:
  - docker compose up -d
  - prisma generate/push/seed
  - dev + worker:dev

---

## Post v4.10.0 enhancements (ngoài Task 1–15)
- ✅ Playlists/Collections: `/playlists`, `/p/[id]`, API `/api/playlists*`.
- ✅ Continue Watching + History: `GET /api/progress?videoId=...`, `/history`, resume in player.
- ✅ Comment pin/heart (owner/admin) via `/api/comments/moderate`.

## Post v4.10.0 enhancements (DONE)
- Search trending (Redis) + API /api/search/trending
- Notification settings page + API
- Comment reports + admin review page
- Creator Fan Club membership plans + join API


## Post v4.11.0 enhancements (Trust, safety & infra)
- ✅ Admin Stars ledger page + CSV export: `/admin/stars/transactions`, `GET /api/admin/stars/export/ledger`
- ✅ Ledger audit counters added to payments dashboard API: `GET /api/admin/payments/dashboard`
- ✅ Stars credit risk rules (daily cap / velocity / min gap) + NEEDS_REVIEW flow
- ✅ Payments worker `alert_cron` extended to alert on NEEDS_REVIEW spikes (Discord optional)
- ✅ Moderation queue pipeline for video/comment reports (worker notify/triage)
- ✅ CDN purge queue/job for route invalidation on publish/unpublish/thumbnail changes (Cloudflare optional)
- ✅ Search: MySQL FULLTEXT relevance fallback + Redis hot-query cache (60s)


---

## New wave (Jan 2026) — Creator growth / Viral / Trust & Safety

### ✅ Clip maker (share đoạn 15–60s) — DONE (MVP)
- Prisma: `Clip` + `ClipStatus`
- API: `POST /api/studio/clips/create` (enqueues `editor:create_clip`)
- Worker: `editor:create_clip` (ffmpeg trim + watermark) → R2 key immutable `clips/{clipId}/mp4/{buildId}.mp4`
- Page: `/clip/[id]`
- Watch page: UI tạo clip đơn giản (start/end/title)

### ✅ Membership / Fan Club (monthly) — DONE
DONE:
- Prisma: `CreatorMembershipPlan`, `CreatorMembership`, `CreatorMembershipInvoice`
- APIs: plans + join + billing renew/expire (worker repeatable)
- Badge cạnh tên theo tier (Bronze/Silver/Gold) trên watch + profile + comment UI
- Perks: emoji comment theo tier + early access gating (PUBLIC) theo `earlyAccessTier/earlyAccessUntil`

### ✅ Premium / Unlock video bằng Stars — DONE
- Prisma: `VideoAccess.PREMIUM`, `VideoUnlock`
- API: `POST /api/videos/[id]/unlock` (idempotent)
- Guard: `canViewVideoDb / canInteractWithVideoDb`
- Watch UI: Unlock/Join membership gate

### ✅ Report & Moderation pipeline — DONE
DONE:
- Report API: video/comment report
- Worker moderation job: notify ops (Discord) + admin review screens `/admin/reports/*`
- Admin can set report status (OPEN/REVIEWED/RESOLVED/REJECTED)
- Alias path `/admin/moderation/*` → moderation dashboard + links
- Admin actions: hide/unhide video/comment, strike, mute 7d, ban/unban (POST `/api/admin/moderation/actions`)
- Keyword filter per creator (`CreatorModerationSetting`), auto-hide comment on create

DONE (escalation):
- Auto mute/ban by strike thresholds + report velocity scan (OPEN reports) integrated into worker repeatable `payments:alert_cron`.

### ✅ Notification center nâng cấp + settings — DONE (core)
- `NotificationSetting` + `/settings/notifications`
- Inbox: `/notifications` + APIs `/api/me/notifications`, `/api/me/notifications/read`
- Worker weekly in-app digest (repeatable job `weekly_digest`)

DONE:
- Digest email (optional) via Resend (env-gated) + user toggle `WEEKLY_DIGEST_EMAIL`.

### ✅ Search nâng cao: autocomplete + trending queries — DONE
- API: `/api/search/suggest`, `/api/search/trending`
- Redis: `videoshare:search:trending:v1:{date}`

### ✅ Playlist nâng cấp: collaborative + series + cover — DONE
DONE:
- Prisma: `PlaylistCollaborator` (VIEWER/EDITOR) + `Playlist.coverKey`, `Playlist.isSeries/seriesSlug`.
- API: collaborators management, cover upload (immutable R2 keys), reorder endpoint.
- UI: playlist owner/editor controls (cover, collaborators, reorder), and Series landing pages (`/series`, `/series/[slug]`).

### ✅ Continue Watching nâng cấp: Up Next + auto-play — DONE
- Use `lib/videos/similar.ts` + playlist context to compute “Up Next”
- UI: endscreen autoplay + toggle setting


### 🧠 Ideas backlog (Jan 2026+) — TODO (gợi ý tăng viral/retention, triển khai theo phase + feature flags)

> Ghi chú: Các ý dưới đây **không phá contract Payments/Worker/Redis**; triển khai nên đi kèm Admin flags + ledger idempotency + rate-limit Redis.

#### HLS + Player (PeerTube vibe) + R2 A/B (2 domains) — NEW TODO (ưu tiên cao)

> Mục tiêu: Player mượt như PeerTube (ABR + stats + retry/failover), tận dụng **R2 primary + FTP mirror + R2 A/B** để giảm downtime, tăng cache hit.  
> Lưu ý: **tất cả phần nặng chạy Worker**, không chạy trong web request; các config nhạy cảm dùng **pending apply 24h + audit + notify admin** (giống Storage).

**Phase 1 — Player core (ROI cao, giống PeerTube nhất)**
- TODO: Tạo `components/player/VideoPlayerClient.tsx` (`"use client"`) dùng **hls.js** attach `<video>`.
- DONE (v4.16.16): **Quality selector + Auto** (theo ladder manifest; chọn theo `height`) + switch không reload trang.
- DONE (v4.16.16): Persist lựa chọn quality (localStorage key `videoshare:player:quality:v1`).
- DONE (v4.16.16): “Stats for nerds” overlay: origin, rendition, bandwidth estimate, buffer, dropped frames.
- DONE (v4.16.16): Retry/backoff khi network error; fatal → switch origin (R2 A ↔ R2 B ↔ FTP HLS).
- DONE (v4.16.16): Banner nhẹ khi đang phát từ origin khác primary.

**Server resolver (candidates)**
- DONE (v4.16.16): `lib/playback/resolveStream.ts` trả về candidates (R2 A/B + FTP HLS) theo ưu tiên.
  1) R2 A (primary)
  2) R2 B (secondary)
  3) FTP HLS (mirror)
- DONE (v4.16.16): Reorder theo `VideoAsset.healthStatus` để ưu tiên FTP khi DEGRADED/DOWN.

**Phase 2 — Tối ưu cache HLS trên Cloudflare/R2**
- DONE (v4.16.16): Header strategy (worker upload):
  - Segments (`.ts`, `.m4s`, `init.mp4`): `Cache-Control: public, max-age=31536000, immutable`
  - Playlists (`master.m3u8`, `index.m3u8`): `Cache-Control: public, max-age=30, stale-while-revalidate=60` (tuning)
- DONE (v4.16.17): Playlist rewrite (loader) để absolute URLs theo base đang dùng (A/B/FTP) → giảm mixed-origin issues.
- DONE (v4.16.17): Optional prefetch “next 1–2 segments” (rate-limited, không aggressive).
- DONE (v4.16.17): Admin config (pending apply 24h): `R2_PUBLIC_BASE_URL_A`, `R2_PUBLIC_BASE_URL_B`, `R2_AB_SPLIT_PERCENT` (DB override; fallback env).

**Phase 3 — P2P segments (optional, chỉ PUBLIC/trending)**
- PARTIAL (v4.16.18): Admin flag `playerP2PEnabled` (default OFF) đã thêm vào SiteConfig + /admin/config. (PUBLIC only). P2P loader integration cần dependency `p2p-media-loader-hlsjs` và sẽ làm ở phase tiếp.
- TODO: Integrate `p2p-media-loader-hlsjs` (PeerTube ecosystem) vào hls.js loader.
- TODO: Metrics: % segments from P2P vs HTTP, error rates, average startup time.

**UX “PeerTube-ish”**
- DONE (v4.16.18): Theater mode + mini-player + PiP.
- PARTIAL (v4.16.18): Hotkeys (J/K/L, arrows, F, M) — DONE. Chapters/subtitles selector giữ như hiện tại.
- DONE (v4.16.17): Error overlay có nút “Try another mirror”.

**Acceptance criteria**
- Player switch quality mượt, không reload trang; có Auto + manual.
- Khi origin chết: tự retry/backoff rồi chuyển nguồn (A→B→FTP) và phát tiếp.
- Có stats overlay (tối thiểu: rendition, buffer, origin).
- Cache headers đúng cho segments vs playlists; keys immutable/ versioned.

#### Monetization / Growth loops
- TODO: **Season Pass (30 ngày)** bằng Stars + áp dụng discount nếu holder **Creator Pass NFT** (ledger: `discountReason=SEASON_PASS|NFT_PASS`).
- TODO: **Referral Stars** (mời bạn bè) + anti-fraud (first deposit only, velocity caps, device signals nhẹ, Redis rate-limit).
- TODO: **Gift Stars / Gift Unlock** (tặng Stars hoặc tặng mở khóa video/series cho user khác) + idempotent `giftId`.
- TODO: **Bundle Unlock cho series/playlist** (mua theo gói) + discount theo Pass/NFT.
- TODO: **Limited-time Coupons** (creator tự tạo mã giảm giá Stars trong 24–72h, giới hạn lượt) + ledger `discountReason=COUPON`.
- TODO: **Tipping Goals + progress bar** (milestones) + notify khi đạt.

#### Engagement / Retention
- TODO: **Watch-to-Earn XP** (không token) + leaderboard tuần + cosmetic perks (frame/flair/emoji pack).
- TODO: **Daily Claim / Daily Spin** (Stars/XP nhỏ) + anti-farm (watch minimum + rate-limit).
- TODO: **Fan Levels** (Bronze→Legend) dựa trên Stars spent + streak + badges; perks: comment highlight, priority reply.
- ✅ DONE (v4.16.20): **Watch Later / History thông minh**: resume giây (v4.16.19) + “continue watching” digest (in-app, daily, optional).
- TODO: **Creator Drops**: limited unlock window + FOMO (24h, giới hạn số unlock, early access cho holder).

#### NFT / Social prestige
- ✅ DONE (v4.16.20): **Share Cards full**: OG images cho video/clip/creator (`/api/og/video/[id]`, `/api/og/clip/[id]`, `/api/og/creator/[id]`).
- TODO: **Comment Highlights**: creator pin + “Pinned by Creator” badge NFT (non-transferable hoặc low-value).
- TODO: **Collab Pass**: video collab unlock nếu holder pass của creator A **OR** B (VideoNftGate hỗ trợ OR rules).
- TODO: **Creator Store**: bán digital items bằng Stars (emoji pack, profile frames, shoutout request).

#### Discovery / Product
- TODO: **Smart Similar v2**: boost theo completion, same creator, freshness; cache tầng (Redis) + fallbacks.
- TODO: **Onboarding funnel tối ưu**: chọn chủ đề + follow creators + trial Stars (feature-flagged).
- TODO: **Scheduled posts/premieres** + calendar reminders + premiere chat “mini live”.
- TODO: **UGC Remix/Duet/Stitch** (opt-in) + Stars split/attribution vào ledger.
- TODO: **Subtitles auto-translate** (worker) + SEO boost (index captions).

#### Trust & Safety / Fraud
- ✅ DONE (v4.16.22): **Fraud Radar** (Admin) cho Payments: `/admin/payments/fraud` + alerts (OPEN/ACKED/RESOLVED) + signals (dup txHash, submit rate-limit, large manual credit, webhook fail spike, NEEDS_REVIEW burst) + worker `payments:alert_cron` mở rộng.
- TODO: **Auto moderation** (heuristics) + throttle new account + admin flagged queue.
- TODO: **Account security**: new device alert, step-up auth cho actions nhạy cảm (withdraw, link wallet, gifts).
- TODO: **Invisible watermark** trên clip export để trace leak + anti-reupload signals.
- TODO: **Trust score** cho wallet/transactions (risk tier) để gate limits (topup, withdraw, gifts, referrals).

#### Creator Pro / Tooling
- TODO: **Content Radar** (creator analytics + alerts): clip viral, NFT listing sales, source traffic.
- TODO: **Data export** cho creator (CSV/API keys) + audit logs (admin).
- TODO: **A/B pricing experiments** cho paywall/unlock (guardrails + privacy).
- TODO: **AI highlight detector** (worker) gợi ý đoạn 15–60s để tạo clip nhanh (opt-in).
- TODO: **Collab revenue split tracking** (ledger templates) cho series collab + minh bạch doanh thu.
- TODO: **Supporter CRM-lite**: export “top fans” + tags + gửi “drops/coupons” mục tiêu (in-app notifications).

