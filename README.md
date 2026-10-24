# Designer Clothes — storefront, admin & API

Production-grade ecommerce monorepo for **Designer Clothes** (designer anarkali suits, lehenga choli and
printed suit sets). The catalogue mirrors [likshaclothing.com](https://www.likshaclothing.com) exactly:
same titles, same prices (in paise), same MRP, same sizes, same collections.

```
web app   →  likshaclothing.com            (customer storefront, 287 static product pages)
admin app →  admin.likshaclothing.com      (owner panel: orders, stock, prices, settings)
api       →  api.likshaclothing.com        (REST /api/v1 for partners, mobile, webhooks)
```

> **Payment policy:** third-party only (Razorpay hosted links + verified webhooks). No card data ever
> touches this codebase. If live keys are absent the store falls back to a manual UPI + WhatsApp flow.

---

## Stack

| Layer | Choice |
| --- | --- |
| Storefront | Next.js 16 (App Router, SSG) + Tailwind 4 |
| Admin | Next.js 16 (server components + server actions, plain CSS) |
| API | Node 22 + Express 5 + TypeScript (tsx in dev) |
| Validation | zod — shared by web, admin and api (`@liksha/validation`) |
| Data | catalogue JSON (build artifact) + Postgres (`DATABASE_URL`: orders, notes, delivery rules, settings, manual invoices) — bina DB ke `.data/*.json` fallback |
| Payments | Razorpay payment links + HMAC-verified webhooks |
| Tests | `node:test` (unit + integration) and a zero-dependency smoke suite |

---

## Deploy

| Target | Kya milta hai | Kaise |
| --- | --- | --- |
| Render (full app) | storefront + admin + Postgres + static preview | dashboard → New → Blueprint → repo → Apply (`render.yaml`), phir admin me `ADMIN_PASSWORD` set |
| GitHub Pages | static preview (browse) | repo → Settings → Pages → Source = GitHub Actions (workflow ready) |
| Vercel | storefront preview | project `liksha-clothing` (root `apps/web`) — Vercel GitHub App ko repo access chahiye |

Detail: [`docs/10-deployment/render.md`](docs/10-deployment/render.md), [`docs/10-deployment/vercel.md`](docs/10-deployment/vercel.md).

### Render static site "Not Found" aa raha ho

Static site ke Settings me ye do field bharni padti hain (khaali chhod dene par Render build skip
kar deta hai aur site blank milti hai):

| Field | Value |
| --- | --- |
| Build Command | `npm ci && node scripts/pages/build-preview.mjs` |
| Publish Directory | `dist` |

Ya behtar: **New → Blueprint** se `render.yaml` apply karein — wahan `liksha-preview` (static) aur
`liksha-storefront`/`liksha-admin` (full app) dono define hain.

## Admin login (baat-baat par logout nahi)

- Session **30 din** ki httpOnly cookie (`liksha_admin`), har request par sliding refresh (middleware).
- Secret fallback: `ADMIN_SESSION_SECRET` → `ADMIN_API_TOKEN` → dev default. Render/Vercel par
  dono me se ek set ho to redeploy par bhi login bana rehta hai.
- Production me `ADMIN_PASSWORD` set nahi hai to login **fail-closed** (default password kabhi nahi chalta).
- Login form par "Keep me signed in (30 days)" checkbox hai.

## Home page rotation (har 10 minute)

Home ke product rails 10-minute "bucket" se bante hain:

- window badalte hi naya random set (server + client dono par same algorithm — `lib/rotation.ts`),
- `More from Liksha` rail **poore catalogue** se chalta hai, isliye har product home par aata hai,
- `/api/rotation?rail=trendy&bucket=N` sirf card ke liye zaroori fields deta hai (chhota payload),
- API na chale (static preview) to client usi pool se locally shuffle kar leta hai.

## Festive sale pricing (₹499 / ₹549 / ₹599 / ₹649 / ₹699)

Owner rule: har dress ki **final price** in 5 me se ek honi chahiye, aur badge par 70% ya 60%.
Pricing deterministic hai (`scripts/lib/sale-pricing.mjs`):

```bash
npm run pricing:sale           # catalog JSON files par apply
npm run pricing:sale -- --verify
```

`npm run catalog:build` bhi yahi function chalata hai, isliye snapshot refresh ke baad price
wahi rehta hai. Percentage coupons band hain — warna final price ₹499 se neeche chala jaata.

## UPI payments (seedha owner ke account me)

Koi gateway nahi: order page par UPI QR + UPI ID + exact amount, customer UTR daalta hai,
admin verify karta hai. Detail: [`docs/09-devops/upi-payments.md`](docs/09-devops/upi-payments.md).

## Google Sheets (owner ka control panel)

`Settings` sheet se phone / WhatsApp / email / UPI ID / announcement live update hote hain,
`Orders` / `Payments` / `Messages` / `Newsletter` sheet me har event ki row append hoti hai.
Setup 5 minute: [`docs/09-devops/google-sheets.md`](docs/09-devops/google-sheets.md).
Sheet ka account, admin link (`admin_url`) aur payment ke har stage (`pending` → `reference_submitted` →
`paid` / `failed`) ki detail usi doc me hai.

## Domain + brand

Apna domain (`designerclothes.in` jaisa) lagane ke steps, Render/Vercel env variables aur
brand/logo rules: [`docs/09-devops/domain-and-brand.md`](docs/09-devops/domain-and-brand.md).

## Contact form ("Send us a message")

Message Postgres me save hota hai + owner ko email jaata hai + admin panel (`/messages`) me dikhta hai.
Bina key ke **FormSubmit** (free, unlimited) — pehli submission par inbox me activation mail aata hai.
Detail: [`docs/09-devops/contact-form.md`](docs/09-devops/contact-form.md).

## Phone OTP endpoints (checkout se hata diye)

Owner ke Round 12 instruction par checkout me **OTP nahi** lagta — customer seedha mobile
number bharke order kar sakta hai. `/api/otp/*` endpoints code me hain (future use ke liye)
par koi order un par block nahi hota.

## Admin panel ke naye kaam

| Screen | Kya hota hai |
| --- | --- |
| `/orders/new` | Phone/WhatsApp order manually create — order number (LK-…) system banata hai, sheet me row turant. |
| `/products/new` | Naya product + **10 photos** (URL slots with live preview), price sale ladder se, publish par catalogue rebuild. |
| `/sheet` | Google Sheet ka live data (settings + last order/payment/message rows) aur setup status. |
| `/settings` | Save karte hi values sheet me bhi chali jaati hain. |

## Quickstart

```bash
# 0. requirements: Node 22+, npm 10+
cp .env.example .env
npm install
npm run catalog:build      # database/seeds/catalog.json → app copies (287 products)
bash scripts/setup.sh      # env, data dir, typecheck

npm run dev                # storefront  http://localhost:3000
npm run dev:admin          # admin       http://localhost:3001
npm run dev:api            # api         http://localhost:4000/api/v1/health
```

Dev admin login: `admin@likshaclothing.com` / `liksha2026` (change before go-live — `ADMIN_PASSWORD`).

Docker alternative: `docker compose up --build` (web 3000, admin 3001, api 4000, shared `.data` volume).

---

## What works today

**Storefront**
- Home (hero, category tiles, new arrivals, bestsellers, editorial, reviews, newsletter)
- 9 collections with sort / price filter / load-more (paginated 24)
- 287 product pages, all prerendered at build (`generateStaticParams`)
- Instant search (debounced API), cart drawer, festive sale pricing (₹499–₹699, 70%/60% off)
- Checkout with COD (≤ Rs. 3,500) or prepaid, idempotent order creation
- Order confirmation + tracking by order number
- Policies (shipping, returns, privacy, terms) + about / contact / FAQ / size guide
- `sitemap.xml`, `robots.txt`, JSON-LD Product/Breadcrumb

**Admin**
- Cookie session (HMAC, 8h), 15 routes: dashboard, orders (+detail), products (+detail),
  inventory, collections, customers, reports, coupons, reviews, settings, audit logs, staff, banners
- Server actions for order status, price, stock, settings — every mutation lands in the audit log
- Order status machine enforced (`placed → confirmed → packed → shipped → delivered`, plus cancel/return)

**API** (`/api/v1`)
- `GET /health`, `/products`, `/products/:handle`, `/collections`, `/catalog/meta`
- `POST /orders` (idempotent), `GET /orders/:orderNumber`
- Admin (Bearer): `GET /orders`, `PATCH /orders/:orderNumber/status`, `GET /admin/dashboard`
- `POST /payments/link`, `POST /webhooks/razorpay` (raw-body HMAC + event dedupe)

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `dev:admin` / `dev:api` | run one app |
| `npm run build:all` | build web + admin + api |
| `npm run typecheck` | tsc across all workspaces |
| `npm test` | unit tests (`tests/unit`) |
| `npm run test:integration` | service + HTTP-level integration tests |
| `npm run test:smoke` | HTTP smoke test against a running build (`BASE_URL=…`) |
| `npm run test:e2e` | Playwright suites (needs `npx playwright install`) |
| `npm run catalog:build` | regenerate catalogue JSON from source data |
| `npm run catalog:verify` | sanity gate: 287 products, paise prices, sizes, collections |
| `npm run catalog:sync` | live store se snapshot pull + rebuild (galleries, descriptions, prices, sizes) |
| `npm run setup` | first-run bootstrap |

---

## Data rules (non-negotiable)

1. **Money is integer paise.** `Rs. 3,499` is `349900`. Never floats, never rupees.
2. **Prices are computed server-side.** The client sends `handle + size + quantity`; the server looks up
   the catalogue price, applies the coupon, adds the COD fee.
3. **Order numbers** are `LK-` + base36 time + 4 crypto-random chars (`^LK-[A-Z0-9]{6,12}$`).
4. **COD** only under `Rs. 3,500` subtotal, `Rs. 50` fee. Above that: prepaid.
5. **Idempotency** — same `Idempotency-Key` never creates a second order (disk-backed, 7 day TTL).
6. **Status machine** lives in `@liksha/validation`; web, admin and api all import it.
7. **Catalogue is generated, not hand-edited** (`scripts/build-catalog.mjs` → `database/seeds/catalog.json`).

Catalogue snapshot: **287 products, 9 collections** — new-arrivals 287, party-wear-gown 266, sale 246,
likshas-choice 126, printed-suit-set 38, lehnga-choli 23, weddin-collection 18, trending 4,
saree 0 (empty on the live store too), price range `Rs. 1,499 – Rs. 4,999`.

---

## Testing

```bash
npm test                    # 37 unit tests
npm run test:integration    # 36 integration tests (orders, search, webhook, HTTP routes, admin auth)
npm run build:web && npm run start --workspace @liksha/web &
npm run test:smoke          # live HTML/JSON checks
```

Coverage focus: server-side pricing, COD limits, idempotency, status transitions, webhook signatures,
catalogue integrity (count, prices, sizes, collection membership), session tampering.

---

## Deploy

| App | Host | Doc |
| --- | --- | --- |
| storefront + admin + Postgres | Render blueprint (`render.yaml`) → `https://likshaclothing.onrender.com` | `docs/10-deployment/render.md` |
| static browse preview | GitHub Pages (`.github/workflows/pages.yml`) | this file |

### Render (production, same-to-same)

1. Render dashboard → **New → Blueprint** → repo select (`render.yaml` mil jayega).
2. Blueprint 3 cheezein banata hai: `liksha-storefront`, `liksha-admin` aur `liksha-db` (Postgres).
3. `ADMIN_PASSWORD` dashboard me set kariye (blueprint me `sync: false` hai).
4. Pehla boot par `npm run db:migrate` chalta hai — `database/schema.sql` + `database/migrations/*`
   apply hote hain, phir server start hota hai.

Orders/tracking/payments Postgres me rehte hain (`DATABASE_URL` set hone par). Set nahi hai to local
JSON store chalta hai — dev aur tests bina DB ke chalte hain.

Migrations manually: `DATABASE_URL=postgres://… npm run db:migrate`
(Postgres path ka test: `npm run test:db` — WASM Postgres par asli SQL chalta hai.)

### GitHub Pages (sirf browse preview)

`pages.yml` static export banata hai (home, collections, product pages, cart/wishlist UI).
Pages par Node server nahi chalta, isliye checkout/payment/order-tracking Render deployment par
chalte hain; preview par ek banner yeh batata hai.

One-command release: `bash infra/scripts/deploy.sh` (verify → build → backup → deploy hooks → health).
Post-deploy health: `bash infra/monitoring/health.sh`.

---

## Documentation

| Folder | Contents |
| --- | --- |
| `docs/00-overview` | vision, scope, glossary, reference-site analysis |
| `docs/01-requirements` | BRD, SRS, features, stories, use cases, NFRs, traceability |
| `docs/02-planning` | roadmap, MVP scope, WBS, sprints, risks, estimates, roles |
| `docs/03-architecture` | HLD/LLD, system, stack, sequences, payment flow, 10 ADRs |
| `docs/04-data` | data model, catalogue/order schemas, dictionary, migrations, seeds, delivery rules |
| `docs/05-design` | design system, tokens, components, page specs, a11y, UI copy |
| `docs/06-api` | endpoints, auth, errors, versioning, examples, OpenAPI |
| `docs/07-security` | threat model, authn/authz, secrets, PCI, headers, OWASP |
| `docs/08-testing` | test plan, cases, e2e, performance, security testing, UAT |
| `docs/09-devops` | CI/CD, environments, docker, monitoring |
| `docs/10-deployment` | vercel, render, DNS, go-live checklist, rollback |
| `docs/11-maintenance` | runbook, backup/restore, changelog, incidents, releases, routine |

Agent-facing context lives in `AGENTS.md` (rules), `STRUCTURE.md` (annotated tree),
`PROGRESS.md` (state), `TASKS.md` (backlog) and 15 task skills in `.claude/skills/`.
Human walkthroughs: `agent-guides/`.

---

## Known limitations (Phase 1, tracked in `TASKS.md`)

- Orders/invoices/payments Postgres me jaate hain jab `DATABASE_URL` set ho (`npm run db:migrate`).
  `DATABASE_URL` ke bina `.data/*.json` use hota hai (dev/test). Admin settings aur manual invoices
  abhi admin ke local data dir me hain — Postgres me shift baaki hai.
- Catalogue is built from `database/seeds/live/` (real Shopify snapshot: 1,971 images, store's own
  descriptions). Refresh with `npm run catalog:sync`; in sandboxes without outbound network run the
  *Catalog sync* GitHub Action instead. `catalog:sync-live` is an alias of `catalog:sync`.
- Product galleries, hover image swap, scroll animations, phone OTP, courier tracking and GST
  invoices are live — see `docs/07-security/phone-otp.md` and `docs/04-data/gst-invoicing.md`.
- Firebase phone OTP needs the project keys; until then checkout runs in dev-OTP mode (code on screen)
  and production must set `OTP_DEV_MODE=off` ([`docs/09-devops/firebase-otp.md`](docs/09-devops/firebase-otp.md)).
- `SELLER_GSTIN` must be set before the first real GST invoice (`docs/04-data/gst-invoicing.md`).
- Prepaid payments stay `pending` until live Razorpay keys + webhook secret are configured.
- Delivery serviceability asli India Post data (19,486 pincodes / 36 states) + admin rules par chalti hai:
  state-wise allow, pincode block/allow, aur server-side order reject — `docs/04-data/delivery-rules.md`.
- Storefront images are hotlinked from the Shopify CDN; mirroring to object storage is a Phase 2 task.

---

© Designer Clothes. Proprietary — not for redistribution. Built as a production system, not a template.
