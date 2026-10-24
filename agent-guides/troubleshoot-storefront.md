# Troubleshooting

## Images blank / broken

**Cause**: Shopify CDN blocked (sandbox/office network SSL), ya handle galat.
**Fix**: placeholder SVG fallback already hai; network badal kar dekho; image URL `.js` se verify karo.
`imageUrl()` sirf `cdn.shopify.com` par width param lagata hai — baaki URL as-is.

## PDP 404

- Handle typo? `jq '.[] | select(.handle=="…")' database/seeds/catalog.json`
- Build stale? `npm run build:web`
- Product naya hai? catalogue rebuild + deploy.

## Price galat

1. Catalogue value: `jq '.[] | select(.handle=="X") | .price' database/seeds/catalog.json`
2. Override: `cat .data/overrides.json`
3. Server compute check: `POST /api/orders` karke `total` dekho.

## Order place nahi ho raha

| Error | Matlab | Fix |
| --- | --- | --- |
| `cod_not_allowed` | subtotal > Rs. 3,500 | prepaid choose karo |
| `product_not_found` | handle catalogue me nahi | rebuild/deploy |
| `VALIDATION_ERROR` fields | input galat | field-wise errors UI me |
| 429 | rate limit | 1 min wait |
| 500 | disk write / JSON corrupt | `.data/orders.json` check, backup restore |

## Order page 404 par order bana

- `.data` path: web aur api dono same `DATA_DIR` use karein.
- Order number case: uppercase.

## Admin login loop

- `ADMIN_SESSION_SECRET` change hua → dobara login.
- Clock skew (expiry) — system time check.
- Cookie blocked (third-party/insecure context) — localhost par http allowed hai, prod https.

## Build fails

| Error | Fix |
| --- | --- |
| `Cannot find module '@/lib/...'` | path alias tsconfig me |
| admin build root se | `cd apps/admin && npx next build` |
| `.next` ENOENT / stale chunks | `rm -rf apps/*/.next` |
| Google Fonts fetch | `next/font` avoid (already) |
| out of memory | `NODE_OPTIONS=--max-old-space-size=4096` |

## Cart khaali ho gaya

localStorage key `liksha:cart:v1` clear hui (private mode / browser clean). Expected.

## Search kuch nahi deta

- `q` 2+ chars?
- `/api/search` direct test: `curl "localhost:3000/api/search?q=anarkali"`.
- Catalogue me title/tags me term hai?
