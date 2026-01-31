# AI_REQUIREMENTS.md — Checklist yêu cầu dự án VideoShare (Next.js App Router)

**Current version:** v4.16.24

> File này là checklist/contract (không phải progress). Trạng thái DONE/TODO xem `TASK_TEMPLATE_CONTINUE.md`.

## 0) Bổ sung v4.16.x (không phá contract cũ)

### Storage redundancy (R2 + FTP + Drive)
- R2 vẫn là primary. Các endpoint backup/mirror là optional.
- Mọi thay đổi storage config phải:
  - **pending apply sau 24h**
  - audit log + notify admins
- Heavy work (mirror/rebuild/health scan) chạy **worker queue `storage`**, không chạy trong web request.

### HLS packaging (Admin `/admin/hls`)
- Admin chọn 1 trong 3 mode: TS / fMP4 / Hybrid.
- Encode luôn chạy trong worker (`worker/src/jobs/encodeHls.ts`).
- HLS public assets phải **immutable** (đổi encodeId/buildId thay vì overwrite).

### Growth / ARPU (v4.16.23+)
- **Season Pass 30d** mua bằng Stars:
  - Purchase phải ghi rõ `priceStarsOriginal`, `discountStars`, `priceStarsFinal`, `discountReason`.
  - Ledger type: `SEASON_PASS_PURCHASE` (idempotent per purchase).
- **Referral Stars** (1–20% admin-config):
  - Bonus áp dụng cho TOPUP và các nguồn EARN (tip, membership, marketplace, ads/rewards nếu có) bằng helper `applyReferralBonusTx`.
  - Idempotency: `ReferralBonus` unique `(sourceKind, sourceId)`.
- **Bundles / Coupons**:
  - Topup credit tạo ledger tách riêng: `TOPUP` + `BUNDLE_BONUS` + `COUPON_BONUS` (idempotent theo `(depositId,type)`).
  - Coupon validation phải enforce window + active + redemption limits; redemption record là nguồn truth.
  - Admin pages/APIs phải guard: `/admin/payments/bundles`, `/admin/payments/coupons`.

### Trust & Safety (v4.16.22+)
- Fraud Radar (Admin) for Payments: `/admin/payments/fraud` + `FraudAlert` triage; signals generated in API + worker scans.
- Moderation escalation scan (auto mute/ban) chạy best-effort trong repeatable `payments:alert_cron`.
- Weekly digest:
  - in-app notification type `WEEKLY_DIGEST`
  - optional email qua Resend, env-gated, có user toggle `WEEKLY_DIGEST_EMAIL`.

### Contracts & release hygiene
- Không đổi routes/jobs/Redis keys trong `CONTRACT_CHECKLIST.md`.
- Trước khi release: chạy `bash scripts/contract-check.sh`.
- Hoàn tất task: bump version + update `CHANGELOG.md` + sync docs core (root + `/docs`) + export ZIP slim.

---

## 1) Non‑negotiables (không được phá)

### 1.1 Stack & kiến trúc
- Next.js **App Router** (`app/`), TypeScript.
- Database: **MySQL + Prisma** (`prisma/schema.prisma`).
- Auth: **NextAuth** (role `ADMIN`/`USER`). Admin pages + admin API bắt buộc kiểm tra quyền.
- Queue/worker: **Redis + BullMQ**; các tác vụ nặng (ffmpeg, reconcile payments) chạy trong **`/worker`**, không chạy trong request web.
- Storage video: **Cloudflare R2** (S3-compatible). Tối ưu cache/CDN để giảm **R2 Class A/B operations**.
- UI: **Tailwind** + bộ components “shadcn-like” (`components/ui/*`).

### 1.2 Quality gates
- Phải chạy được: `npm run build` (bao gồm build worker: `tsc -p worker/tsconfig.json`).
- Không được phá API/route đang dùng bởi UI trừ khi có migration + update toàn bộ call-site.
- Đảm bảo idempotency cho payments: cùng txHash / signature không được credit 2 lần.
- Không lưu secrets trong client bundle (chỉ server env).



