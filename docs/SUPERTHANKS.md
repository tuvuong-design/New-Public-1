# Super Thanks (PeerTube vibe)

Super Thanks la mot **binh luan dac biet** duoc tao ra khi nguoi xem **tang Stars** hoac **tang Gift** tren trang video.

- Du lieu duoc luu trong `Comment` (fields: `isSuperThanks`, `superThanksStars`, `superThanksQty`, `starTxId`).
- Thong tin giao dich lien quan duoc luu trong `StarTransaction.note` (JSON) de ho tro **anonymous**.

## UI / Hieu ung

Khi `Comment.isSuperThanks = true`, UI render mot card theo phong cach **PeerTube**:

- 🌟 Shimmer effect: anh sang sweep qua card
- ✨ Sparkle effects: 1-5 ngoi sao nhay mua theo tier
- 💫 Glow effect: vien + glow theo tier
- 🔄 Spinning star: icon sao xoay cham
- 💗 Pulse animation: badge nhep nhe
- 📈 Hover: scale + shadow khi hover
- 🟨 Gold frame: vien vang + left accent bar (PeerTube-ish)
- 🟨 Badge vang: "Super Thanks • X stars" (gradient vang + star fill)
- 🔶 Comment content: font dam hon cho Super Thanks

Tat ca hieu ung nam trong `app/globals.css` (superthanks section).

## Tier-based styling

Tier duoc tinh theo `Comment.superThanksStars`:

- Bronze (<= 5): amber-700 -> amber-600
- Silver (<= 10): gray-400 -> gray-300
- Gold (<= 25): yellow-500 -> amber-500
- Platinum (<= 50): slate-300 -> slate-200
- Diamond (> 50): purple-500 -> pink-500

Sparkle count mapping: Bronze=1, Silver=2, Gold=3, Platinum=4, Diamond=5.

## TOP SUPPORTER

- Badge `TOP SUPPORTER` chi hien khi:
  - Comment la Diamond (>50 stars)
  - Va nguoi tang la **top supporter** cua video (tong so stars Super Thanks cao nhat trong video)

Top supporter duoc tinh server-side trong `GET /api/comments` bang `groupBy` (sum `superThanksStars` theo `userId`).

## Anonymous sender

Nguoi gui co the chon "Gui an danh" trong modal.

- API `/api/stars/send` va `/api/gifts/send` nhan `anonymous?: boolean`
- Luu vao `StarTransaction.note` dang JSON:
  - `{ v: 1, kind: "SUPERTHANKS", anonymous: true, ... }`
- UI:
  - Neu `senderAnonymous = true` => hien "An danh" va an membership badge

## Comment sorting

`GET /api/comments?videoId=...` se sort:

1) `isSuperThanks desc`
2) `superThanksStars desc`
3) `createdAt desc`

=> Super Thanks luon noi len dau va dung thu tu stars.

## Files lien quan

- UI: `app/v/[id]/ui/Comments.tsx`
- Modal send: `app/v/[id]/ui/StarGiftButton.tsx`
- CSS: `app/globals.css`
- API:
  - `app/api/comments/route.ts`
  - `app/api/stars/send/route.ts`
  - `app/api/gifts/send/route.ts`
