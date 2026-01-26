# Environment Variables

File mẫu: **.env.example**

## Core
- `SITE_URL` — domain public (SEO, canonical, sitemap)
- `NEXTAUTH_URL` — URL cho NextAuth
- `AUTH_SECRET` — secret cho NextAuth/JWT
- `NODE_ENV` — `development` | `production`

## Database (MySQL)
- `DATABASE_URL` — dạng:
  - `mysql://user:pass@host:3306/db`

## Queue (Redis)
- `REDIS_URL` — ví dụ: `redis://127.0.0.1:6379`

## Redis cache
- `SIMILAR_CACHE_TTL_SECONDS` — TTL cache "similar videos" (mặc định 900 = 15m)
- `SIMILAR_CACHE_MAX_ITEMS` — số lượng items tối đa cache mỗi videoId (mặc định 50)

## Payments / Stars topup

- `APP_ENV` — `dev` | `prod` (mặc định `dev`)
- `PAYMENTS_RECONCILE_EVERY_MS` — chu kỳ cron reconcile (mặc định `120000` = 2 phút)
- `PAYMENTS_SUBMITTED_STALE_MINUTES` — mốc "SUBMITTED > X phút" (mặc định `10`)
  - Nếu deposit đang ở trạng thái **SUBMITTED** mà quá mốc này, worker sẽ tự enqueue job reconcile để kiểm tra lại.
- `PAYMENTS_TOLERANCE_BPS` — sai số chấp nhận theo bps (mặc định `50` = 0.5%)

RPC & provider secrets (tuỳ chọn):
- `SOLANA_RPC_URL`
- `SOLANA_NFT_MINT_ENABLED` — `true` để cho phép mint Clip NFT on-chain (mặc định `false`).
- `SOLANA_MINT_AUTHORITY_SECRET_JSON` — secret key JSON array cho Solana Keypair (mint authority) dùng để ký giao dịch mint.
  - Ví dụ: `[1,2,3,...]` (64 bytes)
  - Cần bật `clipNftOnChainMintEnabled` trong `/admin/config` để kích hoạt flow.
- `EVM_RPC_URL_ETHEREUM`, `EVM_RPC_URL_POLYGON`, `EVM_RPC_URL_BSC`, `EVM_RPC_URL_BASE`
- `ALCHEMY_WEBHOOK_SIGNING_KEY`, `QUICKNODE_WEBHOOK_SECRET`, `HELIUS_WEBHOOK_SECRET`
- `TRONGRID_API_URL`, `TRONGRID_API_KEY`
- `DISCORD_ALERT_WEBHOOK_URL`

## NFT / IPFS export (optional)
IPFS metadata upload chạy trong worker (queue `nft`). Nếu không cấu hình, export request vẫn tạo được nhưng sẽ FAIL ở bước prepare.

- `NFT_STORAGE_PROVIDER` — `NFT_STORAGE` | `LIGHTHOUSE` (hiện worker support nft.storage upload metadata).
- `NFT_STORAGE_API_KEY` — API key cho nft.storage (bắt buộc nếu dùng provider NFT_STORAGE).
- `LIGHTHOUSE_API_KEY` — reserved (chưa implement upload ở worker).
- `IPFS_GATEWAY_BASE_URL` — base URL để render `ipfs://CID` (mặc định `https://ipfs.io/ipfs`).

Export contracts (seed defaults Polygon primary):
- `NFT_POLYGON_PRIMARY_CONTRACT_ADDRESS` — override seed Polygon primary export contract.
- `NFT_ETHEREUM_CONTRACT_ADDRESS`, `NFT_BSC_CONTRACT_ADDRESS`, `NFT_BASE_CONTRACT_ADDRESS` — optional.

EVM RPC URLs (`EVM_RPC_URL_*`) vẫn dùng chung với payments và cũng dùng cho export verify tx receipt.

## Upload limits
- `UPLOAD_MAX_BYTES` — size max file upload (default 2GB)
- `UPLOAD_PART_BYTES` — chunk size cho multipart upload (default 200MB)

## Cloudflare R2 (S3)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` — CDN/public base URL để render thumb/HLS

## Optional toggles
- `NEXT_PUBLIC_ENABLE_PWA` — bật PWA manifest/service worker
- `INDEXNOW_ENABLED`, `INDEXNOW_KEY`, `INDEXNOW_KEY_LOCATION`
- `GA_ENABLED`, `GA_ID`
- `ONESIGNAL_ENABLED`, `ONESIGNAL_APP_ID`, `ONESIGNAL_SAFARI_WEB_ID`
- `SUBTITLES_AUTO_ENABLED`, `OPENAI_API_KEY`, `OPENAI_TRANSCRIBE_MODEL`
- `CLAMAV_ENABLED`, `CLAMAV_HOST`, `CLAMAV_PORT`

## External sync (ApiSource seed) (optional)
- `SEED_PEERTUBE_OWNER_EMAIL` — nếu set, worker sync sẽ gán các video đồng bộ (prefix `peertube3`) cho user này (để “chủ kênh” có thể xoá video trong UI).
- `SEED_ZONE3S_OWNER_EMAIL` — tương tự cho nguồn `zone3s`.

## Video password gate
- `AUTH_SECRET` cũng được dùng để ký cookie unlock video (HttpOnly) cho password gate.

## Install Wizard
- `INSTALL_WIZARD_ENABLED` — bật cho phép truy cập `/install` ngay cả khi env đã configured.


### FFMPEG_FONT_PATH (worker)
Path to a TTF font file used by ffmpeg `drawtext` for clip watermarking. Default: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`.

## Notifications
- `NOTIFICATIONS_WEEKLY_DIGEST_EVERY_MS` (worker): interval chạy job weekly digest (default 86400000). Digest chỉ tạo vào Monday morning (Asia/Ho_Chi_Minh).

## Storage redundancy (R2 + FTP + Google Drive)

These features store secrets in DB encrypted at-rest.

Required:
- `APP_ENCRYPTION_KEY` (32 bytes): used to encrypt Storage secrets (FTP passwords, Google Drive service account JSON).
  - Provide either 64-hex, base64 (>=32 bytes), or any long passphrase (will be SHA256-hashed).

Admin UI:
- Configure at `/admin/storage`.
- Any change is scheduled with a **24h delay** and logged to `NftEventLog` + broadcast to all admins via SYSTEM notifications.

Worker:
- `storage` queue runs repeatable jobs `apply_pending_config` (every 60s) and `health_scan` (every 5m).