### 1.2.1 Packaging deliverables
- Mỗi lần release/hand-off phải có **2 bản ZIP**:
  - **Slim**: không kèm `node_modules/`, `.next/`, `worker/dist/`.
  - **Full**: có kèm `node_modules/`, `.next/`, `worker/dist/` (build xong mới zip).
- Scripts: `npm run package:slim` và `npm run package:full` (xem `docs/QUICKSTART.md`).
- Khuyến nghị: tạo/commit `package-lock.json` để deploy ổn định (CI nên dùng `npm ci`).
### 1.3 Security (đặc biệt quan trọng cho payments/webhooks)
- Webhooks phải có:
  - **Signature verification** (khi provider hỗ trợ).
  - **Rate-limit** theo IP/provider.
  - **Dedupe** theo hash payload (tránh spam/duplicate delivery).
  - **Strict allowlist theo chain/endpoint** (ví dụ EVM chỉ nhận Alchemy/QuickNode; SOL chỉ nhận Helius/QuickNode).
- Admin actions (credit/refund/assign user) phải bắt buộc role ADMIN.

---

## 2) Feature checklist (đầy đủ)

### 2.1 Public / User
- [ ] Home feed (YouTube-ish / TikTok-ish)
- [ ] Search video (full-text, UI modern)
- [ ] Watch page `/v/[id]`
- [ ] “Similar videos” nâng cao (tags + category + full-text ranking + loại trừ video hiện tại + ưu tiên cùng kênh)
- [ ] Watch history
- [ ] Watch later
- [ ] Login/Logout + profile
- [ ] PWA (offline shell, không cache video)
- [ ] SEO (sitemap, robots, OG tags, JSON-LD, llms.txt nếu có)
- [ ] Sensitive videos (PeerTube-like): viewer mode SHOW/BLUR/HIDE, gate ở watch page, OG blur
- [ ] Ads targeting: placement có thể ẩn bot/desktop (mặc định chỉ mobile/tablet)

### 2.2 Upload / Processing
- [ ] Upload video (R2 multipart)
- [ ] Update thumbnail (upload hoặc URL)
- [ ] Worker ffmpeg tạo: thumbnail/preview
- [ ] Worker ffmpeg encode HLS adaptive (ladder theo admin checkbox), ưu tiên **SINGLE_FILE/byterange**
- [ ] R2 object keys versioned + header Cache-Control phù hợp (giảm Class A/B)

### 2.3 Similar Videos + Cache
- [ ] Cache Redis theo videoId: `videoshare:similar:v1:{videoId}`
- [ ] Reverse-index để **fan-out invalidation**:
  - `videoshare:similar:index:v1:child:{childId}` (SET parentIds)
  - Khi update tags/category/title -> invalidate cache của video + fan-out invalidate các parent liên quan
- [ ] TTL cache (mặc định 15 phút) và fallback nếu Redis lỗi

### 2.4 Admin
- [ ] `/admin/videos` list + filters
- [ ] `/admin/videos/[id]` edit metadata (title/desc/category/tags) + publish/hide/delete/requeue
- [ ] `/admin/config` (site info/SEO/analytics code)
- [ ] `/admin/reports` (Recharts charts)
- [ ] `/admin/docs` (docs index dạng website)
- [ ] `/admin/boost/*` theo design system UI
- [ ] `/admin/ads` (ad placements config + targeting device/bot; placements global top/bottom)
- [ ] Sensitive videos config: toggle `Video.isSensitive` ở `/admin/videos/[id]` + default mode ở `/admin/config`

### 2.5 Payments / Stars (Topup)
- [ ] `/stars/topup` có tabs:
  - **Wallet** (connect & send tx ngay trong page)
  - **Web3 Apps** (deep-link mở đúng app OKX/Gate/BNB/MetaMask trên mobile theo WalletConnect redirect/wallet lists)
  - **Manual** (submit txHash)
