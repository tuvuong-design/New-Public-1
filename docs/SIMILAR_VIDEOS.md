# Tìm kiếm video tương tự (nâng cao)

Mục tiêu:
- Dùng **tags + category + full-text ranking**
- **Loại trừ video hiện tại**
- **Ưu tiên cùng kênh** (same channel boost)

## 1) Yêu cầu DB
- MySQL 8 + InnoDB
- Có FULLTEXT index trên `Video(title, description)`
  - Prisma schema: `@@fulltext([title, description])`

## 2) Entry points
- Server helper: `lib/videos/similar.ts` → `getSimilarVideosAdvanced(videoId, take)`
- UI: trang video `app/v/[id]/page.tsx` render block “Video tương tự” (with `AdStream scope=RELATED`)

## 3) Logic (high level)
1) Load video hiện tại: title, description, categoryId, channelId, tags
2) Fulltext query string = `title + tags` (cắt tối đa 200 chars)
3) Chạy 1 SQL raw query (Prisma `$queryRaw`) trả về:
   - `ftScore` = `MATCH(title, description) AGAINST (?)`
   - `tagOverlap` = số tags trùng giữa video candidate và current
   - `catMatch`, `chanMatch`
   - `score` = tổng hợp theo weight
4) Order: `score DESC, createdAt DESC`
5) Nếu thiếu kết quả → fallback:
   - fill thêm cùng channel, cùng category, rồi latest

## 4) Công thức điểm (weights)
File: `lib/videos/similarScoring.ts`
```ts
SIMILAR_WEIGHTS = {
  channel: 5,
  category: 2,
  tagOverlap: 1.5,
  fullText: 1,
}
```

SQL dùng đúng weights này:
- same channel +5
- same category +2
- mỗi tag trùng +1.5
- fulltext relevance +1×

> Gợi ý tuning:
> - Nếu muốn “cùng kênh” ít áp đảo hơn: giảm `channel` xuống 3
> - Nếu muốn tags quan trọng hơn: tăng `tagOverlap` lên 2–3

## 5) Note về performance
- Query được group by videoId + count tag overlap.
- FULLTEXT index giúp `MATCH AGAINST` chạy nhanh.
- Có Redis cache (keyed by `videoId`) để giảm load DB.
  - Xem chi tiết: `docs/CACHING.md`
