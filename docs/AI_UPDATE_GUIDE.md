# AI_UPDATE_GUIDE.md — v4.16.24 — Hướng dẫn update dự án VideoShare

Mục tiêu: khi mở chat mới / giao task cho AI, AI nắm đúng:
- kiến trúc + invariants (stack không đổi, heavy work chạy worker)
- contracts (routes, job names, Redis keys)
- roadmap (v4.16.x: storage redundancy, HLS packaging, player phases, Season Pass/Referral, Bundles/Coupons ARPU)
- DoD khi hoàn thành (bump version + changelog + sync docs + ZIP)

---

## 1) Block dán nhanh cho chat mới (khuyến nghị)
**Cách nhanh nhất:** dán nguyên `CHATKITFULL.txt` vào chat mới.

Nếu cần block ngắn:
```text
Dự án: VideoShare Next.js App Router (TypeScript).
Stack bất biến: Prisma+MySQL, NextAuth (ADMIN/USER), Redis+BullMQ worker/, Cloudflare R2 (S3)+CDN (keys immutable).
Quy tắc: heavy work chạy worker/, web request chỉ enqueue.
Contracts: /v/[id], /upload, /history, /watch-later, /stars/topup; admin payments /admin/payments/* + /admin/docs; webhooks /api/webhooks/(helius|alchemy|quicknode|trongrid opt); stars topup /api/stars/topup/*; similar lib/videos/similar.ts + similarCache.ts; payments queue jobs + Redis keys giữ nguyên.
Roadmap v4.16.x: Storage redundancy (/admin/storage + 24h delayed apply + worker storage queue), HLS packaging (/admin/hls TS/fMP4/Hybrid), Player roadmap PeerTube vibe (Phase 1→3) trong TASK_TEMPLATE_CONTINUE.md, Growth/Monetization: Season Pass 30d + Referral Stars (1–20%), ARPU: Bundles (topup bonus) + Coupons (topup bonus / season pass discount).
Source of truth: PROJECT_CONTEXT.md, AI_REQUIREMENTS.md, CHANGELOG.md, TASK_TEMPLATE_CONTINUE.md, FEATURES_AI_MAP.md, PROMPT_REBUILD_PROJECT.md, ALL_FEATURES.txt (và /docs copy).
```

---

## 2) Thứ tự đọc file (bắt buộc)
1) `CHATKITFULL.txt`
2) `PROJECT_CONTEXT.md`
3) `AI_REQUIREMENTS.md`
4) `CHANGELOG.md`
5) `TASK_TEMPLATE_CONTINUE.md`
6) `FEATURES_AI_MAP.md` + `docs/FEATURE_MAP.md`
7) `PROMPT_REBUILD_PROJECT.md`
8) `ALL_FEATURES.txt`

---

## 3) Cách chạy local (chuẩn)
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

---

## 4) Prisma: migrate deploy vs db push (rule of thumb)
- Dev local nhanh: `prisma db push`
- Staging/Prod: `prisma migrate deploy` (chạy migration files, có history/audit)

Script:
- `npm run prisma:push` → `prisma db push`
- `npm run prisma:migrate` → `prisma migrate deploy`

---

## 5) Packaging (2 bản ZIP)
- Slim: không kèm `node_modules/`, `.next/`, `worker/dist/`
- Full: có kèm 3 thư mục trên (yêu cầu đã install + build)

```bash
npm run package:slim
npm run package:full
```

---

## 6) Core docs sync (root + /docs)
Khi có thay đổi quan trọng, luôn sync các file “xương sống” sang `/docs/`:
```bash
bash scripts/sync-core-docs.sh
```

Các file được sync:
- `README.md`
- `AI_UPDATE_GUIDE.md`
- `PROJECT_CONTEXT.md`
- `AI_REQUIREMENTS.md`
- `CHANGELOG.md`
- `TASK_TEMPLATE_CONTINUE.md`
- `FEATURES_AI_MAP.md`
- `PROMPT_REBUILD_PROJECT.md`
- `ALL_FEATURES.txt`
- `CONTRACT_CHECKLIST.md`
- `CHATKITFULL.txt`

---

## 7) Checklist trước khi release
- `bash scripts/contract-check.sh`
- `npm run build` (Next build + worker tsc)
- Update `CHANGELOG.md` + bump version
- Sync core docs (root + /docs)
- Xuất ZIP slim



## v4.16.22 notes
- Added Fraud Radar (Admin): `/admin/payments/fraud` + FraudAlert triage.
- Added payments fraud signals (dup txHash, submit rate-limit, large manual credit) + worker fraud scan from `payments:alert_cron`.

## v4.16.20 notes
- Added OG routes for clip/creator and daily continue-watching digest job.
- Remember to keep docs in sync via `scripts/sync-core-docs.sh`.
