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
  J&K / Orissa / Pondicherry / Uttaranchal). `checkout-form.tsx` mismatch par step 1→2 rokta hai
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

### R25 — live audit + sheet ka sach (maine khud dekha)

- **Site-wide audit workflow** (`.github/workflows/live-audit.yml`, commit message me
  `[audit]`) — production par chala: `smoke` (order → pay → GST invoice → track →
  contact → newsletter), `links` (40 pages), `round16`, `round23` — **sab steps success**.
  Sirf admin-only steps skip hue (unke liye `ADMIN_API_TOKEN` secret chahiye).
- **Asli sheet (`1k8fsea04…`) seedha Google API se padhi**: Orders / Payments / Messages /
  Checkout / Audit — **sab me sirf header, 0 data rows**. Settings tab me sahi
  values (phone, UPI) hain.
- Matlab: website ka **DB save chal raha hai**, par **sheet mirror abhi tak 0** — kyunki
  owner ka Apps Script purana code chala raha hai (`{ok:false,"ReferenceError:
  SPREADSHEET_ID is not defined"}`, HTTP 200 ke saath).
- Isliye `.gs` me **`CODE_VERSION = 'r25-1'`** add kiya — `?action=health` ab batata hai
  kaunsa code chal raha hai; `sheet-selftest` bhi `book.codeVersion` dikhata hai.
- `readSheetSettings` me: Apps Script fail → **published CSV fallback** (pehle sirf null).
- `writeSheetSettings` me: HTTP 200 + `{ok:false}` bhi fail (pehle success dikhta tha).
- `docs/00-overview/sheet-setup-owner.md` me **self-check table** (owner khud 30 second me
  verify kare) + aaj ka exact test result.
- Domain ka sach: `www.likshaclothing.com` = purana Shopify store (hamara nahi) — DNS
  chhua nahi. Vercel par apna domain add karne ke liye owner se naam chahiye.

### R25 — owner report + admin production deploy

- `docs/00-overview/owner-report-round25.md` — 5 sawaalon ka jawab (domain, message,
  sheet, functions, free plan) + exact owner steps.
- Admin production naye commit se deploy: `liksha-admin` (production alias
  `liksha-admin.vercel.app`) — pehle 8c603243 par tha.
- Live verify (cache-bust ke saath): `commit dd6ecb8`, contact page ke **8/8** WhatsApp
  links `wa.me/918005900581`, `/api/sheet-selftest?...&stats=1` →
  `orders 53 · paidOrders 0 · messages 3 · checkoutEvents 33`, `write` abhi bhi
  `ReferenceError` (owner ka deploy pending).
- Note: `fetch_page` same URL ka **purana response cache** karta hai — verify karte waqt
  `?v=<sha>` lagayein, warna purana HTML dekhkar galat nateeja aata hai.

### R27 — logo center · GSC · traffic analytics · contact refresh · sheet ka asli karan

- **Logo center:** header desktop `lg:grid-cols-[1fr_auto_1fr]` (logo `col-start-2`),
  footer lockup center. Mobile pehle jaisa center.
- **GSC:** `layout.tsx` me `verification.google` meta + `public/googleb3b0e3defc1daa17.html`
  (dono method, owner ne jo file di thi wahi).
- **Traffic:** naya `components/analytics.tsx` — Vercel Web Analytics + Speed Insights
  (`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`) + optional GA4
  (`NEXT_PUBLIC_GA_ID`). Dashboard me Analytics "Enable" karna owner ka 1-click kaam.
- **Contact:** success par `router.refresh()` + "Send another" (form turant reset).
- **Admin:** `components/auto-refresh.tsx` (15s, tab visible ho tab) messages page par;
  message ka naam → customer detail link; message par click → poora text.
- **Sheet blocker ka exact karan (aaj proof hua):** Vercel ke env me jo
  `GOOGLE_SHEETS_WEBAPP_URL` pada hai wo `AKfycbwIJ1ge…` deployment hai jo
  **Google ka login page (HTML)** laut raha hai → deployment ka access "Anyone" nahi
  (ya wo purana/dead hai). Isliye `sheetMirror:false`. Selftest ab
  `urlDeployment` (id ka 12-char prefix) bhi dikhata hai taaki owner compare kar sake.
- **Payment step ki speed:** `getStoreSettingsFast` budget 700ms → **350ms**,
  sheet read timeout 2.5s → **900ms**. Sheet slow ho to bhi step 3 turant.
- **Cold start:** `.github/workflows/keep-warm.yml` — 5 min cron par 5 halke pages
  (GitHub Actions public repo par free).
- **Naya live test:** `tests/e2e/round27.mjs` (logo grid classes, GSC meta + file,
  analytics scripts 200, contact POST + DB save + sheet mirror ka sach) —
  `live-audit.yml` me step add.

- **Deploy (R27):** web production = `dpl_8meNZY…` (commit `c301ba5`), admin =
  `dpl_3HB9…` (commit `f6a985a`). Repo HEAD `fbe590b` me 2 cheezein extra
  (mobile exact-center header + traffic counter) — **aaj deploy nahi hui** kyunki
  Vercel Hobby ki 100 deployments/day limit poori ho gayi (402
  `api-deployments-free-per-day`, UTC midnight par reset).
- **Live proof (R27):** `live-audit.yml` (run 40166981069) — saare steps pass:
  smoke, links (0 404), round16, round23, round27; contact page ke saare
  WhatsApp links `wa.me/918005900581`; `/api/health?v=…` → `commit c301ba5`,
  `db up`, 446 products.
- **Sheet ka sach:** selftest `read` = Google ka bot/login HTML (`scriptHint`),
  `urlDeployment: AKfycbwIJ1ge…`, `write` HTTP 200 par JSON `{ok:false}` →
  owner ka purana Apps Script code chalu hai. Asli sheet (`Designer Clothing —
  Store`) me Orders/Payments/Messages me **0 data rows** — website ki taraf se
  sab taiyaar hai, script deploy hona baaki.
- **Naya (repo, deploy pending):** `lib/traffic.ts` + `app/api/track` +
  `components/page-view-tracker.tsx` + admin `/traffic` page (first-party
  page-view counter, koi dashboard toggle nahi), aur mobile header bhi exact center.

### R27 (b) — Apps Script v3 (1387 lines, 16 tabs) + naye sheet mirrors

