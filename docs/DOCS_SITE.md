# Docs Index (admin)

Trang `/admin/docs` cung cấp trải nghiệm đọc docs kiểu website (gần giống MkDocs/Docusaurus, đơn giản hoá).

## Tính năng
- Sidebar + search lọc theo title
- Render markdown (GFM: tables, strikethrough, ...)
- Link nội bộ theo slug

## Cấu hình navigation
- File: `docs/docs.nav.json`
- Format:

```json
{
  "sections": [
    {
      "title": "Overview",
      "items": [
        { "slug": "readme", "title": "Docs Home", "file": "README.md" }
      ]
    }
  ]
}
```

## Implementation notes
- `lib/docs/docs.ts` đọc nav + load markdown từ thư mục `docs/`.
- Sidebar UI nằm ở `app/admin/docs/ui/DocsSidebar.tsx` (client component).
- Markdown renderer dùng `react-markdown` + `remark-gfm` + Tailwind Typography.