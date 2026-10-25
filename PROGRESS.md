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

## Round 15 — responsive logo, hero aur header (2026-10-24)

Owner ka master prompt: har screen par professional logo/header/hero, device-specific assets.

- **Asset pipeline:** `scripts/brand/build-responsive-assets.mjs` — owner ke original files
  (`assets/source/`) se sirf crop/trim/resize/WebP. Header logo unki hi wide banner ke header
  se crop hota hai (flat version jo mockup me hai), favicon/invoice official 3D mark se.
- **Logo:** `brand/logo-mobile.png` (<768), `logo-tablet.png` (768–1023), `logo-desktop.png`
  (≥1024), `logo-fluid.png` (stacked, footer/invoice), `logo-mark-{128,192,512}` — ek hi
  `<picture>`, browser sirf ek file download karta hai. Header me logo mobile par centre
  (`grid-cols-[auto_1fr_auto]`), desktop par left — kabhi overlap nahi.
- **Hero:** `banners/banner-mobile.webp` (860×1290 portrait), `banner-tablet.webp`
  (1200×900, poster + blurred backdrop — kuch crop nahi), `banner-desktop.webp`
  (1779×594, baked carousel arrows side-trim se hataye), `banner-fluid.webp`.
  Har box ka `aspect-ratio` file ke ratio ke barabar → stretch/crop/CLS zero.
- **Header:** announcement bar 3-part (phone / shipping / tagline), nav labels chhote
  (SHOP · ANARKALI · LEHENGA CHOLI · PRINTED SET · NEW IN · SALE · CONTACT), naya
  `/collections` landing (SHOP link pehle dead tha), SAREES dead link hata diya.
- **Checkout UPI:** GPay/PhonePe/Paytm/BHIM/Amazon Pay ke alag buttons hata diye — sirf
  QR + UPI ID + Open UPI app + Copy.
- **Socials:** Instagram sirf URL text (`designer_clothing_9`), WhatsApp hi working link;
  Facebook/Pinterest dummy links removed.
- **Tests:** `tests/e2e/responsive.mjs` (39 checks) + `tests/e2e/breakpoints.mjs`
  (18 viewports, 48 checks) — CI me add; smoke 86/0, unit 89/0.
- **Proof sheet:** `docs/assets/responsive-proof.png` (`npm run assets:proof`) — asli assets
  + asli CSS heights se 320 se 1920 tak ka header+hero.
- Docs: `docs/05-design/responsive-assets.md`.

## Round 16 — audit, trust fixes, DB replies aur speed (2026-10-24)

Owner ka full-site audit prompt. Sabse pehle code/data inspect kiya, phir fix + test.

- **Reviews (trust):** 1,273 generated sample reviews (`seed-reviews.json`) poore hata diye —
  public page par sirf asli Trustoo reviews. "Verified buyer" badge sirf `verified === true`
  par; rating 0 wale aggregates par stars/average hide, JSON-LD `aggregateRating` sirf real
  rating par (schema valid). Sync script aggregate rating 0 ho to asli reviews se average
  nikalta hai.
- **Stock:** sold-out product/size ka add-to-cart + buy-now disabled (card + PDP), server
  `createOrder` par bhi 409 — UI bypass karke bhi kharid nahi ho sakta.
- **Prepaid only:** API `paymentMethod: "cod"` ab 400 deta hai (pehle server COD accept
  karta tha jabki site prepaid-only thi).
- **Routes:** `/pages/size-cheart` → 200 alias (canonical `size-guide`), naya
  `/collections/wedding-collection` (canonical `weddin-collection`), saree nav me nahi,
  unknown product/collection 404, order not-found ka apna page ("Order nahi mila" +
  WhatsApp), order numbers case-insensitive.
- **Batch/checkout detail:** contact messages me `replied` flag (migration 0006, API,
  admin mark/undo, sheet status), best sellers ab asli orders ki quantity se rank hote hain.
- **Speed:** collection me agla page prefetch (idle + 900px pehle), Pages preview par
  `catalog-lite.json` se client-side pagination (pehle "load more" preview par fail tha).
- **Copy:** "Up to 70% OFF" (60% + 70% dono hain), `CUSTOMER SUPPORT`, admin title
  "Designer Clothing Admin", PDP shipping copy prepaid-only.
- **Tests:** naya `tests/e2e/round16.mjs` (37 checks) + `tests/e2e/links.mjs` (45 pages
  crawl) CI me; smoke 86/0, responsive 40/0, breakpoints 48/0, unit 89/0.
- Docs: `docs/08-testing/round16-audit.md` (issues, decisions, verification matrix).

## Round 21 — checkout se UPI hataya, payment step 3 par apps, funnel DB + Sheet (2026-10-25)

