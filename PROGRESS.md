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

## Next up

1. `npm run catalog:sync-live` (internet) → full galleries + store descriptions → `catalog:verify` → deploy.
2. Razorpay live keys + webhook → test Rs. 1 payment → refund.
3. Final price spot-check (10 random products) with the owner.
4. ~~Homepage hero copy for Diwali/November 2026~~ — done (Diwali 2026 copy + dispatch cutoff).
5. Go-live checklist (`docs/10-deployment/go-live-checklist.md`).
