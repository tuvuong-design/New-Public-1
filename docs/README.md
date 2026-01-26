# VideoShare Next.js (App Router) — v4.16.13

VideoShare là nền tảng chia sẻ video: **Upload → Worker (ffmpeg) → HLS → Playback**, kèm **Stars/Payments**, **Studio**, và các tính năng **NFT-gated**.

## Source of truth (bắt buộc)
Khi mở chat mới hoặc cập nhật dự án, ưu tiên đọc theo thứ tự:
1) `PROJECT_CONTEXT.md`
2) `AI_REQUIREMENTS.md`
3) `CHANGELOG.md`
4) `TASK_TEMPLATE_CONTINUE.md`
5) `FEATURES_AI_MAP.md`
6) `PROMPT_REBUILD_PROJECT.md`
7) `ALL_FEATURES.txt`
> Có bản copy tương ứng trong thư mục `/docs/`.

## Stack & architecture (không được phá)
- Next.js App Router (`app/`) + TypeScript
- Tailwind + shadcn-like components (`components/ui/*`)
- Prisma + MySQL
- NextAuth + role `ADMIN/USER` (admin pages + admin API phải guard)
- Redis + BullMQ; tác vụ nặng chạy trong `/worker` (không chạy trong web request)
- Cloudflare R2 (S3 compatible) + CDN cache; object keys versioned/immutable

## What’s new (v4.16.x)
### Storage redundancy + tự phục hồi HLS (v4.16.6+)
- **R2 primary** + tuỳ chọn **2 FTP thường**:
  - **FTP Origin**: backup file **MP4 gốc**
  - **FTP HLS**: mirror **HLS (playlist/segments)** + làm **fallback playback** khi R2/CDN lỗi
- **Google Drive (Service Account JSON)**: nơi giữ **origin deep-backup** để **rebuild HLS** khi R2 + FTP HLS đều hỏng.
- Admin UI:
  - `/admin/storage`: cấu hình, **verify**, **test upload**, và **schedule đổi config sau 24h**
  - `/admin/storage/events`: audit feed (log ai đổi, lúc nào, đổi từ đâu sang đâu)
- Worker queue `storage`:
  - repeatable `apply_pending_config`, `health_scan`
  - jobs `backup_origin`, `rebuild_hls_from_drive`

### NFT nền tảng (Wallet linking + Gated)
- Link ví: `/settings/wallets` (Solana/EVM)
- Proof-of-Fandom: NFT holder → auto unlock tier membership (Studio Membership NFT Gate)
- Premium video NFT unlock (VideoNftGate) + paywall CTA “Unlock with NFT”
- Clip as NFT: mint/track + marketplace modes (SEPARATE / MARKETPLACE / BOTH)
- Badges: milestone rewards + notifications + share card
- Creator Pass: perks/discount + ledger reason tracking

## Contracts cần giữ nguyên (trích yếu)
> Chi tiết xem `PROJECT_CONTEXT.md` + `/docs/*`.

- User pages: `/v/[id]`, `/upload`, `/history`, `/watch-later`, `/stars/topup`
- Admin payments pages: `/admin/payments/*` + `/admin/docs`
- Webhooks: `POST /api/webhooks/helius|alchemy|quicknode` (optional `trongrid`)
- Stars topup API: `/api/stars/topup/*`
- Similar cache: `lib/videos/similar.ts` + `lib/videos/similarCache.ts`
- Worker/Queues (payments) + Redis keys contracts phải giữ nguyên.

## Quickstart (dev)
```bash
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
npm run worker:dev
```

## Storage redundancy setup (R2 + 2 FTP + Google Drive)
1) Set env bắt buộc:
- `APP_ENCRYPTION_KEY` (32 bytes, dùng để encrypt secrets trong DB)

2) Admin → `/admin/storage`
- Nhập **FTP Origin** (host/port/user/password + basePath) và bật `Upload origin MP4 to FTP` nếu muốn backup MP4
- Nhập **FTP HLS** (host/port/user/password + basePath + publicBaseUrl) và bật `Upload HLS to FTP` nếu muốn mirror HLS
- Nhập **Google Drive Folder ID** + **Service Account JSON**
- Bấm **Verify** / **Test upload** để kiểm tra
- Save → config sẽ được **pending** và chỉ **apply sau 24h**
  - Hệ thống sẽ gửi **SYSTEM notification** cho admin và log vào `/admin/storage/events`.

