# Sensitive videos (PeerTube-like)

Tính năng “video nhạy cảm” mô phỏng PeerTube: **video vẫn public & vẫn index SEO**, nhưng viewer có thể chọn cách hiển thị:
- **SHOW**: hiển thị bình thường
- **BLUR**: làm mờ thumbnail/player và cần bấm “Tôi hiểu và muốn xem”
- **HIDE**: ẩn khỏi listing và ẩn player (vẫn truy cập được link để SEO không bị mất)

---

## 1) Data model
- `Video.isSensitive: boolean`
- `User.sensitiveMode: SHOW | BLUR | HIDE`
- `SiteConfig.sensitiveDefaultMode: SHOW | BLUR | HIDE`

Logic resolve viewer mode nằm ở: `lib/sensitive.ts`.

---

## 2) UI / nơi cấu hình
### 2.1 Admin đánh dấu video nhạy cảm
- Trang: `/admin/videos/[id]` → toggle “Sensitive content”.

### 2.2 Admin set default toàn site
- Trang: `/admin/config` → select `sensitiveDefaultMode`.

### 2.3 User set chế độ riêng
- Trang: `/me/settings` (redirect tới `/u/{id}#sensitive`)
- API: `POST /api/user/preferences/sensitive`

---

## 3) Hiển thị trong listing
- Home `/`
- Trending `/trending`
- Feed `/feed`
- User page `/u/[id]`

Component chính: `components/sensitive/SensitiveThumb.tsx`.

Rule:
- Nếu mode = **HIDE** → lọc `isSensitive=false` ở query và/hoặc không render item.
- Nếu mode = **BLUR** → thumbnail blur + label “Sensitive”.

---

## 4) Watch page gate (PeerTube vibe)
Trang: `/v/[id]`
- Nếu video `isSensitive=true` và viewer mode != SHOW → hiện overlay gate.
- Gate có nút: **“Tôi hiểu và muốn xem”**.

Component: `components/sensitive/SensitiveVideoGate.tsx`.

---

## 5) SEO / Social thumbnail blur
### 5.1 SEO
- Video vẫn có metadata bình thường (title/description), vẫn index.

### 5.2 OpenGraph/Twitter image
- Endpoint: `/api/og/video/[id]`
- Nếu video nhạy cảm: OG image có cảnh báo + blur background.

> Mục tiêu: các mạng xã hội (Facebook/Twitter/Telegram/Discord…) khi scrape sẽ lấy hình đã blur, giảm nguy cơ lộ nội dung nhạy cảm.

---

## 6) Test nhanh
1) Upload video ở `/upload` và tick “Nội dung nhạy cảm”.
2) Vào `/me/settings` đổi mode BLUR/HIDE.
3) Kiểm tra:
   - Home/Feed/Trending có blur/ẩn đúng
   - `/v/[id]` có overlay + nút “Tôi hiểu…”
4) Test OG image:
   - Mở `/api/og/video/<id>` trên browser.
