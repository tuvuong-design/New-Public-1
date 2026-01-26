# Cloudflare R2 optimization (Class A / Class B) & Cache Rules

> Mục tiêu: giảm **chi phí request** và tăng performance bằng cách giảm số lần chạm R2 (đặc biệt là các request lặp lại như HLS segments, thumbnails, preview).

Cloudflare R2 thường được tính request theo **nhóm (classes)**:
- **Class A**: các thao tác ghi/quản lý (PUT, POST, LIST, multipart, ...)
- **Class B**: các thao tác đọc (GET, HEAD, ...)

Chi tiết có thể thay đổi theo thời gian — luôn đối chiếu với trang pricing/ docs chính thức của Cloudflare.

---

## 1) Chiến lược số 1: “Immutable keys” cho asset public

Vấn đề phổ biến:
- Nếu bạn lưu thumb/HLS vào key cố định (vd `.../thumb.jpg` hoặc `.../hls/master.m3u8`) rồi **ghi đè** khi reprocess/reencode,
  thì bạn **không thể cache lâu** ở CDN, vì cache sẽ bị stale.

Giải pháp:
- Khi encode / generate asset, tạo key có **version/buildId/encodeId**:
  - `videos/{videoId}/thumb/{buildId}.jpg`
  - `videos/{videoId}/preview/{buildId}.mp4`
  - `videos/{videoId}/storyboard/{buildId}.jpg`
  - `videos/{videoId}/hls/{encodeId}/...`

Ưu điểm:
- Cache CDN có thể để **rất lâu** mà không sợ stale.
- Re-encode không cần purge CDN, chỉ update DB trỏ sang key mới.

Trong code v4.2.0:
- `worker/src/jobs/processVideo.ts` tạo `buildId` và upload thumb/preview/storyboard với key versioned.
- `worker/src/jobs/encodeHls.ts` tạo `encodeId` và upload cả thư mục HLS vào prefix versioned.

---

## 2) Chiến lược số 2: Cache-Control đúng cho từng loại file

### a) Asset immutable (thumb/preview/HLS playlists & segments)
Đề xuất:
```
Cache-Control: public, max-age=31536000, immutable
```

Trong code:
- `worker/src/utils/r2io.ts` export `CACHE_CONTROL_IMMUTABLE`.
- Worker upload thumb/preview/HLS dùng `{ cacheControl: CACHE_CONTROL_IMMUTABLE }`.

### b) Subtitles (có thể regenerate)
Đề xuất:
```
Cache-Control: public, max-age=3600
```

Trong code:
- `worker/src/jobs/subtitles.ts` dùng `CACHE_CONTROL_1_HOUR`.

---

## 3) Chiến lược số 3: Cache Rules trên Cloudflare (CDN)

Giả sử bạn dùng:
- `R2_PUBLIC_BASE_URL=https://cdn.your-domain.com`
- Custom Domain / Route đến bucket R2

### Cache Rule gợi ý
1) **Static immutable assets**
   - Match: `cdn.your-domain.com/videos/*`
   - Respect origin headers: ✅ (để Cache-Control từ R2 có tác dụng)
   - Edge TTL: 30d–365d (tuỳ)
   - Browser TTL: 30d–365d

2) **Uploads (nếu public)**
   - Match: `cdn.your-domain.com/uploads/*`
   - Thường KHÔNG cần public; nếu public thì nên set TTL thấp hơn hoặc private.

3) **(Tuỳ chọn) Bypass cache cho admin/private paths**

### Quan trọng
- Nếu bạn bật “Cache everything” nhưng key không immutable → nguy cơ stale.
- Nếu bạn tắt cache hoàn toàn → mọi request sẽ chạm R2 (Class B tăng mạnh).

---

## 4) Giảm Class A operations (PUT/LIST/multipart)

### a) Hạn chế LIST trong runtime
- LIST là Class A.
- Trong hệ thống này, LIST chỉ nên xuất hiện ở các thao tác **admin/cleanup** (ví dụ deletePrefix khi xoá video).

### b) Multipart upload: giảm số part
- Mỗi part upload là request (Class A), nên:
  - Chọn `UPLOAD_PART_BYTES` đủ lớn để giảm part count.
  - Default trong `.env.example` là 200MB (cân bằng tốc độ & count).

### c) Cleanup strategy
- Với immutable keys, khi re-encode/reprocess, các file cũ không còn được tham chiếu.
- Bạn có thể:
  1) Chấp nhận giữ (tốn storage nhưng không tốn Class A)
  2) Làm cleanup định kỳ (tốn LIST/DELETE = Class A)
  3) Track keys trong DB để delete không cần LIST (phức tạp hơn)

---

## 5) Checklist “tối ưu tối đa”

- [x] Immutable keys cho assets public
- [x] Cache-Control đúng (immutable vs short)
- [ ] Cloudflare Cache Rules: respect origin + TTL dài
- [ ] Hạn chế LIST (chỉ admin/cleanup)
- [ ] Tune multipart: part size lớn, tránh part quá nhỏ
- [ ] Theo dõi metrics (R2 + Redis + DB) để điều chỉnh TTL/cache