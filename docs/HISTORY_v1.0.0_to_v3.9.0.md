# History • v1.0.0 → v3.9.0

Tài liệu này là **bản tổng hợp lại** (clean + dễ đọc) của Docs/Changelog theo từng phiên bản.

> Ghi chú:
> - Bộ zip cung cấp đầy đủ docs cho v1.0.0 và các bản v3.x.
> - Không có tài liệu chính thức cho v2.x trong gói này, nên history sẽ nhảy từ v1 → v3.

---

## v1.0.0 (baseline)
**Mục tiêu:** dựng nền tảng VideoShare chạy được end-to-end.

Tính năng chính:
- Next.js App Router + Prisma + NextAuth
- Upload video → worker xử lý → HLS playback (hls.js)
- Tag / Category / Channel cơ bản, profile page `/u/{id}`
- Feed (TikTok style) dạng vertical
- Admin cơ bản (quản lý video, config)

---

## v3.0.0 (major docs pack)
**Nhóm thay đổi lớn:** config hoá sâu hơn + mở rộng hệ thống.

Added/Changed (tóm tắt):
- Site Config (branding, toggles)
- HLS config (segmentSeconds, packaging, ladderJson)
- Subtitles auto (OpenAI Whisper)
- API Sources sync (ingest từ nguồn ngoài)
- SEO/PWA: sitemap/robots/meta, PWA toggle
- Push (OneSignal), GA toggle
- IndexNow ping

---

## v3.1.0
Tập trung vào UX video:
- TikTok feed cải thiện
- Storyboard scrub preview (ảnh preview khi kéo timeline)
- Share links/buttons
- **HLS ladder theo checkbox** (admin UI sinh ladderJson từ preset) — nền cho tối ưu worker ladder

---

## v3.2.0
- Thêm **Install Wizard** (`/install`): hỗ trợ generate `.env` cho shared hosting (aaPanel, ...)
- Hướng dẫn cấu hình DB/Redis/R2 qua UI

---

## v3.3.0
- Install Wizard step-by-step rõ ràng hơn
- Middleware redirect tốt hơn (đưa user vào /install khi env chưa xong)

---

## v3.4.0
- “Verify production”: checklist kiểm tra production readiness
- Các fix nhỏ về install/config

---

## v3.5.0
- Bản vá nhỏ (docs gốc không ghi chi tiết)

---

## v3.6.0
- Thêm **Gifts/Stars** (hệ thống tặng quà/⭐)
- Admin quản lý gifts, lịch sử transactions

---

## v3.7.0
- Thêm **Super Thanks** gắn với comment (highlight comment, tăng tương tác)
- UI/logic cho luồng Super Thanks

---

## v3.8.0
- Tiers / Top supporters
- Stats dashboard cải thiện

---

## v3.8.1
- Super Thanks upgrade: custom color tiers
- Sticker/GIF overlay (1–2s) cho Super Thanks

---

## v3.9.0
- **Report violation** (user report + admin moderation)
- **Trending videos** dựa trên daily metrics
- **Boost video** (quảng bá video bằng ⭐) + analytics
- Feed ads slot mixing: HTML ↔ boosted video