- [ ] Solana UX: wallet-adapter connect + sendTransaction + SPL transfer + ATA auto-create + memo depositId
- [ ] EVM UX: injected wallets (MetaMask/OKX/BNB/Gate) + detect wallet type + hiển thị rõ “đang connect bằng ví nào”
- [ ] Custodial addresses theo chain/token (admin CRUD)
- [ ] Deposit history + deposit detail (link explorer theo chain)
- [ ] Auto reconcile (BullMQ cron): **2 phút**
- [ ] “SUBMITTED > X phút” (default **10**) -> auto re-verify
- [ ] Webhook ingest native payload (Alchemy/QuickNode/Helius) + audit log + dead-letter retry
- [ ] Admin payments dashboard:
  - charts fail-rate/time series (multi-line theo chain)
  - charts volume + total deposits
  - filters theo thời gian/chain/asset/provider
  - breakdown theo chain/asset/provider
  - top failing reasons 24h
  - top users causing failures
  - export CSV theo filter (deposits/events/webhooks)
- [ ] Manual admin actions: assign user (UNMATCHED inbox), manual credit, refund
- [ ] Discord alerts: fail-rate 15m + spike detection

---

## 3) Data model requirements (tối thiểu phải có)

### 3.1 Video
- User
- Video (title, description, channelName, categoryId, published, r2Keys, hlsEncodeId/buildId, `isSensitive`...)
- Category
- Tag + VideoTag (many-to-many)
- WatchHistory
- WatchLater

### 3.1.1 Sensitive videos (PeerTube-like)
- `Video.isSensitive` flag (không ảnh hưởng SEO/indexing mặc định).
- Viewer preference `User.sensitiveMode` (SHOW/BLUR/HIDE) + site default `SiteConfig.sensitiveDefaultMode`.

### 3.1.2 Video password gate (HTTP 401)
- `Video.accessPasswordHash/accessPasswordHint`.
- Khi có password: trang watch `/v/[id]` phải trả **401 Unauthorized** cho viewer chưa unlock (không dùng 404).
- Owner/admin bypass.
- Unlock flow dùng **form POST** (không onClick/onSubmit trong Server Component) tới `POST /api/videos/[id]/unlock` và set HttpOnly signed cookie scoped theo video.

### 3.1.3 Ads targeting (device/bot)
- `AdPlacement.showOnMobile/showOnTablet/showOnDesktop/hideForBots`.
- Global banner scopes: `GLOBAL_TOP` + `GLOBAL_BOTTOM`.

### 3.2 Payments
- Token (chain, symbol, decimals, contractAddress nếu SPL/ERC20/TRC20)
- CustodialAddress (chain, token, address, memo/tag nếu chain cần)
- StarTopupPackage (token, expectedAmount, stars)
- StarDeposit (userId nullable, chain/token, toAddress, expected/actual, status, txHash/signature, failureReason, provider)
- StarDepositEvent (depositId, type, dataJson, createdAt)
- WebhookAuditLog (provider, status, sha256, headersJson, payloadJson, ip, depositId nullable)
- PaymentConfig (strictMode, providerAccuracyMode, toleranceBps, submittedStaleMinutes, reconcileEveryMs, allowlistJson)
- PaymentProviderSecret (env, provider, name, value, active)

### 3.3 Notifications (groundwork từ v4.4.0)
- `NotificationType` enum (COMMENT_REPLY, VIDEO_LIKE, VIDEO_COMMENT, NEW_SUBSCRIBER, STAR_GIFT, MENTION, SYSTEM; reserve: NFT_PURCHASED, NFT_AUCTION_BID).
- `Notification` model:
  - `userId` (người nhận)
  - `actorUserId` (ai gây ra)
  - `type`, `title`, `body`, `url`, `dataJson`
  - `isRead`, `createdAt`
- **Ghi chú:** snapshot v4.4.0 tập trung vào schema + docs; UI/API notifications có thể implement ở phiên bản tiếp theo.

---

## 4) Contracts & endpoints (không tự ý đổi)

