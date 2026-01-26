# AI_NEW_CHAT_FAILSAFE v3.9.0

Copy-paste this into a NEW CHAT if the assistant loses context.

## Target release
- Version: v3.9.0
- Project: VideoShare Next.js Full (App Router + Prisma + R2/S3 + Worker ffmpeg)

## Must keep working
1) Upload → transcode (worker ffmpeg) → HLS ABR → playback (hls.js)
2) Video page stats + interactions (view/like/share/comment)
3) Ads placements by scope (HTML)
4) TikTok feed `/feed` (admin toggle)
5) Profile `/u/{id}`
6) Storyboard scrub preview (mobile)
7) Install Wizard `/install` + generate `.env` content for aaPanel
8) Gifts/Stars + Super Thanks comment
9) GIF sticker overlay (1–2s)
10) Report violation + admin moderation
11) Trending from daily metrics
12) Boost video + analytics
13) FEED mixing: HTML ↔ boosted alternating

## Known pitfalls
- Comments ads endpoint must be `/api/ads?scope=COMMENTS` (not older placement endpoint).
- Rate limit signature: `rateLimit(key, limit, windowMs)`
- Interaction APIs must update: daily metrics (Trending) + boost stats (Boost analytics) when applicable.
- Hosting may block writing `.env`: always support **copy-paste `.env` generation**.