Owner ne dobara pakda: "address wale par place order karte hi UPI/QR code aa jata hai — wo sirf
payment ke 3rd step par aana chahiye." Wo purana fallback block tha (order server par save na
hone par), aur Pages preview ka API base purana dead Render URL tha.

- **Checkout:** UPI QR/UPI ID/"Send order on WhatsApp" block **poora hata diya** (copy bhi), order
  place hote hi `…/pay?pay=1` (step 3). Fail par sirf Try again + WhatsApp help (UPI ke bina);
  static preview par live-store checkout link. `pages.yml` ka API base ab Vercel production.
- **Payment page:** Google Pay / PhonePe / Paytm / Any UPI app deep links (amount + order note
  bhara hua), QR, Copy UPI ID, Check status; status auto-detect 5–6s polling + focus/visibility.
- **Funnel:** `checkout_events` table (migration 0007) + `POST /api/checkout/events`,
  `GET /api/admin/checkout-events`; events — started / review / order.placed / order.failed.
  Google Sheet me naya **Checkout** tab; admin Orders page par funnel card + last failures.
- **Tests:** unit 95/0 (checkout par UPI nahi, `?pay=1`, UPI app links), payments E2E 34/0
  (apps, tracking case-insensitive, order not-found, funnel API), responsive 43/0.
- Docs: `docs/08-testing/round21-audit.md`.

## Round 22 — payment page par ek "Open UPI app", contact details Sheet se, order title sach (2026-10-25)

R21 ke live verification ke baad teen cheezein tight kee gayin (koi naya feature nahi):

- **Payment page (step 3):** GPay/PhonePe/Paytm/BHIM ke alag buttons hata diye — ab ek hi
  "Open UPI app to pay ₹499" (`upi://pay`), phone khud chooser dikhata hai. QR, Copy UPI ID,
  "status check kariye", 5–6s auto detect (success/failed/pending) waisa hi hai.
  `lib/upi.ts` se `upiAppLinks` bhi hataya (dead code + brand names).
- **SEO / contact:** Organization JSON-LD me phone/email hard-coded the — ab
  `StoreStructuredData` se owner ki settings (admin/Sheet) se aate hain, `@id` merge ke saath.
- **Order page title:** pehle har order page "Order confirmed" kehta tha (pending payment par bhi);
  ab payment status ke hisaab se title, aur galat number par HTTP 404 + "Order nahi mila".
- Docs: `docs/08-testing/round22-audit.md` (verification matrix + local suites 95/40/9/35/87/43/37).

### Round 22b — production 500 ka asli root cause: DB pool

- `payments` ka global unique (provider, gateway_payment_id) hata kar per-order kar diya
  (migration 0008) — ek UTR doosre order par daalne se 500 aata tha. Ab 409 with saaf message.
- Vercel par har instance 5 DB connections kholta tha, Supabase session pooler ~15 deta hai →
  `EMAXCONNSESSION max clients reached` → order page + UTR submit 500. Ab serverless par
  pool 1 + idle release + transient retry.
- Live verify: health `db: up` (`commit 69f9e58`), `/orders/LK-DOESNOTEXIST` → 404
  "Order nahi mila", live smoke **28/0**.
- Owner report (Hinglish): `docs/00-overview/owner-report-round22.md`.
- Admin production bhi `b83b07b` par deploy (funnel card + checkout events live).

## Round 23 — state↔pincode, fast payment page, sheet wapas chalu, admin numbers clickable (2026-10-25)

Owner ke 5 asks, sab ek hi round me:

- **State ↔ pincode:** naya `apps/web/src/lib/state-match.ts` (36 states/UTs + alias:
  J&K / Orissa / Pondicherry / Uttaranchal). `checkout-form.tsx` mismatch par step 1→2 roktа hai
  aur **ek tap me sahi state** bhar deta hai (`data-testid="state-mismatch"` / `"state-fix"`).
  Server bhi mana karta hai — `createOrder` me `state_mismatch` (400) taaki GST place-of-supply galat na jaye.
- **Speed (payment page + order create):** DB mode me order fetch = **1 row** (`orders-pg.loadOrder`,
  pehle poora table padhta tha), order create = **1 upsert** (`saveOrders(new Map(), [order])`) aur
  Google Sheet sync `after()` me background — customer ko sheet ka wait nahi. Pay page + order page
  `Promise.all([getOrder, getStoreSettings, headers()])`. Sheet read timeout 5s → 2.5s. UPI auto-open 600ms → 250ms.
- **Step 3 (payment):** UTR **ya sirf phone ke last 4 digit**, naya `POST /api/payments/claim` (202,
  `paymentStatus: processing`, audit `payment.claimed`) + button "UTR nahi mila — payment hui hai"
  (`data-testid="upi-claim"`). WhatsApp screenshot link har haal me dikhta hai (`data-testid="upi-whatsapp-screenshot"`).
