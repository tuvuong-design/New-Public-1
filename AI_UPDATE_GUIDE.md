# AI_UPDATE_GUIDE.md — v4.12.0 — Hướng dẫn update dự án VideoShare

## Update notes (v4.12.0)
- **DB changes**: fix schema index bug (`StarDeposit`/`VideoReport`), no destructive contract changes.
- **New/changed**:
  - Stars ledger filters + export: `/admin/stars/transactions` + `GET /api/admin/stars/export/ledger`.
  - Anti-fraud risk rules: Stars credit (auto/manual) runs Redis-backed rules, risky -> `NEEDS_REVIEW` + `RISK_REVIEW`.
  - Moderation queue: video/comment reports enqueue `moderation:review_report`.
  - CDN smart purge queue: `cdn:purge_paths` (Cloudflare optional) triggered by publish/hide/delete/metadata update.
  - Search: `GET /api/search` uses FULLTEXT relevance when possible + Redis cache.
  - Growth Hacker Phase A: CTR tracking (CARD_IMPRESSION/CARD_CLICK) via `POST /api/analytics/events` queued to `analytics` worker; Studio Analytics dashboard `/studio/analytics` shows CTR chart + top sources.
- **Runbook** (local): `npm run prisma:generate && npm run prisma:push && npm run prisma:seed`.


Mục tiêu: khi mở chat mới, chỉ cần upload ZIP source + gửi file này là AI nắm đúng:
- kiến trúc và các "điểm không được phá"
- contracts (routes, job names, Redis keys)
- nơi cần sửa khi có feature/bug

## 0) Block dán nhanh cho chat mới

Copy nguyên block dưới và gửi trong chat mới (kèm ZIP source):

```text
Dự án: VideoShare Next.js App Router (app/) + TypeScript.
Stack: Prisma + MySQL, NextAuth (ADMIN/USER), Redis + BullMQ, Cloudflare R2 (S3) + CDN.
Quy tắc: tác vụ nặng phải chạy trong worker/ (không chạy trong web request).
Contracts quan trọng: admin payments (/admin/payments/*), webhooks (/api/webhooks/*), stars topup (/api/stars/topup/*), similar videos cache keys.
Hiện có: payments reconcile pipeline + admin dashboard, sensitive videos (PeerTube-like), ads targeting device/bot, Super Thanks comments, password gate (401) cho video protected, external sync foundation (ApiSource + worker) + My Channel Sync UI, NFT internal market (listings + auctions) + export on-chain foundation; Task 9–15: Search/Explore, PWA Offline + offline upload queue, Creator tips + revenue + creator webhooks, Gamification (XP/Badges/Leaderboard), Chapters, Public API + RSS, Studio editor trim + screen recording.
Version hiện tại: v4.12.0 (xem PROJECT_CONTEXT.md + AI_REQUIREMENTS.md + CHANGELOG.md).

### v4.12.0 checklist (Trust/Safety/Infra)
- Prisma schema: đảm bảo không còn index sai (`access` copy/paste bug).
- Payments Stars credit phải idempotent: `StarTransaction.depositId` unique; luôn check trước credit.
- Risk rules (Redis) hoạt động: vượt giới hạn -> `StarDeposit.status=NEEDS_REVIEW` + `RISK_REVIEW` event.
- Moderation queue: tạo report -> enqueue `moderation:review_report` (worker).
- CDN smart purge: publish/hide/delete/update metadata -> enqueue `cdn:purge_paths` (Cloudflare optional).
Yêu cầu: sửa code trực tiếp trên source, update CHANGELOG + docs nếu thay đổi, và xuất ZIP (không kèm node_modules/.next/worker/dist).
```

## 1) Thứ tự đọc file (bắt buộc)
1) `PROJECT_CONTEXT.md`
2) `AI_REQUIREMENTS.md`
3) `CHANGELOG.md`
4) `FEATURES_AI_MAP.md`
5) `TASK_TEMPLATE_CONTINUE.md`
6) `ALL_FEATURES.txt`

## 2) Cách chạy local (chuẩn)
```bash
docker compose up -d
cp .env.example .env
npm i
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
# terminal khác
npm run worker:dev
```

## 3) Packaging (2 bản ZIP)
- Slim: không kèm `node_modules/`, `.next/`, `worker/dist/`
- Full: có kèm 3 thư mục trên (yêu cầu đã install + build)

```bash
npm run package:slim
npm run package:full
```

## 4) Nơi thường sửa theo module
- Payments: `lib/payments/*`, `app/api/webhooks/*`, `app/api/admin/payments/*`, worker `worker/src/jobs/payments/*`.
- Similar videos: `lib/videos/similar.ts`, `lib/videos/similarCache.ts`.
- Sensitive videos: `lib/sensitive.ts`, `components/sensitive/*`, `app/api/user/preferences/sensitive/route.ts`.
- Ads targeting: `app/api/ads/route.ts`, `app/api/admin/ad-placement/route.ts`, `components/ads/*`.
- Password gate: `lib/videoPassword.ts`, `app/v/[id]/page.tsx`, `app/v/[id]/unauthorized.tsx`, `app/api/videos/[id]/unlock/route.ts`.
- External sync: `worker/src/jobs/syncApiSource.ts`, `app/my-channel/sync/page.tsx`, `app/api/me/sync-sources/*`.

## 5) Lưu ý quan trọng để tránh lỗi Next.js
- Server Component không dùng onClick/onSubmit.
- Nếu cần tương tác: tách Client Component hoặc dùng form POST + Route Handler.


## Core docs sync (root + /docs)
Khi có thay đổi quan trọng, luôn sync các file “xương sống” sang `/docs/`:
- README.md, AI_UPDATE_GUIDE.md, PROJECT_CONTEXT.md, AI_REQUIREMENTS.md, CHANGELOG.md,
  TASK_TEMPLATE_CONTINUE.md, FEATURES_AI_MAP.md, PROMPT_REBUILD_PROJECT.md, ALL_FEATURES.txt, CHATKITFULL.txt
