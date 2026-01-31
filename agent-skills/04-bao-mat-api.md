# 04. Bảo mật API (API Key + scopes + strictScopes)

## API Key
- Frontend/app ngoài domain phải gửi: `X-API-Key: <key>`
- Nếu request có header `Origin` (browser), backend sẽ check `allowedOrigins`.

## Scopes
Ví dụ scopes:
- `PUBLIC_READ`, `VIDEO_READ`
- `VIEW_WRITE`
- `USER_WRITE`
- `NFT_READ`, `NFT_WRITE`
- `COMMENT_READ`, `COMMENT_WRITE`

## strictScopes
Với route nhạy cảm, phải bật strictScopes:
- Nếu key thiếu scope -> trả 403 ngay.
- Route khuyến nghị strict: `VIEW_WRITE`, `USER_WRITE`, `NFT_WRITE`.

## Auth
- Web: JWT cookie (fetch with `credentials: "include"`)
- Mobile: Bearer token (`Authorization: Bearer ...`)

## PIN
Nếu user đã set PIN thì các hành động nhạy cảm phải gửi PIN:
- mua NFT / tặng sao / đúc NFT / huỷ listing / đổi giá listing