- `scripts/google-apps-script/liksha-sheets.gs` poori dobara likhi gayi: 16 tabs
  (Settings, Dashboard, Orders, OrderItems, Payments, Invoices, Shipments, Checkout,
  Messages, Newsletter, Reviews, Coupons, Inventory, Audit, Errors, Sync), 10 GET +
  11 POST endpoints, token/lock/header-repair/dedupe, batch `setValues` write,
  `Errors`+`Sync` logging, owner functions (`setup`, `testSelf`, `testAppend`,
  `repairHeaders`, `backupNow`, `installTriggers`).
- Web: `sheet-format.ts` me `orderItemSheetRows` / `shipmentSheetRow` / `invoiceSheetRow`;
  `google-sheets.ts` me SheetName union + `syncShipmentToSheet` + `syncInvoiceToSheet`;
  `order.placed` par OrderItems rows, tracking update par Shipments, GST invoice par
  Invoices — ye tabs bhi ab bhar rahe hain.
- Docs: naya `docs/00-overview/apps-script-setup-steps.md` (step-by-step + troubleshooting
  table), `apps-script-code.md` export se sync, purane doc me banner.
- Tests: **137 pass / 0 fail** (16 naye: v3 tabs, column contract, order_update,
  invoice_save, stock_update, coupon upsert, review/subscribe dedupe, message_status,
  doGet stats/search/order, galat token par block).

### R27 (c) — permission fix ke baad: messages live, payment page simple, sheet columns fix

- **Sheet ab kaam kar rahi hai** (owner ne Share kar diya): live selftest →
  `message.sheetMirror:true`, `Messages` tab me 10 rows, `Sync`/`Checkout`/`Newsletter` bhi bhar rahe hain.
- **Script v3.1:** `book_()` ab sheet na khulne par **khud nayi sheet bana leta hai**
  (Script Property `SHEET_ID` me save) — "Sorry, unable to open the file" wala jhanjhat khatam;
  naya function **`createOwnSheet`** (isi account me nayi sheet + 16 tabs + formatting),
  **`formatAll`** (columns width/wrap dobara), `COLUMN_WIDTHS`/`WRAP_COLUMNS` map se har tab
  ki fixed width + freeze header + ₹/date format + filter dropdown.
- **Payment page simplify (owner ask):** UTR input **hata diya**, sirf "mobile ke last 4 digit"
  + ek button **"Payment ho gaya — confirm kariye"**; lambe paragraphs hataye, screenshot link
  chhota; mobile par UPI app se wapas aane par order khud confirm (`payments/return`).
- Tests: **145 pass / 0 fail**.

### R27-3 (Pages order/payment fix · email removed · demo data)
- [x] GitHub Pages `/orders/…` + `/pay` — `404.html` shell + public order API + live-store fallback
- [x] `/api/orders/:n/payment` par CORS (Pages par status polling)
- [x] support email site/API/policies/invoice se poora hata (sirf WhatsApp)
- [x] `seedDemoData` → 16 tabs (Settings bhi), real-jaisa data, `clearDemoData`
- [x] script v3.2 (`CODE_VERSION r27-2`), docs export, tests **151 pass / 0 fail**
- [ ] Vercel production deploy (free-plan daily limit khatam — baad me)

### R28 — Netlify shift (code + guide)
- [x] `apps/web/netlify.toml` + `apps/admin/netlify.toml` (Next runtime, package dir setup, headers)
- [x] `db.ts` / `data-dir.ts`: Netlify (Lambda) par bhi serverless mode — pool 1, data `/tmp`
- [x] CORS: `*.netlify.app` (production + deploy previews) allowed
- [x] CSP se Razorpay hata (koi gateway nahi), `.env.example` saaf (DB + sheet + UPI, koi email nahi)
- [x] `pages.yml`: `vars.STORE_API_URL` (Netlify URL ek variable se switch)
- [x] **`docs/00-overview/netlify-shift-guide.md`** — dono sites ki settings, 12+7 env, saare functions ka naksha, domain DNS, troubleshooting
- [x] tests **159 pass / 0 fail**

### R29 — top skill repos ke hisaab se audit (Superpowers / Karpathy / Ponytail / Graphify / Agent Skills)
- [x] `scripts/repo-audit.mjs` — measurable scorecard: skills format, instruction files ka sach,
      hygiene (any/TODO/console/secret/email/gateway), API route → test map, CI gates
- [x] 5 nayi skills: `brainstorm-plan`, `systematic-debugging`, `minimal-diff`,
      `typescript-discipline`, `netlify-deploy` (total 20)
- [x] `CLAUDE.md` sachcha: 446 products / 11 collections, UPI only (Razorpay claim hataya), 20 skills
- [x] `AGENTS.md`: 5-step loop (plan → minimal diff → implement+test → debug → verify)
- [x] `tests/unit/api-contracts.test.ts` (7 routes ka security contract) + `tests/unit/repo-audit.test.ts`
- [x] route map 28/35 → **35/35**; tests 160 → **174 pass / 0 fail**
- [x] CI me `npm run audit -- --check` gate
- [x] Report: `docs/00-overview/skill-repos-benchmark.md`, generated: `docs/00-overview/repo-audit.md`


### R30 — Vercel live + payment (last-4) + lint fix
- [x] Vercel **production deploy** owner ke apne account se (`liksha-clothing`, alias
      `liksha-clothing.vercel.app`) — `dpl_3gg9…` @ `275d3c6`, `/api/health` → `db: up`, 446 products
- [x] Payment copy: customer-facing text se **UTR poora hata** (sirf mobile ke last 4 digit +
      "Payment ho gaya — confirm kariye"); WhatsApp note = screenshot → team UPI statement se match
- [x] `tests/e2e/payments.mjs` ab asli customer raasta test karta hai: galat last-4 → **403**,
      sahi last-4 → **202 claim_submitted**, status `processing`, order `placed` (paid nahi)
- [x] **eslint crash fix**: `eslint.config.mjs` FlatCompat (`Converting circular structure to JSON`)
      → native `eslint-config-next` 16 flat config; lint **0 errors** (30 warnings) + CI gate
- [x] `product-grid-client.tsx`: render ke andar ref write (`react-hooks/refs`) → `useEffect` sync
- [x] 3 dead helpers hatae (`inr`, `rupee`, `TOKEN_SECRET`) — dead code zero
- [x] Local prod build par verify: unit **174/174**, typecheck ✓, build ✓, payments e2e **37/37**,
      smoke **84/84**, round16 **37/37**, breakpoints **48/48**, links 45 pages 0 fail