- **Sheet wapas chalu:** `scripts/google-apps-script/liksha-sheets.gs` v2 — naye sheet account ke liye,
  gid-aware tabs, **header naam se column mapping** (column order badle to bhi data sahi jagah),
  missing header auto-add, `setup()` / `testAppend()` / `health` / `settings_save`, LockService 20s.
  Owner ke liye step-by-step: `docs/00-overview/sheet-setup-owner.md`.
  Bonus: Apps Script deployment ke bina bhi settings live — `GOOGLE_SHEETS_SETTINGS_CSV_URL` (published CSV).
- **Admin:** har phone number **clickable** (`tel:` + `wa.me`) — dashboard, orders list, order detail,
  customers, messages (`apps/admin/src/components/contact-links.tsx`). Customers page par
  `?phone=` se **customer detail** (lifetime value, saare orders, address) + inline **edit**
  (`PATCH /api/admin/orders/:no {action:"contact"}` → audit `order.contact_updated`).
  "New order" par customer ki purani details prefill.
- **Tests:** unit **114/0** (naya `tests/unit/round23.test.ts`, `tests/unit/apps-script.test.ts` — Apps Script
  ko fake Google Sheets par chala kar rows/settings verify), e2e `tests/e2e/round23.mjs` **31/0**,
  payments 35/0, smoke 87/0, links 40/0, responsive 43/0, round16 37/0, breakpoints 48/0.

### Round 23 — verification & delivery

- **CI green:** typecheck · build · test · production-build smoke (`40156640414`).
- **Live:** store + admin `8c60324` deployed; health `db: up`, products 446.
- **Live automated flow:** `payments` 28/0, naya `round23` 18/0 (state guard 400, order create/pay/tracking <2s,
  claim 202 → processing, WhatsApp screenshot, galat last-4 par 403).
- **Local:** unit 114/0, integration 40/0, db 9/0, payments 35/0, smoke 87/0, links 40/0, responsive 43/0,
  round16 37/0, breakpoints 48/0, round23 31/0.
- **Bug fix jo tests ne pakda:** `after()` request scope ke bahar throw karta hai → `runInBackground()` helper
  (test/CLI me fire-and-forget).
- **Sheet ki asli wajah:** Vercel project me `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` env hi nahi hain
  (confirm kiya env list se) — owner se naya `/exec` URL + token chahiye.
- Docs: `docs/00-overview/owner-report-round23.md`, `docs/00-overview/sheet-setup-owner.md`, `docs/08-testing/round23-audit.md`.

### Round 23c — sheet identify + tabs ready, step-3 polish, pay page par settings budget (2026-10-25)

- **Sheet pehchaan:** owner ne jo `pub?output=csv` links diye the wo **purane account ki copy** ke hain
  (gid 1135948941/1261780310 naye file me nahi). Asli sheet: `1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo`
  ("Designer Clothing — Store", account `prakashgothwal370@gmail.com`).
- **Tabs ready:** us sheet me `Checkout` (8 columns) aur `Audit` (5 columns) tab + header rows bana diye —
  baaki 5 tab pehle se the. Script ke `GIDS` asli sheet id par set, aur naya `SPREADSHEET_ID` var
  (standalone script bhi chalega).
- **Step 3 polish:** UTR khaali + last 4 digit bhare ho to submit **khud claim** kar deta hai
  (customer ko samajhna nahi padta); labels Hinglish me ("Payment ho gaya — submit kariye",
  "UTR nahi mila? Last 4 digit se submit", WhatsApp screenshot); submit timeout 20s → 12s.
- **Speed:** pay/order page par settings ka **700ms budget** (`getStoreSettingsFast`) — Sheet slow ho to
  bhi page atakta nahi, env fallback (UPI id/phone) se render hota hai aur cache background me garam hota hai.
- Local: unit 117/0, e2e payments 35/0 · smoke 87/0 · links 40/0 · responsive 43/0 · round16 37/0 ·
  breakpoints 48/0 · **round23 23/0** (order create 6ms · pay page 36ms · tracking 14ms).

### R24 — owner ke liye code map + live verify (2026-10-25)

- **Naya doc: `docs/00-overview/owner-code-map.md`** — owner ka ask *"ye sab kahan hai code mai, mai
  manually daalunga"* ka poora jawab: har feature ka **exact file + function**.
  Isme: storefront page↔file table, price/catalog chain (`database/seeds` → `apps/web/src/data/catalog.json`
  → `lib/store.ts`), Settings tab ke keys, checkout+order create ka rasta, step-3 payment
  (UTR / last-4 / WhatsApp screenshot) ka rasta, sheet ke **7 tab + exact columns**, Apps Script
  write path (`appendSheetRows` → `doPost` → `appendRows_`), admin ke saare pages + server actions
  (order detail/edit, payment verify, invoice, delivery block), GST invoice, reviews, SEO, pincode,
  env vars, DNS.
