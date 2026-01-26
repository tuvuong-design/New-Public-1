# Caching

## 1) Redis cache: Similar Videos

### Mục tiêu
Trang chi tiết video (`/v/[id]`) có phần **video tương tự** (advanced ranking: tags + category + full-text + ưu tiên cùng kênh + loại trừ video hiện tại).

Query này có thể tốn chi phí DB (FULLTEXT + joins), nên chúng ta cache kết quả theo **videoId** trên Redis.

### Key format
- Key: `videoshare:similar:v1:{videoId}`
- Value: JSON (`items[]` + metadata)

### TTL & sizing
- `SIMILAR_CACHE_TTL_SECONDS` (mặc định **900s** = 15 phút)
- `SIMILAR_CACHE_MAX_ITEMS` (mặc định **50**)
  - Khi request `take=12`, hệ thống vẫn cache **top 50** để reuse cho các layout khác.

### Invalidation rules
Cache sẽ bị xoá (invalidate) khi:
- Admin update **title / category / tags** (route: `/api/admin/videos/update-metadata`)
- Admin thao tác publish/hide/requeue/delete (best-effort) cũng sẽ invalidate cache của video đó.

> Lưu ý: cache đang được thiết kế “per-video” theo requirement, vì vậy **khi update một video**, cache của video khác có thể vẫn còn chứa video đó trong danh sách tương tự cho đến khi TTL hết hạn. Đây là trade-off đơn giản/nhẹ.

### Debug
Trong DEV, có thể check nhanh bằng:
```bash
redis-cli GET "videoshare:similar:v1:<videoId>" | head
```

### Production guidance
- Redis nên bật persistence (AOF) tuỳ nhu cầu.
- Đặt TTL vừa đủ (5–30 phút) để giảm load DB mà vẫn cập nhật hợp lý.

## 2) Cache headers cho assets (R2/CDN)
Xem thêm: `R2_OPTIMIZATION.md`.