- [ ] Vercel par `OTP_DEV_MODE=off` + redeploy (last-4 patch live karne ke liye)
- [x] SEO: wedding collection ka canonical clean URL (`/collections/wedding-collection`),
      typo URL (`/collections/weddin-collection`) bhi khulta hai par canonical ek hi;
      sitemap me duplicate URL zero (467 loc, pehle `new-arrivals` do baar tha)
- [x] Admin production owner ke account se live @ `33afaea` — `NEXT_PUBLIC_STOREFRONT_URL`
      env add kiya (invoice button pehle localhost par jaata tha)

### R31 — Tracking perfect + `manoj-Product` sheet script analysis
- [x] `apps/web/src/lib/tracking.ts` — 5-step timeline (har step ki date), update history,
      **courier link khud** (13 courier: Delhivery/Blue Dart/DTDC/India Post/Ekart/XpressBees/
      Shadowfax/Ecom/Shiprocket/Professional/Amazon/FedEx/DHL), AWB cleaning
- [x] Order page: per-step dates + `tracking-updates` history + `tracking-stopped` banner
      (cancelled/returned) + phone/email **masked** + "Track with courier" (admin URL optional)
- [x] `setTracking()` — AWB saaf + URL khaali ho to khud bane (sheet/Shipments tak wahi link)
- [x] Admin: courier dropdown (13) + "link khud ban jaayega" hint
- [x] Sheet script **`r31-1`**: `?action=timeline` (order + phone gate), `seed`/`clear-demo`,
      courier link helper, `updateMessageFor_`; doc export + setup guide sync
- [x] `manoj-Product` (`arena/e13f4af5-manoj-product`) ka `trends-sheets.gs` (5,892 lines)
      padha — report: `docs/00-overview/owner-report-round31.md`
- [x] Tests **189 pass / 0 fail** (14 tracking + 1 sheet timeline), payments e2e **53/0**,
      smoke **84/0**, round16 **39/0**, responsive **43/0**, breakpoints **48/0**

### R32 — payment page callout highlight + invoice download band (sirf tracking)
- [x] Payment page: "Order details dekhein" ab **highlight button** (`order-details-callout`),
      saaf line "payment ke baad aage badhne ke liye **yahin click kariye**"
- [x] Customer order page se GST invoice block hata diya (`apps/web/src/lib/features.ts`
      → `customerFeatures.invoice = false`); PDF/API + admin button jaisa tha waisa
- [x] Tests: `tests/unit/features.test.ts` (7) + payments e2e 4 naye checks (57),
      smoke 85 (invoice-link check ulta ho gaya); round16 39, responsive 43, breakpoints 48, links 45

### R33 — domain `designerclothing.fashion` + checkout back → review
- [x] Naya domain: `apps/web/src/lib/domain.ts` (`CANONICAL_ORIGIN`), `site.ts` +
      `api-base.ts` fallback, traffic internal pehchan, policies, sheet demo images
- [x] Vercel: domain + `www` (308) storefront par, `admin.` subdomain admin par;
      envs (`NEXT_PUBLIC_SITE_URL`, `CORS_ALLOWED_ORIGINS`, admin ke 3 URLs) update
- [x] Admin login: `ADMIN_EMAIL` comma-list (naya + purana email dono chalte hain)
- [x] Checkout: address → review → payment (wahi), payment page par **← Review order**
      link (`back-to-review`), snapshot se review wapas dikhta hai (cart khali hone par bhi)
- [x] Tests: `tests/unit/round33.test.ts` (13), payments e2e 59 → back-link check,
      **209 unit pass / 0 fail**
- [x] Payment se back → review (browser back bhi), snapshot se items/address/total, "Continue to payment"
- [x] Deploy: storefront `dpl_BcgUzFCWmtbxAWER6VE5zPDwXKym` @ `9704b3b`, admin `dpl_DqLMhTYqfsL52gpGvgokFP4bqdYK`;
      domain + www + admin subdomain Vercel me added — **DNS records owner ko add karne hain**
      (`docs/00-overview/owner-report-round33.md`)

### R34 — Cloudflare Workers (vinext) compatibility, storefront

- [x] `npx vinext check` (`apps/web`) → **97% compatible** (18 supported, 1 partial `images`, 0 issues);
      imports 6/6; 17 pages / 38 route handlers
- [x] Non-destructive `vinext init --platform=cloudflare --name=liksha-storefront` —
      `vite.config.ts`, `cloudflare.config.ts`, scripts `dev:vinext` / `build:vinext` /
      `start:vinext` / `deploy:vinext`; **`next dev` + `next build` + Vercel/Render intact**
- [x] **Workers FS read-only fix**: naya `apps/web/src/lib/fs-runtime.ts` (Node = asli `node:fs`,
      Workers = memory fallback) aur 9 libs usi par — pehle `EPERM` se `/api/settings`,
      `/api/delivery/check`, `POST /api/orders` 500 ho rahe the
- [x] **Policies**: `scripts/build-policies.mjs` → `src/content/policies.generated.ts`
      (runtime `readFileSync` hataya; `/policies/:slug` workerd par 404 tha)
- [x] **Invoice logo**: `scripts/build-invoice-logo.mjs` → `src/content/invoice-logo.generated.ts`
      (Workers par `public/` padha nahi ja sakta — PDF me wahi logo)
- [x] **Invoice PDF workerd par chalaya**: pdfkit ka node ESM entry + ICC URL + `#standard-fonts`
      static imports (`vite.config.ts` patch) → `200 application/pdf`, ~146 KB, logo embed
- [x] `/api/health` ab `runtime` / `storage` / `durable` batata hai (Workers par `DATABASE_URL`
      ke bina `storage:"memory", durable:false`)
- [x] `cloudflare.config.ts` me secrets sirf **naam** se declare (`DATABASE_URL`, `ADMIN_API_TOKEN`,
      UPI/OTP/Sheets/Resend) — koi value repo me nahi
- [x] Local workerd smoke (8787 preview + 3001 dev): home, PDP, collections, search, cart/pricing,
      order create + idempotency, order page tracking (courier/AWB), admin 401/200 + status machine
      + payment confirm, delivery check, settings, contact/newsletter, best-sellers, policies (4),
      sitemap, robots, health
