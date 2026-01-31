# VideoShare Next.js (App Router) — v4.16.24

## Current status (v4.16.24)

- Storage redundancy (R2 primary + optional FTP Origin/HLS + Google Drive origin) with **24h delayed apply** and audit feed.
- Admin HLS packaging modes: **TS**, **fMP4**, **Hybrid**.
- Player roadmap Phase 1–2: hls.js playback with origin failover (R2 A/B + FTP), quality selector, stats overlay; Phase 2 cache headers + manifest rewrite + prefetch.
- Monetization: Stars topup flows + Premium unlock + Fan Club tier perks + Early Access gating.
- Growth: **Season Pass 30 ngày** mua bằng Stars + **Referral Stars** (1–20% admin-config, idempotent ledger).
- ARPU: **Bundles** (bonus stars per topup package) + **Coupons** (Topup bonus / Season Pass discount) — Admin: `/admin/payments/bundles`, `/admin/payments/coupons`.
- Share Cards (OpenGraph images): video/clip/creator routes under `/api/og/*`.
- Payments ops: **Fraud Radar** admin page `/admin/payments/fraud` (FraudAlert triage: OPEN/ACKED/RESOLVED).
- Notifications: weekly digest + **daily continue-watching digest** (in-app, optional).
VideoShare là nền tảng chia sẻ video: **Upload → Worker (ffmpeg) → HLS → Playback**, kèm **Stars/Payments**, **Studio**, và lớp tính năng **NFT-gated / Membership**.

> **Nếu bạn là AI/chat mới:** copy/paste nguyên `CHATKITFULL.txt` vào chat trước, rồi mới bắt đầu làm task.

## Source of truth (bắt buộc)
Khi mở chat mới hoặc cập nhật dự án, đọc theo thứ tự (có bản copy trong `/docs/`):
1) `CHATKITFULL.txt` (bootstrap nhanh nhất)
2) `PROJECT_CONTEXT.md`
3) `AI_REQUIREMENTS.md`
4) `CHANGELOG.md`
5) `TASK_TEMPLATE_CONTINUE.md`
6) `FEATURES_AI_MAP.md`
7) `PROMPT_REBUILD_PROJECT.md`
8) `ALL_FEATURES.txt`

## Stack & architecture (không được phá)
- Next.js App Router (`app/`) + TypeScript
- Tailwind + shadcn-like components (`components/ui/*`)
- Prisma + MySQL
- NextAuth + role `ADMIN/USER` (admin pages + admin API phải guard)
- Redis + BullMQ; **tác vụ nặng chạy trong `/worker`** (không chạy trong web request)
- Cloudflare R2 (S3 compatible) + CDN cache; **object keys versioned/immutable**

## Contracts cần giữ nguyên (trích yếu)
> Chi tiết xem `CONTRACT_CHECKLIST.md`.

- User pages: `/v/[id]`, `/upload`, `/history`, `/watch-later`, `/stars/topup`
- Admin payments pages: `/admin/payments/*` + `/admin/docs`
- Webhooks: `POST /api/webhooks/helius|alchemy|quicknode` (optional `trongrid`)
- Stars topup API: `/api/stars/topup/*`
- Similar: `lib/videos/similar.ts` + `lib/videos/similarCache.ts`
- Worker/Queues (payments) + Redis keys contracts phải giữ nguyên.

## What’s new (v4.16.x → v4.16.24)
### Storage redundancy + tự phục hồi HLS (v4.16.6+)
- **R2 primary** + tuỳ chọn **FTP Origin (MP4 gốc)** + **FTP HLS (mirror HLS + fallback playback)**.
- **Google Drive origin** (Service Account JSON): deep backup để **rebuild HLS** nếu R2 + FTP HLS đều hỏng.
- Admin:
  - `/admin/storage`: config + verify + test upload + **pending apply sau 24h**
  - `/admin/storage/events`: audit feed
- Worker queue `storage`: repeatables `apply_pending_config`, `health_scan`; jobs `backup_origin`, `mirror_hls`, `rebuild_hls_from_drive`.

### HLS packaging (Admin `/admin/hls`) (v4.16.9+)
Admin có 3 mode:
1) TS segments (.ts)
2) fMP4 (init.mp4 + .m4s)
3) Hybrid: TS ladder 1080/720/480 + fMP4 “source”

### Trust & Safety (v4.16.14+)
- Moderation escalation scan (auto mute/ban) chạy best-effort trong repeatable `payments:alert_cron`.
- Weekly digest email (optional) qua Resend (env-gated) + toggle `WEEKLY_DIGEST_EMAIL` trong `/settings/notifications`.

### Player roadmap (PeerTube vibe) + R2 A/B (blueprint)
Backlog/plan nằm trong `TASK_TEMPLATE_CONTINUE.md`.
- Phase 1: hls.js player (ABR + manual quality + stats overlay + retry/backoff + mirror switch)
- Phase 2: R2 A/B domains + cache headers chuẩn HLS + playlist rewrite + light segment prefetch (đã có Admin override A/B trong `/admin/storage`)
- Phase 3: P2P optional (PUBLIC only) bằng p2p-media-loader-hlsjs + metrics

### User QoL (v4.16.19)
- `/watch-later`: Watch Later list + resume (based on `VideoProgress`) + toggle button on watch page.
- `/stars/topup`: functional topup UI (packages → intent → submit txHash → history/retry) on top of existing APIs.

## Quickstart (dev)
```bash
docker compose up -d
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
npm run worker:dev
```

## Packaging
- Slim: không kèm `node_modules/`, `.next/`, `worker/dist/`
- Full: có kèm 3 thư mục trên

```bash
npm run package:slim
npm run package:full
```

## Docs
- `docs/ARCHITECTURE.md`: kiến trúc tổng thể + flows + invariants
- `docs/ADMIN_UI.md`: admin pages/APIs (contract-friendly)
- `docs/FEATURE_MAP.md`: map tính năng ↔ file/folder
- `docs/ENV.md`: env keys quan trọng
- `docs/AAPANEL_DEPLOY.md`: deploy VPS aaPanel

---
Nếu bạn là AI/assistant mới trong dự án: mở `CHATKITFULL.txt` và dán vào chat mới để bootstrap bối cảnh đầy đủ.
