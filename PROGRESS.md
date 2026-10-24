# Progress

**Last updated:** 2026-10-24 (live-parity pass: galleries, OTP, tracking, GST invoice)

## Status snapshot

| Area | State | Evidence |
| --- | --- | --- |
| Catalogue (287 products, 9 collections, 1,971 images, live descriptions) | ✅ done | `npm run catalog:verify` → `catalog ok` (snapshot parity) |
| Storefront (live-clone home, 9 static PLPs, 287 static PDPs, gallery, cart, checkout + OTP, tracking, invoices, policies) | ✅ done | `npm run build:web` → 309 routes |
| Admin (login + 15 routes, server actions, audit) | ✅ done | `cd apps/admin && npx next build` → 16 routes |
| API (products, orders, payments, webhook, health) | ✅ done | `tsc` clean, `npm run test:integration` → 36 pass |
| Order lifecycle (pricing, coupons, COD, idempotency, transitions) | ✅ done | integration tests + HTTP tests |
| Phone OTP (Firebase) at checkout | ✅ code ready, keys pending | `docs/07-security/phone-otp.md` |
| GST invoice (HTML + PDF, phone-gated) | ✅ done | order page → Download invoice |
| Courier/AWB tracking (admin → customer) | ✅ done | admin order → Courier & tracking |
| Tests | ✅ 47 unit + 38 integration + 35 smoke checks | `npm run test:all`, `npm run test:smoke` |
| Docs 00–11 | ✅ 87 files | `docs/` |
| Skills (15), agent guides (6), infra, CI/CD | ✅ done | `.claude/skills`, `agent-guides`, `infra`, `.github` |
| Live Razorpay keys + webhook registration | ⛔ blocked on business KYC | env `RAZORPAY_*` empty |
| Full image galleries + exact `body_html` descriptions | ✅ done (live snapshot) | `database/seeds/live/`, `npm run catalog:sync` |
| Firebase project + authorized domains | ⏳ owner action | `docs/07-security/phone-otp.md` |
| Postgres migration | ⏳ Phase 2 | `database/prisma/schema.prisma` ready |

## Verified commands (this build)

```
npm run typecheck                       → 0 errors (web, admin, api)
npm test                                → 47 pass
npm run test:integration                → 36 pass
npm run catalog:verify                  → 287 products, 9 collections, catalog ok
npm run build --workspace @liksha/web   → compiled, 309 routes (287 PDP prerendered)
cd apps/admin && npx next build         → 16 routes
npm run build --workspace @liksha/api   → esbuild → dist/server.cjs (2.0MB bundle, boots in ~1.5s)
BASE_URL=… npm run test:smoke           → 20 pass
bash infra/monitoring/health.sh         → 9/9 endpoints ok
```

Runtime smoke (dev):
- `POST /api/orders` (COD, coupon) → order created, total computed server-side
- Same `Idempotency-Key` → same order, `idempotent-replay: true`
- COD above Rs. 3,500 → 400 `COD_NOT_ALLOWED`
- `GET /api/v1/orders` without Bearer → 401
- Admin `/` without cookie → 307 `/login`
- Order page renders timeline + support details

## Recent changes (this pass)

- Order status machine centralised in `@liksha/validation` (was duplicated in web/api/admin).
- Collision-safe order numbers (`LK-` + base36 time + 4 crypto chars; was 3 chars of `Math.random`).
- Disk-backed idempotency (web route + API middleware) — survives restarts, 7-day TTL.
- Strict size validation: unknown size is rejected with the valid options (no silent fallback).
- Admin server actions now require a valid session and take the actor from the session (not a form field).
- Size normalisation fixed: `"Red / L [40]"`, `"L(40)"`, `"XXL [44]"` → canonical `L [40]`, `2XL [44]`.
- Emoji handle sanitised to an ASCII slug, original kept in `sourceHandle`.
- `trending` collection populated from the live store (4 products, verified 2026-10-24).
- Health endpoints share the `{ data: … }` envelope.
- Collection pages are now **static** (9 SSG) with client-side sort/price filtering and shareable URLs;
  PLP HTML dropped to 101KB raw / 15KB gzip.
- Fixed broken sort dropdown (options pointed at non-existent sort keys: `price-asc`, `best-selling`).
- Removed the fake "filled" saree/wedding collections — empty collections now show an honest state and
  are `noindex` + excluded from the sitemap.
- API production build is an esbuild bundle (`dist/server.cjs` + `dist/worker.cjs`) — `tsc` had `noEmit`,
  so `node dist/server.js` could never have worked on Render.
- `data-testid` hooks added (product card, size options, add-to-cart, cart drawer, search, checkout, order number).
- Health endpoints share the `{ data: … }` envelope; docs aligned with the real API (`quantity`, flat customer
  fields, `price-low/price-high/discount` sort keys, 400 vs 409 codes).
- Customer-facing images render through `SafeImage` — a blocked/slow CDN now degrades to the brand
  placeholder instead of a broken icon (preview sandboxes fail Shopify CDN TLS).