- [x] `scripts/repo-audit.mjs` `.cloudflare`/`.wrangler` ignore (build output audit me aa raha tha)
- [x] Tests: naya `tests/unit/cloudflare-workers.test.ts` (8) — fs shim, policies/logo drift guard,
      raw `node:fs` guard, config guards → **217 unit pass / 0 fail**, integration **40/0**,
      `catalog:verify` ok, `next build` ok, `vite build` ok
- [x] Doc: `docs/09-devops/cloudflare-workers.md` (commands, config, secrets, feature matrix,
      preview deploy steps, rollback, limitations)
- [x] Repo ka apna smoke suite workerd par dono tarah: `BASE_URL=…:3001 npm run test:smoke`
      → **88/0** (`dev:vinext`) aur `BASE_URL=…:8787 npm run test:smoke` → **88/0**
      (`vite preview` = production bundle; local values `apps/web/.env` se)
- [ ] **Preview deploy nahi hua** — Cloudflare credentials nahi the; DNS/Vercel production jaisa hi hai

### R35 — Sheet settings **real-time** (UPI fix) + Cloudflare Worker deploy steps

Owner (26 Oct 2026): "sheet me UPI change kiya par real time me change nahi hui … jo cheez
sheet se data dekh kar turant change hoti hai wo honi chahiye" + Cloudflare build
`✘ Could not detect a directory containing static files`.

**Teen asli wajah mili (guess-patch nahi):**
1. `READ_TIMEOUT_MS = 900` jabki Apps Script `doGet` cold start par 1–4s leta hai →
   read **hamesha** timeout → site defaults par.
2. Read fail par cache `value: null` → **last good UPI bhi gayab**.
3. Payment page `getStoreSettingsFast(350)` → 350ms baad **hardcoded default UPI**
   (paisa purane VPA par jaane ka risk). Plus: cache garam ho to TTL check hi nahi tha
   (stale-forever), aur UPI ID server-render par atka tha (client refresh ka asar nahi).

- [x] `google-sheets.ts`: timeout **4s** (env `SHEET_READ_TIMEOUT_MS`), TTL **10s**
      (`SHEET_SETTINGS_TTL_MS`), stale window 10 min (`SHEET_SETTINGS_STALE_MS`),
      **stale-while-revalidate** + single-flight, fail par **last good** value,
      cache-buster `_ts`, aur Workers ke liye **Cloudflare Cache API** (cold isolate
      default par na jaaye; Node par no-op feature-detect)
- [x] `store-settings.ts`: SWR merge, DB/fail-safe, `getStoreSettingsFast(3_000)` —
      cache ho to turant (purani **sahi** value > default), cold ho to budget tak asli read;
      naya `storeSettingsInfo()` diagnostics
- [x] `/api/settings`: `?fresh=1` (sheet se abhi padho) + `meta` (sheetSource / ageMs /
      stale / lastError / ttl / timeout) — koi secret nahi; `no-store` waisa hi
- [x] Client: provider 30s → **15s** poll + `live` flag + `refresh({fresh})`;
      **payment page ka UPI ID/QR/copy/WhatsApp text live sheet se** (page pehle se khula
      ho tab bhi naya UPI aa jaata hai, hydration-safe)
- [x] Legacy payment routes (`/api/payments`, `/api/payments/intent`) + `manualUpiUri()`
      ab sheet ka live UPI use karte hain (pehle sirf env `STORE_UPI_ID`)
- [x] Admin: `/api/admin/sheet` → `liveRead`; **Google Sheet screen** par naya notice
      (Apps Script ✅ / CSV ⚠️ ~5min Google cache / fail ⚠️ + last error), purana "15s" copy hata
- [x] Cloudflare: `scripts/deploy-cloudflare.sh` + `npm run deploy:worker`,
      `.github/workflows/cloudflare-worker.yml` (manual), `cloudflare.config.ts` me
      `SHEET_READ_TIMEOUT_MS` + `SHEET_SETTINGS_TTL_MS` declared (Workers par
      `process.env` sirf declared vars padhta hai)
- [x] Tests: naya suite **`tests/sheets/settings-realtime.test.ts` (10)** — asli code +
      stub network (1.5s slow read chalta hai, fail par last good, TTL me 1 call, SWR,
      CSV fallback, cold-start payment page default par nahi) + `npm run test:sheets`
      (`--conditions=react-server`) `test:all` me juda; guards **`tests/unit/round35.test.ts` (12)**
- [x] Verify: unit **229/0** (pehle 217), integration **40/0**, db **9/0**, typecheck ✓ (web+admin),
      lint **0 errors / 33 warnings** (baseline same), `npm run audit -- --check` ✅ (A·A·A·A·A),
      `vite build` (vinext) ✓, **workerd preview par smoke 88/0**, payment page ~25ms 200,
      `/api/settings` → `sheetTtlMs 10000 · sheetReadTimeoutMs 4000`
- [x] Docs: `docs/09-devops/google-sheets.md` §4b (real-time table + 3-minute troubleshooting),
      `docs/09-devops/cloudflare-workers.md` §7.0–7.6 (error ki wajah + dashboard ki 3 settings +
      token + secrets + verify), `agent-guides/troubleshoot-storefront.md` (2 naye section),
      `.env.example`, **`docs/00-overview/owner-report-round35.md`** (owner ke liye poori guide)
- [ ] **Deploy baaki** — Vercel (production) par ye code jaana zaroori hai, warna sheet wala
      UPI live nahi hoga; Cloudflare Worker chahiye to §5.2 ki 3 settings + secrets

### R36 — Address yaad (recommend) + payment **step 3 par yahin** + UPI auto-redirect band

Owner (27 Oct 2026): "ek baar address card ki detail fill kare to sab cache me save kar lena,
next time direct recommend ho jaaye"; "payment ka alag se page nahi khulna chahiye — wahi 3rd
step me kaam kare, back jaane par bhi, aur wapis usi order me payment par jaane par bhi";
"payment page par jaate hi UPI par redirect na kare, Pay on UPI kare tab jaakar UPI detect ho";
"sheet ko vapis se configure karo — vaise abhi Vercel par deploy hai, fix karo".

- [x] **Saved delivery details** — naya `lib/checkout-details.ts` (localStorage, 6 mahine,
      pure `normaliseCheckoutDetails`: country-code/leading-0 → 10 digit, HTML/length clip,
      adhoori details save nahi). Checkout mount par prefill + green notice
      (`saved-address`) + "Naya address bharein" (`saved-address-clear`); save `goToReview`
      aur order place par. Browser autofill ke liye `autocomplete` attrs
      (name/tel/email/street-address/address-level2/address-level1/postal-code)