- `owner-report-round23.md` §2 — sheet ki **asli pehchaan** (id + link + "purane account ki copy" warning)
  aur aaj bane `Checkout`/`Audit` tab + real gids.
- Live verify: `/api/health` → `commit: ded0125`, `db: up`, 446 products.
  Live flow (`[live-test]`): payments 28/0, round23 18/0,
  **order create 1961ms · pay page 331ms · tracking 458ms** (CI runner → Vercel network + lambda cold start;
  local same pages 6 ms / 36 ms / 14 ms).
- Admin clickable-number audit: `PhoneLinks` (call + WhatsApp) dashboard/orders/customers/messages par,
  order number → `/orders/[id]` jahan contact edit + status + tracking + payment verify sab hai — **confirm**.

### R24b — sheet write ka asli bug pakda (copy-sheet) — 2026-10-25

**Kya mila:** owner ne Apps Script deploy kar diya (`/exec` Zinda, token OK, reply JSON). Lekin
sheet khaali thi. `scripts/google-apps-script/liksha-sheets.gs` ka `book_()` sabse pehle
`SpreadsheetApp.getActiveSpreadsheet()` dekhta tha — yaani "jis sheet ke saath script bana hai".
Owner ka script `prkigothwal@gmail.com` se bana hai aur kisi **copy** ke saath bound hai, isliye
site ke saare rows (Orders/Payments/Checkout) us copy me ja rahe the, asli sheet me nahi.

**Saboot:** script ke `action=health` ne bataya `Orders: 1, Payments: 1, Checkout: 1` rows —
aur `1k8fsea04…` sheet me us waqt 0 rows. (Self-test ne `written: 1` bhi diya, par row copy me.)

**Fix (code):**
- `book_()` ab **`SPREADSHEET_ID` pehle** dekhta hai, phir active, phir Script Property `SHEET_ID`;
  permission fail ho to saaf error ("is Google account ko Editor access dijiye").
- `action=health` ab `spreadsheetId` + `spreadsheetUrl` bhi deta hai.
- `apps/web/src/lib/google-sheets.ts` → `EXPECTED_SHEET_ID`, `readSheetHealth()`;
  `GET /api/admin/sheet` → `health`, `expectedSheetId`, `sheetMismatch`.
- Admin → Google Sheet page par **loud mismatch warning** (script doosri sheet pakde ho to).
- Naya key-gated `/api/sheet-selftest` (env `SHEET_SELFTEST_KEY`) — read + write dono ka asli
  jawab JSON me (status, redirect, timing). Isse debugging browser se hoti hai.
- `tests/unit/apps-script.test.ts` mock book me `getId`/`getUrl` (117 unit tests green).

**Baaki:** owner ko naya code paste + **New version** deploy karna hai (tab hi id wali sheet me
likhega). Uske baad `/api/sheet-selftest` + connector se row confirm karna hai.

### R25 — sheet: owner apna Apps Script khud set karega; code + self-check ready

- **`docs/00-overview/apps-script-code.md`** = poora code (auto-generated from
  `scripts/google-apps-script/liksha-sheets.gs`, 424 lines) + 9 steps + env var table.
- `book_()` ab **bulletproof**: `SPREADSHEET_ID` → Script Property `SHEET_ID` →
  hardcoded `SHEET_ID_FALLBACK` → active sheet. `typeof` guard ki wajah se agar
  constant delete bhi ho jaye to script crash nahi karti (owner ke edit se
  `ReferenceError: SPREADSHEET_ID is not defined` aa raha tha).
- `scripts/sheets-selfcheck.mjs` ab **galat sheet** bhi pakadta hai
  (`health.spreadsheetId` vs expected id) + mock server par test kiya:
  sahi sheet → sab ok; copy sheet → FAIL + exact fix; galat token → FAIL.
- `appendSheetRows` ab Apps Script ka `{ok:false,error}` **HTTP 200 ke saath** bhi
  fail maanta hai (pehle chup-chaap success dikhta tha — "sheet me row nahi aayi"
  ka pata hi nahi chalta).
- `whatsappNumber()` (naya `lib/phone.ts`, pure) — 10-digit number par `91` lagta hai;
  pehle contact page ka "WhatsApp us" button `wa.me/8005900581` (invalid) bana raha tha.
- `.github/workflows/keep-warm.yml` — har 10 min me 4 halke requests (health, home,
  checkout, orders) → serverless cold start kam, step-3 payment page turant.
- Live verify: contact form DB me save hota hai (`/api/sheet-selftest?message=1`
  → `rowInDb: true`); sheet write sirf owner ke Apps Script deploy par depend hai.
- Published CSV (`pub?output=csv`) abhi bhi Google ki taraf se HTTP 500 deta hai —
  isliye settings ka fallback = code defaults (phone/UPI sahi) + admin panel.