- Security headers completed: HSTS on web + admin, CSP in report-only mode, `/api/health` and
  `/api/v1/health` share the same envelope.
- `allowedDevOrigins` added to both Next configs so sandbox/preview hosts can load HMR assets.
- New: 73 tests, smoke suite, Playwright spec, CI + deploy workflows, infra scripts,
  15 skills, 6 agent guides, root README/STRUCTURE/AGENTS/CLAUDE, docs 04–11.

## Round 2 — owner feedback (2026-10-24)

- **Colour merge:** same design ke different colours ab ek PDP me (10 designs / 20 colourways).
  Listing par sirf representative card (287 products → 277 cards), PDP par swatch switcher +
  `history.replaceState` (share karne par wahi colour khulta hai). Card par colour dots.
- **Size-wise pricing:** XL +Rs 100, 2XL +200, 3XL +300, 4XL +400, 5XL +500 (MRP se upar nahi jaata).
  PDP par live price + savings, cart/checkout/invoice usi price par.
- **Add to cart:** naya line cart me sabse **upar** (pehle niche add hota tha), "Just added" chip,
  drawer top par scroll, header par count.
- **Copy cleanup:** home ka "287 styles, one wardrobe" band + "Shop new arrivals" CTA hataya;
  payment badges (Visa/Mastercard/UPI/Rupay/COD) hataye; **prepaid only** — COD radio, COD fee,
  "COD under Rs. 3,500" ke saare strings (header, drawer, cart, policies, meta) hataye.
- **Remove controls:** cart page (icon button), checkout summary, order summary — teeno jagah item
  delete. Cart line par size + colour.
- **GST invoice:** PDF Amazon-style — maroon masthead + ORIGINAL FOR RECIPIENT, sold-by/GSTIN,
  invoice meta, billing + shipping boxes, HSN/qty/rate/taxable/GST%/CGST-SGST table, rate-wise tax
  summary, invoice total band, amount in words, declaration + authorised signatory, page x of y.
  HTML invoice bhi same layout me.
- **Descriptions:** emoji (🏻 skin tones samet) + copyright NOTE + `*markers*` strip — bullet copy
  saaf, `*FABRIC*` → **bold**.
- **Search:** typeahead suggestions (curated + live colours/fabrics), "Recommended for you" jab
  query khaali, "You may also like" jab result zero, search page par related searches + fallback grid.
- **Responsive:** 16px inputs on phones (iOS zoom fix), hover-only card CTA mobile par visible,
  touch devices par hover transform off, `overflow-x: clip`, tablet container padding.
- Docs/policies updated: shipping, terms, refund — COD ki jagah prepaid.

## Next up

1. `npm run catalog:sync-live` (internet) → full galleries + store descriptions → `catalog:verify` → deploy.
2. Razorpay live keys + webhook → test Rs. 1 payment → refund.
3. Final price spot-check (10 random products) with the owner.
4. ~~Homepage hero copy for Diwali/November 2026~~ — done (Diwali 2026 copy + dispatch cutoff).
5. Go-live checklist (`docs/10-deployment/go-live-checklist.md`).

## Round 14 — brand + pre-domain pass (2026-10-24)

- **Brand:** site naam `Designer Clothing`; owner ka final logo local assets me —
  `logo-mark-128/192/512.png` (header badge, footer, favicon/Apple icon, PWA 512, invoice),
  `logo.png` + `logo.webp` (lockup), `og-image.jpg` (1200×630). Ek hi component:
  `apps/web/src/components/brand-lockup.tsx`.
- **Hero:** `diwali-sale-70-2026.webp` (Diwali poster, mobile full + desktop panel, base-path safe).
- **One env:** domain badalne par sirf `NEXT_PUBLIC_SITE_URL` — canonical/OG/`metadataBase`,
  sitemap, robots, product JSON-LD offer URL, UPI callback aur WhatsApp order link sab isi se.
  Product JSON-LD aur UPI callback se cloned-site URL (`likshaclothing.com`) hata diya.
- **CORS:** Pages static preview se `POST /api/orders`, `/api/payments/manual`,
  `/api/payments/failed` aur `GET /api/settings` Render par cross-origin jaate hain
  (`apps/web/src/lib/cors.ts`, allowlist + preflight, koi `*` nahi). `STORE_API_URL` set hone
  par Pages par order sach me banta hai (pehle browser block karta tha).
- **Sheet ready:** `Designer Clothing — Store (Orders · Payments · Settings)` — 5 tabs,
  headers + settings values bhare hue, owner email par Editor access. Link + setup:
  `docs/09-devops/google-sheets.md`.
- **Reviews:** sirf customer photos (product gallery ki image review me nahi) —
  151 products / 1690 reviews / 147 photo reviews / 252 unique photos.
- **Env checklist:** `docs/09-devops/domain-and-brand.md` §3 (Render vars, GitHub `STORE_API_URL`,
  DNS/SSL, domain ke baad verification curl).
- Verified: `npm run test:unit` → 84 pass, smoke → 82/0, Pages preview + CI green.