- [x] **Payment step 3 = checkout ke andar** (alag page nahi): naya
      `components/checkout-payment-step.tsx` + naya API
      `GET /api/orders/[orderNumber]/payment-context` (amount, **sheet-first live UPI**,
      status, reference, signed UPI-return token, items, name/city/state/pincode +
      `phoneMasked` — poora address/email/phone **nahi**). URL `/checkout?step=payment&order=LK-…`
- [x] History: order place par `replaceState(reviewUrl)` → `pushState(paymentUrl)` ⇒ browser
      **back** = review; `popstate` listener se step URL-sync (refresh/share/doosra tab par bhi
      step 3 chalta hai; snapshot na ho to context se review/summary ban jaati hai)
- [x] Step 3 par outer `<form>` render nahi hota (UPI card ke andar apna form hai — nested form
      invalid HTML + outer submit se doosra order ban jaata)
- [x] **UPI auto-redirect hata**: `?pay=1` + `appOpened` + `window.location.href = upiUri`
      effect delete; button ab **"Pay on UPI · ₹…"** (tap = asli gesture)
- [x] **Auto-confirm bug fix**: UPI callback pehle `/orders/<n>` par jaata tha (jahan
      `UpiPayment` render hi nahi hota) → `upi=return` koi nahi padhta tha. Ab `returnPath`
      prop: step 3 → `/checkout?step=payment&order=<n>`, pay page → `/orders/<n>/pay`;
      confirm hote hi `onConfirmed()` → status "paid"
- [x] Last-4 prefill: `defaultLast4` (pay page: order ke phone se, step 3: form/saved phone se)
      — "payment ho gaya" ek tap me
- [x] `PaymentStatusWatcher` me `onStatusChange` (step 3 client-side hai, server prop nahi)
- [x] **Vercel fix**: `google-sheets.ts` + `store-settings.ts` ka background refresh ab
      `runInBackground()` (Next `after()`) se — pehle `void promise` tha aur Vercel par
      response ke baad function freeze hone se sheet refresh adhoora reh jaata
- [x] Vercel config verify (API se): project **`liksha-clothing`** (root `apps/web`,
      domains designerclothing.fashion + www) me `GOOGLE_SHEETS_WEBAPP_URL`,
      `GOOGLE_SHEETS_TOKEN`, `SHEET_SELFTEST_KEY`, `DATABASE_URL`, `UPI_RETURN_SECRET`,
      `STORE_UPI_ID=dhakadgourav@fam` **set hain**; CSV URL nahi (optional). Production
      deployment commit `9704b3b` ka tha ⇒ **R35/R36 ka code live nahi tha** (asli wajah)
- [x] **Lint fix (bonus)**: `apps/web/eslint.config.mjs` me `ignores` rules wale object ke
      andar tha — flat config me wo *global* ignore nahi hota, isliye `.next`/`.cloudflare`
      ke minified bundle lint ho rahe the (`vite build` ke baad 27 rules-of-hooks **error**
      + lint 4.5 minute leta tha). Ab `ignores` alag object me + `.cloudflare`/`.vinext`/`out`
      add ⇒ **0 errors / 35 warnings, 9 second**
- [x] **CI ka stale guard fix**: `tests/e2e/responsive.mjs` me purana check
      "order page auto-opens the UPI app" `?pay=1` + `window.location.href = upiUri` ko
      **zaroori** maanta tha — R36 me wahi code hataya, isliye CI ka `production-build smoke`
      job fail hua. Ab guard ulta hai (auto-open code **nahi** hona chahiye + intent sirf
      `upi-open` ke href se), aur `round36.test.ts` isi ko pin karta hai
- [x] Tests: naya **`tests/unit/round36.test.ts` (17)**; `checkout-flow` + `round33` +
      `round27` guards naye flow ke hisaab se; `tests/e2e/smoke.mjs` me payment-context
      (200/404, live UPI, return token, privacy, `no-store`) + pay-page deep-link checks
- [x] Verify: unit **245/0** (pehle 229), integration 40/0, sheets 10/10, db 9/0 ⇒
      **304/0**; typecheck ✓ (web); `next build` ✓ (`/checkout` static hi raha,
      `/api/orders/[orderNumber]/payment-context` ƒ); `vite build` (vinext) ✓;
      workerd preview par **smoke 100/0** (pehle 88), `payments.mjs` 59/0, `round23.mjs` 23/0;
      lint 0 errors
- [x] **CI-parity verify** (Next production build + `next start` :3000, jaise CI karta hai):
      smoke **100/0**, responsive **44/0**, breakpoints **48/0**, round16 **39/0**,
      payments **59/0**, links **45 pages/0**
- [x] Docs: **`docs/00-overview/owner-report-round36.md`**, `docs/09-devops/google-sheets.md`
      **§4c (Vercel config + "vapis configure" ke 5 step + Vercel `after()` fix)**,
      `docs/00-overview/owner-code-map.md`
- [ ] **Deploy baaki** — Vercel `liksha-clothing` production par ye code jaana zaroori hai
      ( warna na address recommend hoga, na step-3 payment, na sheet ka live UPI)

### R37 — Sheet = order ka DB + phone prefix auto + header/circles fix + Vercel deploy

