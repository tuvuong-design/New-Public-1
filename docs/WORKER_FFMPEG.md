# Worker + ffmpeg ladder (HLS ABR)

## 1) Worker chạy gì?
Worker dùng **BullMQ** (Redis) để xử lý tác vụ nặng, không chạy trong process Next.js.

Các queue chính (tham khảo `worker/src/index.ts`):
- `processVideo` — ffprobe metadata, thumbnail...
- `encodeHls` — encode ABR ladder HLS
- `subtitles` — Whisper/OpenAI transcribe (nếu bật)
- ... (tùy phiên bản)

## 2) HLS config (admin)
Trang: `.../admin/hls`

Model: `HlsConfig`
- `segmentSeconds`: 2–15
- `packaging`: 
  - `SINGLE_FILE` (HLS TS segments)
  - `FMP4` (init.mp4 + .m4s)
  - `HYBRID_TS_ABR_FMP4_SOURCE` (TS ladder 1080/720/480 + thêm 1 playlist fMP4 "source" giữ nguyên độ phân giải gốc)
- `ladderJson`: JSON array, mỗi phần tử:
  ```json
  { "height": 720, "videoKbps": 2800, "audioKbps": 128 }
  ```

### Checkbox → ladderJson (doc v3.1+)
Admin có thể chọn 360/480/720/1080. UI sẽ tự generate ladderJson từ preset bitrate.
- Bật **Advanced** nếu muốn tự chỉnh JSON.

## 3) EncodeHls tối ưu theo ladderJson
File: `worker/src/jobs/encodeHls.ts`

Điểm chính:
- Worker **đọc HlsConfig mỗi lần encode** để áp dụng cấu hình mới ngay lập tức.
- Dùng `filter_complex + split` để decode 1 lần rồi scale ra nhiều rendition.
- Thiết lập option theo từng stream: `-preset:v:i`, `-b:v:i`, `-g:v:i`...
- **Keyframe alignment**:
  - `-sc_threshold:v:i 0` (tắt scene cut keyframe)
  - `-force_key_frames:v:i expr:gte(t,n_forced*segmentSeconds)` (ép keyframe đúng biên segment)
  - `-hls_flags independent_segments`
- Auto **tránh upscale**: nếu source height = 720, rung 1080 sẽ bị bỏ.

## 4) Khi video không có audio
Worker ffprobe kiểm tra audio stream.
- Nếu không có audio: chỉ map video, var_stream_map không khai báo audio.

## 5) Troubleshooting
- `ffmpeg not found`: cài ffmpeg/ffprobe vào PATH.
- HLS playback lỗi: kiểm tra `R2_PUBLIC_BASE_URL` + public access của bucket.
- Segments quá nặng: giảm `videoKbps` hoặc bỏ rung 1080p.
- Request quá nhiều: tăng `segmentSeconds`.


## Watermark font
Clip maker uses ffmpeg `drawtext`. You can override the font via `FFMPEG_FONT_PATH` (worker env). Default: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`.
