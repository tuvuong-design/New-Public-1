# ADMIN_UI.md — v4.16.6

## v4.15.0 — Growth Hacker Phase A
- CTR tracking: `POST /api/analytics/events` (CARD_IMPRESSION/CARD_CLICK) → queue `analytics`.
- Studio Analytics: `/studio/analytics`, per-video: `/studio/videos/[id]/analytics`.

Mục tiêu: liệt kê nhanh **admin pages + admin APIs** theo đúng contract, và file path tương ứng.

## Guard rules
- Admin pages: `app/admin/*` (server components). Guard bằng role `ADMIN`.
- Admin APIs: `app/api/admin/*`. Guard bằng role `ADMIN` (xem `lib/authz.ts`).
- Không đổi routes/contracts nếu không có migration + update toàn call-sites.

## Pages (Admin)
### Payments (contract)
- `/admin/payments` → `app/admin/payments/page.tsx`
- `/admin/payments/deposits` → `app/admin/payments/deposits/page.tsx`
- `/admin/payments/deposits/[id]` → `app/admin/payments/deposits/[id]/page.tsx`
- `/admin/payments/unmatched` → `app/admin/payments/unmatched/page.tsx`
- `/admin/payments/events` → `app/admin/payments/events/page.tsx`
- `/admin/payments/webhooks` → `app/admin/payments/webhooks/page.tsx`
- `/admin/payments/config` → `app/admin/payments/config/page.tsx`

### Videos / Moderation
- `/admin/videos` → `app/admin/videos/page.tsx`
- `/admin/videos/[id]` → `app/admin/videos/[id]/page.tsx`



**NFT gated + Clip as NFT (Admin config)**
- `/admin/config` (form `POST /api/admin/site-config`)
  - `SiteConfig.clipNftMarketplaceMode`: Option 1/2/BOTH (tracking only / marketplace only / both).
  - `SiteConfig.clipNftOnChainMintEnabled`: bật mint NFT thật on-chain (Solana) cho Clip; worker chạy `nft:clip_mint_nft` (cần `SOLANA_NFT_MINT_ENABLED=true` + `SOLANA_MINT_AUTHORITY_SECRET_JSON`).
### Site config / Ads
- `/admin/config` → `app/admin/config/page.tsx`
- `/admin/ads` → `app/admin/ads/page.tsx`

### Docs
- `/admin/docs` → `app/admin/docs/page.tsx` + `docs/docs.nav.json`

### Storage (R2 + FTP + Drive)
- `/admin/storage` → `app/admin/storage/page.tsx` (set pending + apply/cancel, verify)
- `/admin/storage/events` → `app/admin/storage/events/page.tsx` (audit feed)

### NFT (admin)
- `/admin/nft/contracts` → `app/admin/nft/contracts/page.tsx`
- `/admin/nft/events` → `app/admin/nft/events/page.tsx`

Ghi chú bảo mật:
- Đổi contract theo chain được thực hiện theo 2 bước: **Set pending** → đợi **delay** (`SiteConfig.nftExportContractChangeDelayHours`, default 24h) → **Apply pending (if due)**.
- Mỗi lần set/apply sẽ:
  - tạo **SYSTEM notifications** cho tất cả admin
  - ghi **NftEventLog** (ai đổi, lúc nào, đổi từ đâu sang đâu)
- NFTs đã export không bị hỏng khi đổi contract: mỗi `NftExportRequest` lưu `contractAddress` tại thời điểm rút.

## APIs (Admin)
### Payments (contract)
- `GET /api/admin/payments/dashboard` → `app/api/admin/payments/dashboard/route.ts`
- `GET /api/admin/payments/export/deposits` → `app/api/admin/payments/export/deposits/route.ts`
- `GET /api/admin/payments/export/events` → `app/api/admin/payments/export/events/route.ts`
- `GET /api/admin/payments/export/webhooks` → `app/api/admin/payments/export/webhooks/route.ts`
- `GET/POST /api/admin/payments/config` → `app/api/admin/payments/config/route.ts`
- `GET/POST /api/admin/payments/secrets` → `app/api/admin/payments/secrets/route.ts`
- `POST /api/admin/payments/deposits/assign-user` → `app/api/admin/payments/deposits/assign-user/route.ts`
- `POST /api/admin/payments/deposits/reconcile` → `app/api/admin/payments/deposits/reconcile/route.ts`
- `POST /api/admin/payments/deposits/manual-credit` → `app/api/admin/payments/deposits/manual-credit/route.ts`
- `POST /api/admin/payments/deposits/refund` → `app/api/admin/payments/deposits/refund/route.ts`



**NFT gated + Clip as NFT (Admin config)**
- `/admin/config` (form `POST /api/admin/site-config`)
  - `SiteConfig.clipNftMarketplaceMode`: Option 1/2/BOTH (tracking only / marketplace only / both).
  - `SiteConfig.clipNftOnChainMintEnabled`: bật mint NFT thật on-chain (Solana) cho Clip; worker chạy `nft:clip_mint_nft` (cần `SOLANA_NFT_MINT_ENABLED=true` + `SOLANA_MINT_AUTHORITY_SECRET_JSON`).
### Site config / Ads
- `GET/POST /api/admin/site-config` → `app/api/admin/site-config/route.ts`
- `GET/POST /api/admin/ad-placement` → `app/api/admin/ad-placement/route.ts`

### Storage (R2 + FTP + Drive)
- `POST /api/admin/storage/config` → `app/api/admin/storage/config/route.ts` (set pending / apply / cancel)
- `POST /api/admin/storage/ftp/verify` → `app/api/admin/storage/ftp/verify/route.ts`
- `POST /api/admin/storage/ftp/test-upload` → `app/api/admin/storage/ftp/test-upload/route.ts`
- `POST /api/admin/storage/drive/verify` → `app/api/admin/storage/drive/verify/route.ts`

### Videos admin actions
- Update metadata/sensitive flags: `app/api/admin/videos/update-metadata/route.ts`
- Password gate (admin/owner): `app/api/videos/[id]/password/route.ts`

### Moderation admin actions
- `POST /api/admin/moderation/actions` → `app/api/admin/moderation/actions/route.ts`

### NFT admin actions
- `GET/POST /api/admin/nft/contracts` → `app/api/admin/nft/contracts/route.ts`

## Worker: Payments queue (BullMQ)
Queue: `payments`
- `process_webhook_audit`
- `reconcile_deposit`
- `reconcile_stale_scan` (repeatable)
- `retry_dead_letters_scan` (repeatable)
- `alert_cron` (repeatable)

Handlers: `worker/src/jobs/payments/*`

## Worker: NFT queue (BullMQ)
Queue: `nft`
- `nft_export_prepare`
- `nft_export_verify_tx`

Handlers: `worker/src/jobs/nft/*`


## v4.11.0 additions
- Stars ledger: `/admin/stars/transactions` filters + export.
- Payments dashboard: ledger-audit counters.
- Reports: video/comment reports enqueue moderation review queue (worker).
- CDN smart purge: background purge jobs on video publish/hide/delete/update.

## v4.10.0 additions
- Comment reports: `/admin/reports/comments`.
- Fan Club (creator membership) studio page: `/studio/membership`.
- Notification settings page: `/settings/notifications`.