Owner (27 Oct 2026, voice): Paytm "Payment Alert" screenshot ("direct phone se detect krta hai
na UPI direct, fix kro"); "prkigothwal@gmail.com se DB connect + wahi se sheet ka Apps Script";
"header bar fix in desktop"; "Vercel par sheet ke environment add kr dena"; "manoj-Product wali
`trends-sheets.gs` dekho — ek box me placed/confirmed/shipped, replied/marked reply — DB ko sheet
se manage karo"; "admin ko mat chhedo, only store + DB sheet"; "instant means instant (phone,
UPI…)"; "har device comfortable"; "wedding circle me image nahi"; "phone me +91/91/0 auto hatao,
10 digit"; "sab fix ke baad Vercel par latest deploy + push".

- [x] **Paytm alert**: asli wajah production ka purana `?pay=1` auto-open (R36 me code hata tha,
      live nahi tha). Ab UPI sirf tap par + naya `upi-risk-hint` (QR / UPI-ID copy raasta);
      koi app brand nahi (owner rule guard se pin)
- [x] **Phone prefix**: `lib/phone.ts` → `normaliseIndianPhone` + `autoFixPhoneInput` (type karte
      hi `+91 / 91 / 0` hat jaate hain); `packages/validation` phoneSchema wahi (server par bhi
      sirf 10 digit save); checkout payload me saaf number; contact form isi schema se
- [x] **Wedding circle**: image hardcoded `undefined` thi → `circleImage()` (collection image,
      fallback pehla product photo); smoke me "saare circles me img" guard
- [x] **Desktop header**: nav 1fr column se logo par chadh jaati thi → alag centered row
      (`desktop-nav`), logo hamesha center; mobile drawer unchanged
- [x] **Sheet = DB** (trends-sheets.gs pattern): `liksha-sheets.gs` **r37-1** me `onEdit` —
      `Orders!Order status` edit → timeline row (`order.status_sheet`), `Messages!Status` →
      `Replied`/`Replied at` (marked-reply). Store side naya `lib/sheet-tracking.ts` (fetch +
      2s TTL + SWR) + `lib/sheet-merge.ts` (pure merge: sheet status/courier/AWB/URL/note +
      timeline updates; **paymentStatus hamesha DB**); order page + `/api/orders/<n>/public`
      (`?fresh=1`) merge karte hain
- [x] **Instant**: settings TTL 10s→**2s**, browser poll 15s→**3s**, tracking TTL **2s**;
      worker bindings bhi (`cloudflare.config.ts`); payment-context pehle se `no-store`
- [x] **Vercel env (store only)**: `liksha-clothing` par API se add — `SHEET_READ_TIMEOUT_MS=4000`,
      `SHEET_SETTINGS_TTL_MS=2000`, `SHEET_TRACKING_TTL_MS=2000` (production+preview).
      Admin project chheda nahi
- [x] Tests: naya `tests/unit/round37.test.ts` (13); smoke me +4 checks (desktop-nav, wedding
      circle img, `+91` phone se order 201, public `?fresh=1`); round35 guards naye knobs par
- [x] Verify: unit **259/259**, integration 40, sheets 10, db 9 ⇒ **318/318**; lint 0 errors/38
      warnings; audit sab A; `next build` + `vite build` ✅; Next-prod parity smoke **104/0**,
      responsive 44/0, breakpoints 48/0, payments 59/0, links 45/0; workerd preview **104/0**
- [x] Docs: **`docs/00-overview/owner-report-round37.md`**, `google-sheets.md` §4d,
      `owner-code-map.md`, `apps-script-code.md` (auto-export r37-1)
- [x] **Deploy**: owner ke kehne par PR #8 merge → `main` → Vercel `liksha-clothing` production

## Round 38 (27 Oct 2026) — "dhakadgourav@fam code se hatao; sheet hi DB; Apps Script future-proof"

Owner (deploy ke baad bhi): purana payee VPA abhi bhi dikh raha tha, redeploy ke baad
order/checkout sheet me show nahi ho rahe the, contact messages nahi aa rahe the —
aur Apps Script aisa chahiye "jisko change krne ki jrurat na pde".

- [x] **Purana payee VPA 4 jagah se hataya**: `store-settings.ts` default (env ?? ""),
      provider default (""), admin `data.ts` (""), Apps Script `DEFAULT_SETTINGS` + demo
      rows (''); Vercel env `STORE_UPI_ID` delete. UPI ka ek hi source: sheet `upi_id`.
      Khaali ho to payment page honest pause (`upi-unavailable`) — galat payee nahi.
- [x] **Root causes (orders sheet me kyun nahi aa rahe the)**: (1) Vercel + script dono
      par token = public placeholder `CHANGE-ME-liksha-token`; (2) sheet access na milne
      par script chup-chaap **anaath sheet** bana kar usme likhti thi; (3) write failures
      kahin dikhte hi nahi the.
- [x] **Apps Script r38-1**: token **Script Properties** me (`?action=set_token`, ek baar;
      placeholder kabhi authorize nahi), `?action=adopt` (bound sheet apnao), public
      `settings`(subset)/`health`/`version`/`ping`, `healthReport_` (tokenSet/tokenOk/
      sheetFound/sheetId/upiSet/problems Hinglish fix), book_() loud `sheet_access_denied`
      (anaath sheet band), duplicate `guard_` hataya, header recipe naya.
- [x] **Site**: `/api/sheet-health` public report-card (settings source/age, script health,
      last write, ordersStore, help[]; secret-safe, 30s cache); `appendSheetRows` retry +
      `sheetWriteInfo()` + token redaction; `expectedSheetId()` env override
      (`SHEET_EXPECTED_ID`); admin/sheet + selftest routes helper par.
- [x] **Vercel env** (deploy ke waqt): `STORE_UPI_ID` delete; `GOOGLE_SHEETS_TOKEN`
      rotate (naya 48-char; script me set_token URL se). `liksha-admin` untouched.
- [x] Tests: `round38.test.ts` (8 guards), apps-script harness key-aware props +
      placeholder/set_token/adopt/loud-error tests, round23/27/37 + sale-payments updates,
      smoke me sheet-health checks, payments me "purana payee nahi" + env-VPA checks;
      CI storefront env me `STORE_UPI_ID=likshastore@upi` (tests ke liye neutral).
- [x] Docs: `google-sheets.md` §4e, `apps-script-code.md` (auto-export r38-1),
      `owner-code-map.md`, `live-vercel-supabase.md`, `netlify-shift-guide.md`,
      **`owner-report-round38.md`**.
- [x] Gates: typecheck ✅ · unit **270/270** · test:all **329/329** · lint web 0/38 ·
      audit sab A · next build + vinext ✅ · Next-prod parity: smoke **110/0**, responsive
      44/0, breakpoints 48/0, round16 39/0, payments 61/0, links 40/0 · workerd **110/0**.
- [x] Deploy: PR #9 squash-merged → `main` @ `4062a0a`; Vercel production
      `dpl_H2hAd1kjKd9x66QrotXNJnMqLbPH` READY/PROMOTED (designerclothing.fashion +
      www + liksha-clothing.vercel.app). Env: `STORE_UPI_ID` delete +
      `GOOGLE_SHEETS_TOKEN` rotate (naya 48-char). Owner TODO: Apps Script r38-1 paste
      → `setup` → New version deploy → `?action=set_token&token=…` → `upi_id` sheet me.

## Round 39 — 27 Oct 2026 (IST timezone + sheet-driven order note + final sheet + env audit)

Owner (live order ke baad, screenshot ke saath): "Placed · 27 Oct, 2:16 am — **yha
timezone india ka chalna chiye**; timeline ke neeche box me static AWB text ki jagah
**sheet se kuch bhi likha ja sake**, default **Waiting for confirmation**, har order ke
liye sheet se change; **final sheet Vercel se live hai — dekh lena**; aur vaha **saare
secret/variable update** karke verify karna."

- [x] **IST har jagah**: web (`format.ts` `STORE_TIME_ZONE`, `tracking.ts` time-label+ETA,
      `invoice-pdf.ts`) + admin (`format.ts` dateTime/dateOnly, invoices ×2, products page)
      — Vercel UTC server par bhi customer/owner ko India time dikhta hai (7:46 IST ka
      order ab 7:46 am hi hai, 2:16 am nahi).
- [x] **Admin Note (script r39-1)**: Orders tab me naya column (purani sheet me
      `ensureHeaders_` apne aap jodta hai) → `timeline_().adminNote` → site note-box
      (`order-note-box`): sheet text, warna default "Waiting for confirmation"; onEdit
      Admin Note change ko `order.admin_note` event row banata hai; static AWB waada hata.
- [x] **/exec control panel**: browser se script kholne par ab JSON ki jagah HTML panel
      (version/token/sheet/UPI status + problems + website/admin/site-health buttons +
      Admin Note hint). Website ka `?action=…` JSON contract bilkul nahi badla.
- [x] **Final sheet** `1b8DReh2RF5JeOSJeknWmH1KSE1RZgmBjatgkCDS9w_4`: `.gs`
      SPREADSHEET_ID/fallback + site `EXPECTED_SHEET_ID` + selfcheck default + Vercel env
      `SHEET_EXPECTED_ID` (naya) — live script health ne confirm kiya (sheetFound:true,
      upiSet:true, lastWrite ok, settings apps-script se).
- [x] **sheet-health improvements**: version gate r39 (purana script → paste reminder),
      probe-timeout akela failure nahi (settings+write chal rahe ho to `warnings[]`),
      anonymous health request par jhootha token-alert nahi (script side fix).
- [x] **Env audit (owner ka "check krna updated hai ki nhia")**: storefront —
      GOOGLE_SHEETS_TOKEN rotated (R38) ✓ build me gaya ✓, STORE_UPI_ID deleted ✓,
      SHEET_EXPECTED_ID added (R39); admin — sab present, STORE/NEXT_PUBLIC URLs
      designerclothing.fashion ✓; `liksha-admin` ko chheda nahi (R37 rule) — sirf verify.
- [x] Tests: unit **279/279** (round39: 7 naye + apps-script 2 naye), test:all **338**,
      typecheck 0, lint web 0 err/**34** warn (3 dead constants + 1 unused import bhi
      saaf — "every line meaningful"), audit sab A, next + vinext build ✅,
      Next-prod parity: smoke **111/0** (naya note-box check), payments 61/0,
      responsive 44/0, breakpoints 48/0, round16 35/0, links 40/0; workerd smoke **111/0**.
- [x] Docs: `google-sheets.md` §4f + §0 final-sheet note, `live-vercel-supabase.md`
      (SHEET_EXPECTED_ID row), owner-code-map (4 R39 rows), `apps-script-code.md`
      (r39-1 export), `owner-report-round39.md`, sheet-setup/setup-steps me final id.
- [x] Deploy: PR #11 squash-merged → `main` @ `b96dab8`; Vercel production PROMOTED;
      env `SHEET_EXPECTED_ID` live. Owner ka r39-1 paste **baaki tha** (live script r38-1
      raha) — R40 ka r40-1 paste dono ko cover karta hai (neeche Round 40).

## Round 40 — 27 Oct 2026 (sheet hi orders ka DB — Supabase out; zero sheet-hardcoding; cached-order fix)

Owner: *"supabase pr nhai chiye, sheet mai hi chiye — **only sheet**"* (Supabase project
owner ne khud delete kiya → live orders fail: "Order server par save nahi hua"),
*"**google sheet ka koi bhi chij hardcoded nhai honi chiye** — koi bhi nahi means koi bhi
nahi"* (change turant dikhna chahiye), *"**bar bar merge mt kro**"* (sab ek hi PR/deploy
me), aur repeat checkout par **purana cached order** dikhne ka bug.

- [x] **Sheet-as-DB backend** (`lib/orders-sheet.ts`, naya): order create = **awaited**
      batch append (Orders row + `Order JSON` snapshot + OrderItems + Payments rows); fail
      → honest 502/503 + WhatsApp order ka raasta (jhoothi success nahi). Read =
      `?action=order_state` (JSON snapshot + owner-edit overlay: Admin Note/status/courier/
      AWB last-non-empty scan; `paymentStatus` site ka truth). List = `?action=orders_state`
      (newest-first, ≤300). Update = snapshot diff → event row append (append-only log).
      2s TTL cache + invalidate; invoice serial Invoices tab ke max se.
- [x] **Script r40-1**: `order_state`/`orders_state`/`sheet_set` actions + `orderStates_`
      (last 4000 rows, latest non-empty JSON, poori history); HEADERS me `Order JSON` +
      `Invoice JSON` + `Message ID`/`Replied`/`Replied at` (`ensureHeaders_` purani sheet
      me END par jodta hai — data safe); **props-only `SHEET_ID`** — `SPREADSHEET_ID`
      constant + bound-sheet fallback **delete** (container galat sheet se bound tha);
      fresh paste par `/exec` = "Sheet URL set karein" bootstrap form; `message_status`
      fix (`handled` ab Replied state preserve karta hai); MAX_CELL_CHARS 20000.
- [x] **Zero hardcoding**: site ka `EXPECTED_SHEET_ID` constant bhi delete — sheet id sirf
      env `SHEET_EXPECTED_ID` me, wo bhi sirf **auto-heal** ke liye: `sheet_not_configured`
      mile to site khud `sheet_set?id=…&token=…` karti hai (10-min rate limit) → retry.
      Sheet badalna = panel form ya ek env change — koi code change/redeploy nahi. Guard
      tests purani FINAL/OLD ids ki maujoodgi par fail karte hain.
- [x] **Backend selection + gate**: `sheet` (GOOGLE_SHEETS_* set ho) → `postgres`
      (DATABASE_URL ho tab — dev/backup) → `json` (dev). Version gate: script **r40+** na
      ho to orders honest 503 `sheet_store_not_ready`. Messages + manual invoices ke sheet
      branches bhi (Messages/Invoices tabs, JSON snapshots ke saath).
- [x] **Purana cached-order fix**: checkout `staleResume` guard — payment se wapas aane par
      cart me **nayi** lines ho to purana `?order=` param ignore, step `details`, one-shot
      `router.replace("/checkout")` (URL saaf); popstate/context/submit guards refs ke
      saath (stale closure fix). Legit back-from-payment waise hi kaam karta hai.
- [x] Worker config: `DATABASE_URL` secrets se nikla (R40), `SHEET_EXPECTED_ID` declare
      (build-env bake — `STORE_UPI_ID` pattern, value hardcoded nahi); `.env.example` me
      DATABASE_URL ab optional-dev. Vercel se `DATABASE_URL` deploy ke saath delete.
- [x] Tests: unit **294/294** (round40: 9 naye + harness ab props-aware — 4 naye R40
      harness tests: order_state/orders_state roundtrip, health `expected`→idMatch, panel
      bootstrap form, message_status handled), test:all **353**, typecheck 0, lint web
      0 err/**34** warn, next + vinext build ✅, Next-prod parity: smoke **111/0** (R40
      enum/null assertions), payments 61/0, links 40/0, round16 35/0, responsive 44/0,
      breakpoints 48/0; workerd parity same **111/0** (DATABASE_URL warning bhi gaya).
- [x] Docs: `google-sheets.md` (intro flip + §0 R40 + §3 curls + §4 files + §4c/4e/4f +
      naya **§4g**), `live-vercel-supabase.md` (Supabase→sheet; DATABASE_URL delete; §4/§5
      rewrite), `cloudflare-workers.md` (secrets table + deploy steps + limitations),
      `owner-code-map.md` (§1 R40 row, §4 awaited flow, §6.1–6.3, §12 env, §15),
      `netlify-shift-guide.md` (R40 banner), `apps-script-code.md` (r40-1 export),
      `owner-report-round40.md` (naya).
- [ ] Deploy: **ek hi PR** → squash merge → storefront production deploy → Vercel se
      `DATABASE_URL` DELETE → redeploy → verify `/api/health` `ordersStore:"sheet"` +
      `/api/sheet-health` `ok:true`. Owner ke 2 kadam: **r40-1 paste → New version →
      Deploy** (r39-1 ka baaki paste bhi isi me cover) aur sheet confirm — `/exec` panel
      form se ya auto-heal (`SHEET_EXPECTED_ID`) khud `sheet_set` kar dega.

## Round 41 — 27 Oct 2026 (compat mode: r38-1 script par bhi orders + friendly customer errors)

Owner ki 4 shikayatein: (1) *"ye direct mt baya kro ki kya problem hai server problem ok sabhi
jgha ok fix kro"* (customer ko technical/server errors mat dikhao), (2) *"abhi bi sheet mai nhai
aa rha hai fix kro yrr"* (r40-1 paste nahi hua — live script abhi bhi r38-1, aur R40 ka
version-gate orders ko mana kar raha tha), (3) UPI ID mismatch — sheet me fix kiya, site par
purana dikhna, (4) messages/newsletter/checkout events sheet me nahi aa rahe.

- [x] **Compat mode** (`SheetOrdersMode = full | compat | none`, orders-sheet.ts): purane script
      (r38/r39) par bhi orders imandari se save + read — write wahi `append` (r38 ka appendRows_
      unknown `Order JSON` key DROP karta hai par row likhta hai), single read `action=order`
      (**findRows_ bottom-up ⇒ rows newest-first** — site reverse karti hai) →
      `orderFromSheetRows`, admin list `action=recent&sheet=Orders&limit=200` →
      `groupOrdersFromRecentRows` (sheet-merge.ts, naya). Version padha hi na ja sake →
      **optimistic compat** (write sach me fail ho to saaf error; jhoothi success nahi).
      Full mode (r40+) ka path unchanged.
- [x] **orderFromSheetRows hardening**: har human column (Customer/Phone/Total/Item details/…)
      ab **last-non-empty** scan se (trackingFromRows wala rule) — `onEdit` ki sparse
      status-row latest ho to bhi customer/total/items gayab nahi hote. Status free-text map,
      paymentStatus whitelist.
- [x] **Friendly errors sab customer touchpoints par**: orders.ts 503/502 copy, http-json.ts
      (status ≥500, reply padha na gaya, HTML reply), checkout fallback banner
      (`data-testid="checkout-fallback"` barkarar) — sab jagah "Order abhi complete nahi hua…
      WhatsApp par order bhej dijiye". Technical wording sirf owner-side (sheet-health/logs/
      admin `writeAll` message).
- [x] **sheet-health upgrade**: payload me `sheetOrders.mode` (full/compat/none); major<40 ab
      `warnings` me (compat wording) — help me nahi; `!ready` help = seedha env-fix
      (GOOGLE_SHEETS_WEBAPP_URL+TOKEN + redeploy); **r40+ par `idMatch:false` → auto
      `sheet_set` heal** fire-and-forget (10-min rate limit) — r38 par sirf report.
- [x] **Messages id fallback**: purane 7-col Messages tab (no `Message ID`) → synthetic id
      `row:<Timestamp>|<Email>` — admin list crash nahi, replied-mark graceful degrade.
- [x] Tests: unit **303/303** (round41.test.ts 9 naye + apps-script harness me r38 compat
      contract: newest-first rows, sparse onEdit row, reverse-reconstruct), test:all **362**,
      typecheck web+admin 0, lint web 0 err/34 warn, next + vinext build ✅; Next-prod parity:
      smoke **111/0**, payments 61/0, links 40/0, round16 35/0, responsive 44/0, breakpoints
      48/0; workerd parity: smoke **111/0**, payments 61/0 (`.dev.vars` apps/web me bhi chahiye
      — worker root wahin hai).
- [x] Docs: `google-sheets.md` **§4h** (compat table + friendly-error rule + auto-heal),
      `owner-report-round41.md` (naya), PROGRESS (ye entry).
- [ ] Deploy: **ek hi PR** → squash merge → storefront production deploy → verify
      `/api/health` (`ordersStore:"sheet"`) + `/api/sheet-health` (`sheetOrders.mode:"compat"`,
      `idMatch:true`, upiLoaded) → owner report + 3 self-check (`<exec>?action=settings` —
      script ki apni sheet view; `/api/sheet-health`; full mode ke liye r40-1 paste).
