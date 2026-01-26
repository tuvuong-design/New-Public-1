# Ads targeting (Mobile/Tablet only + hide bots)

Mục tiêu:
- Cho phép cấu hình quảng cáo theo **thiết bị** (mobile/tablet/desktop)
- Có tuỳ chọn **hide for bots** để ẩn quảng cáo với Googlebot/SEO crawlers
- Hỗ trợ placements global ở **đầu trang** và **chân trang** (mobile/tablet only)

---

## 1) Data model: AdPlacement
Model: `AdPlacement` (Prisma)
- `scope`: nơi hiển thị (ví dụ: `FEED`, `VIDEO`, `COMMENTS`, `RELATED`, ...)
- `enabled`: bật/tắt
- `showOnMobile`: boolean
- `showOnTablet`: boolean
- `showOnDesktop`: boolean
- `hideForBots`: boolean
- `html`: nội dung HTML ads
- `everyN`: chỉ dùng cho stream (VD: FEED – chèn mỗi N items)

Mặc định seed:
- mobile + tablet = true
- desktop = false
- hideForBots = true

---

## 2) Bot / device detection
Heuristic nằm ở: `lib/userAgent.ts`
- Bot regex match: Googlebot, bingbot, facebookexternalhit, twitterbot, telegrambot, ...
- Device detection:
  - ưu tiên header `sec-ch-ua-mobile`
  - fallback parse user-agent

Hàm chính:
- `isAdAllowedForRequest(placement, headers)`

---

## 3) API: /api/ads
Route: `GET /api/ads?scope=...`
- Server sẽ kiểm `enabled + targeting` trước khi trả HTML.
- Nếu request là bot hoặc desktop (khi `showOnDesktop=false`) → trả `{ enabled: false, html: "" }`.

---

## 4) Admin UI
Trang: `/admin/ads`
- Cho phép set targeting theo device/bot cho từng placement.

---

## 5) Global banners (đầu trang / chân trang)
Placements:
- `GLOBAL_TOP`
- `GLOBAL_BOTTOM`

Render:
- `app/layout.tsx` dùng `components/ads/GlobalBannerAds.tsx`
- Các placements này vẫn obey targeting (mobile/tablet only, hide bots)

---

## 6) Test nhanh
1) Admin bật `GLOBAL_TOP` + dán HTML.
2) Mở site trên desktop → **không thấy** (mặc định).
3) Mở site trên mobile/tablet → thấy banner.
4) Test bot:
   - dùng curl với `-H 'User-Agent: Googlebot'` gọi `/api/ads?scope=GLOBAL_TOP` → `enabled=false`.