### 4.1 Similar
- `lib/videos/similar.ts` phải expose function lấy similar theo videoId.
- Cache/invalidate nằm trong `lib/videos/similarCache.ts`.

### 4.2 Stars topup
- `POST /api/stars/topup/intent`
- `POST /api/stars/topup/submit-tx`
- `GET  /api/stars/topup/history`
- `POST /api/stars/topup/retry`

### 4.3 Webhooks
- `POST /api/webhooks/helius`
- `POST /api/webhooks/alchemy`
- `POST /api/webhooks/quicknode`
- (tuỳ chọn) `POST /api/webhooks/trongrid`

### 4.4 Admin payments
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

### 4.5 NFT (internal) + export (new in v4.5.0/v4.6.0/v4.6.1/v4.6.2)
- User pages:
  - `/nft/market`, `/nft/items/[id]`, `/nft/exports`
- Internal marketplace APIs:
  - Listings: `POST /api/nft/listings/create`, `POST /api/nft/listings/[id]/cancel`, `POST /api/nft/listings/[id]/buy`
  - Auctions: `POST /api/nft/auctions/create`, `POST /api/nft/auctions/[id]/bid`, `POST /api/nft/auctions/[id]/cancel`, `POST /api/nft/auctions/[id]/settle`
- Export foundation:
  - `POST /api/nft/export/request`
  - `POST /api/nft/export/submit-tx`
  - Verify support:
    - EVM: Transfer event by txHash
    - SOLANA (beta): txHash + user-provided `mintAddress` (token balance delta)
    - TRON (beta): Transfer event via TronGrid events API
- Admin NFT:
  - Pages: `/admin/nft/contracts`, `/admin/nft/events`
  - API: `GET/POST /api/admin/nft/contracts`

Queue/worker:
- Queue name: `nft`
- Jobs: `nft_export_prepare`, `nft_export_verify_tx`

---

## 5) Definition of Done cho mỗi lần update phiên bản
- [ ] Bump `package.json version`.
- [ ] Update `CHANGELOG.md` (tóm tắt change + breaking change nếu có).
- [ ] Update `.env.example` + `docs/ENV.md` nếu có env mới.
- [ ] Update `PROJECT_CONTEXT.md` (nếu thêm pages/flows/jobs).
- [ ] Update `PROMPT_REBUILD_PROJECT.md` (nếu kiến trúc thay đổi đáng kể).
- [ ] Update docs site: `docs/README.md`, `docs/QUICKSTART.md`, `docs/docs.nav.json` (nếu có docs mới)
- [ ] (Nếu deploy) update `docs/AAPANEL_DEPLOY.md` để có hướng dẫn production rõ ràng
- [ ] Run: `npm test` và `npm run build`.
- [ ] Zip lại source (không kèm `node_modules`, `.next`, `worker/dist`).


### v4.10.0 Contracts (Retention & Community)
- Pages: `/playlists`, `/p/[id]`, `/history`.
- APIs: `GET/POST /api/playlists`, `GET/PATCH/DELETE /api/playlists/[id]`, `POST/DELETE /api/playlists/[id]/items`, `GET /api/progress?videoId=...`.
- Comment moderation: `/api/comments/moderate` hỗ trợ thêm actions `PIN/UNPIN/HEART/UNHEART` (owner/admin).
- Không thay đổi contracts Payments/Stars topup/Similar/Webhooks providers.

## v4.10.0 requirements notes
- Search trending must be best-effort and never block /api/search
- Notification settings must be respected when creating notifications
- Comment reports must be admin-guarded for review endpoints/pages
- Creator membership join must be idempotent (userId + idempotencyKey)


## Storage config safety (anti-hack)
- Mọi thay đổi storage endpoints/secrets phải:
  - set pending và chỉ apply sau 24h
  - notify admin (SYSTEM) ghi rõ actor, from → to, applyAt
  - log event (ai đổi, lúc nào, from → to)

## Performance rules
- Không HEAD/verify trong watch request path.
- Health check + rebuild phải chạy trong worker (queue `storage`).