3) Playback fallback
- Khi worker health-scan phát hiện R2 HLS lỗi, watch page sẽ tự phát từ **FTP HLS publicBaseUrl** (nếu bật).

### HLS packaging (TS vs fMP4)
- Admin có thể chọn kiểu đóng gói tại **`/admin/hls`**:
  - **TS segments (.ts)**: tương thích rộng, dễ debug
  - **fMP4 (init.mp4 + .m4s)**: thường switch ABR mượt hơn, hợp Player kiểu PeerTube
  - **Hybrid: TS 1080/720/480 + fMP4 "source"**: TS ladder để stream ABR + thêm 1 playlist fMP4 giữ nguyên độ phân giải gốc (phục vụ player/đo lường/tuỳ chọn nâng cao)

## Player roadmap (PeerTube vibe) + R2 A/B
Blueprint/Backlog chi tiết đã được ghi vào `TASK_TEMPLATE_CONTINUE.md` (root + `/docs`). Mục tiêu là player mượt kiểu PeerTube: **ABR tốt**, có **stats**, có **retry/failover**, và tối ưu **Cloudflare R2 A/B**.

### Phase 1 — Player core (ROI cao)
- `components/player/VideoPlayerClient.tsx` (Client Component):
  - `hls.js` attach `<video>`
  - **Auto quality + manual selector** (144/360/720/1080…)
  - **Smooth quality switch** (không reset playback)
  - Persist quality (localStorage; DB optional)
  - **Stats for nerds**: bitrate, dropped frames, buffer, origin đang dùng (R2 A/B vs FTP)
  - Retry/backoff khi network error + **switch mirror** (R2 A ↔ R2 B ↔ FTP HLS)
- `lib/playback/resolveStream.ts` (server): trả về danh sách stream candidates theo ưu tiên và health status.

### Phase 2 — R2 cache tối ưu cho HLS
- Cache headers:
  - Segments (`.ts`/`.m4s`): `Cache-Control: public, max-age=31536000, immutable`
  - Playlists (`master.m3u8`, `index.m3u8`): `Cache-Control: public, max-age=30, stale-while-revalidate=60` (tuỳ chỉnh)
- (Optional) rewrite playlist thành absolute URLs theo base hiện tại.
- Prefetch nhẹ 1–2 segments để giảm stall (không aggressive).

### Phase 3 — P2P optional (PUBLIC only)
- Admin flag: `playerP2PEnabled` (default OFF)
- Chỉ bật cho PUBLIC videos/trending (tắt cho PREMIUM để tránh rủi ro privacy)
- Tích hợp loader kiểu PeerTube với `p2p-media-loader-hlsjs`.

### Admin controls (khuyến nghị)
- `R2_PUBLIC_BASE_URL_A`, `R2_PUBLIC_BASE_URL_B` + split % (consistent hash theo userId/videoId)
- Toggle: show stats overlay, enable P2P, failover strategy (switch sau X errors / Y seconds stall)
- Nên dùng cơ chế **pending apply 24h + audit + notify** giống storage config để chống bị hack.

### Lockfiles
- Repo có `package-lock.json` (placeholder). Trên máy dev/CI có access registry, hãy chạy `npm install` để regenerate lock đầy đủ trước khi dùng `npm ci`.

## Docs
- `docs/QUICKSTART.md`: hướng dẫn nhanh
- `docs/ARCHITECTURE.md`: kiến trúc tổng thể
- `docs/ADMIN_UI.md`: danh sách trang admin + mô tả
- `docs/R2_OPTIMIZATION.md`: tối ưu caching/CDN/R2
- `docs/WORKER_FFMPEG.md`: pipeline encode HLS/ffmpeg

---
Nếu bạn là AI/assistant mới trong dự án: mở `docs/CHATKITFULL.txt` và dán vào chat mới để bootstrap bối cảnh đầy đủ.
