# Liksha Clothing — storefront, admin & API

Production-grade ecommerce monorepo for **Liksha Clothing** (designer anarkali suits, lehenga choli and
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
| Data | catalogue JSON (build artifact) + `.data/*.json` (orders, settings, audit) |
| Payments | Razorpay payment links + HMAC-verified webhooks |
| Tests | `node:test` (unit + integration) and a zero-dependency smoke suite |

---

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
- Instant search (debounced API), cart drawer, coupon codes (`LIKSHA10`, `WELCOME15`)
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
| `npm run catalog:sync-live` | pull exact descriptions + full image galleries from the live store |
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
| web | Vercel (`apps/web`) | `docs/10-deployment/vercel.md` |
| admin | Vercel subdomain (`apps/admin`) | `docs/10-deployment/vercel.md` |
| api | Render + persistent disk | `docs/10-deployment/render.md` |

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
| `docs/04-data` | data model, catalogue/order schemas, dictionary, migrations, seeds |
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

- Orders/settings persist in `.data/*.json` — single instance only; Postgres path is documented
  (`database/prisma/schema.prisma`, `docs/04-data/migrations.md`).
- Product galleries currently use the primary image only; run `npm run catalog:sync-live` on a machine
  with internet to pull every image and the store's exact `body_html` descriptions.
- Prepaid payments stay `pending` until live Razorpay keys + webhook secret are configured.
- Storefront images are hotlinked from the Shopify CDN; mirroring to object storage is a Phase 2 task.

---

© Liksha Clothing. Proprietary — not for redistribution. Built as a production system, not a template.
