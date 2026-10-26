# Cloudflare Workers (vinext) — storefront ke liye (R34)

**Status: repo-prep + local workerd verification complete. Preview deploy nahi hua
(Credentials nahi diye gaye). Production DNS/Vercel abhi waisa hi hai — koi cutover
nahi hua (dekhen §8).**

Ye doc sirf **storefront** (`apps/web`) ke Cloudflare Workers path ke baare me hai.
Admin (`apps/admin`) aur Express API (`apps/api`) Node par hi chalte hain
(Render/Vercel) — unke URL aur auth contract nahi badle.

---

## 1. Kya kyun

| Cheez | Pehle | Ab (R34) |
| --- | --- | --- |
| Build | `next build` (Vercel/Render) | Wahi + **`vite build` vinext** (Cloudflare Worker bundle) |
| Dev | `npm run dev` (`next dev`, port 3000) | Wahi + **`npm run dev:vinext`** (`vite dev`, port 3001, local workerd) |
| Runtime | Node (Vercel serverless / Render) | Node **ya** workerd — code dono par chalta hai |
| Config | `next.config.ts` | + `vite.config.ts`, `cloudflare.config.ts` |
| Deploy | `vercel` / Render auto | + `npm run deploy:vinext` (`vinext-cloudflare deploy`) |

`next dev`, `next build`, Vercel aur Render ka setup **jaise tha waise hi** hai —
vinext add-on hai, replacement nahi. Rollback = sirf naye files/scripts hatao (§9).

Compatibility check (`npx vinext check`, `apps/web` me):

```
Overall: 97% compatible (18 supported, 1 partial, 0 issues)
imports  6/6     (next/link, next/server, next/navigation, next/headers, next/script, server-only)
structure        17 pages, 4 layouts, 38 route handlers, 1 error boundary, 2 not-found
config   images  partial — hum sirf <img> + CDN use karte hain, optimizer ki zaroorat nahi
```

---

## 2. Commands

```bash
# local dev — workerd par asli Workers runtime (port 3001)
npm run dev:vinext --workspace @liksha/web

# production build — output: apps/web/.cloudflare/output/v0/workers/default/bundle
npm run build:vinext --workspace @liksha/web

# built bundle ko local workerd par serve (port 8787)
npm run start:vinext --workspace @liksha/web -- --host 0.0.0.0 --port 8787

# Cloudflare par deploy (Wrangler login / CLOUDFLARE_API_TOKEN chahiye)
npm run deploy:vinext --workspace @liksha/web          # vinext deployer (build + deploy)

# ya seedha wrangler (build ke baad) — dashboard bhi yahi command chalata hai:
npm run build:vinext --workspace @liksha/web
npx wrangler deploy --config apps/web/wrangler.jsonc

# deploy se pehle: wahi config local workerd par
cd apps/web && npx wrangler dev --config wrangler.jsonc --port 8788
```

`build`/`build:vinext` dono pehle `policies:build` aur `assets:invoice-logo`
chalate hain — generated content kabhi stale nahi rehta.

---

## 3. Config files

**`apps/web/vite.config.ts`** — vinext + Cloudflare plugin, aur do Workers-only
patches (sirf is build ke liye, `next build` par asar nahi):

1. `pdfkit` → `pdfkit.node.mjs` (node ESM entry). Default browser entry module load
   hote hi `__filename` chhoo leta hai → workerd par `TypeError: Invalid URL string.`
2. `new URL('./data/sRGB…icc', import.meta.url)` → absolute URL. workerd is relative
   resolve par wahi error deta hai; PDF/A hum use nahi karte.
3. `require('#standard-fonts/X')` → static `import ... from './standard-fonts/X.mjs'`.
   Warna Workers par `No such module "#standard-fonts/Helvetica"` → invoice 500.
4. `preview.allowedHosts: true` — sirf local `vite preview` ke liye (tunnel/preview
   host). Deploy par koi asar nahi.

**`apps/web/wrangler.jsonc`** — `wrangler deploy` wala config (Cloudflare dashboard /
CLI isi ko padhta hai): `main` = build output ka `index.js`,
`assets.directory` = build output ke assets, `assets.binding: "ASSETS"`,
`run_worker_first` (HTML worker se, `/_next/static/*` assets se),
`compatibility_flags: ["nodejs_compat"]`, aur public var `NEXT_PUBLIC_SITE_URL`.
Isi ke bina Cloudflare ka default `npx wrangler deploy` static-site maan kar
*"Could not detect a directory containing static files"* error deta hai (§7.0).

**`apps/web/cloudflare.config.ts`** — worker `liksha-storefront`,
entrypoint `vinext/server/fetch-handler`, `compatibilityDate 2026-10-26`,
`compatibilityFlags ["nodejs_compat"]`, assets `runWorkerFirst` (HTML worker se,
`/_next/static/*` assets se), aur **sirf naam** declare kiye gaye secrets (§4).

---

## 4. Environment variables / secrets

Values **kabhi** repo me nahi. Local ke liye `apps/web/.dev.vars` (gitignored) ya
`apps/web/.env`; Cloudflare par `npx wrangler secret put <NAME>` (ya dashboard →
Worker → Settings → Variables and Secrets).

| Name | Type | Kya karta hai |
| --- | --- | --- |
| `DATABASE_URL` | secret | **zaroori** — Postgres (orders, invoices, payments, messages, settings) |
| `ADMIN_API_TOKEN` | secret | admin APIs (`/api/admin/*`) ka bearer token |
| `UPI_RETURN_SECRET` | secret | payment return link signature |
| `OTP_TOKEN_SECRET` | secret | OTP token sign (UI se OTP hata hua hai, server verify rehta hai) |
| `GOOGLE_SHEETS_WEBAPP_URL` | secret | owner ki sheet bridge (Apps Script) |
| `GOOGLE_SHEETS_TOKEN` | secret | sheet bridge token |
| `GOOGLE_SHEETS_SETTINGS_CSV_URL` | secret | Settings sheet ka CSV URL |
| `SHEET_SELFTEST_KEY` | secret | `/api/sheet-selftest` key-gate |
| `RESEND_API_KEY` | secret | order/contact email |
| `NEXT_PUBLIC_SITE_URL` | var | `https://designerclothing.fashion` (`wrangler.jsonc` me already set) |

> **Sheet ↔ site:** `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` set na hon to
> `/api/settings` me `sheet.configured: false` aata hai aur sheet ka UPI kabhi site
> par nahi pahunchta. Set karne ke baad `?fresh=1` par check karein (§ google-sheets.md §7).

Aur (optional, code me default hai): `STORE_UPI_ID`, `STORE_UPI_NAME`, `SELLER_*`,
`GST_HSN`, `OTP_DEV_MODE=off`, `EMAIL_FROM`, `ORDER_NOTIFICATION_EMAIL`,
`CONTACT_EMAIL`, `CORS_ALLOWED_ORIGINS`, `DB_POOL_MAX`.

Razorpay env (`RAZORPAY_*`) **jaan-boojh kar declare nahi kiye** — owner rule: koi
third-party gateway nahi, payments sirf UPI. Route dormant hai (`503 webhook not
configured`).

---

## 5. Workers par kya badla (code changes)

Workers ka file system **read-only** hai. Isliye:

| File | Change | Kyun |
| --- | --- | --- |
| `apps/web/src/lib/fs-runtime.ts` | naya shim (`existsSync`/`readFileSync`/`writeFileSync`/`renameSync`/`mkdirSync`) | Node par asli `node:fs`; Workers par likhna memory me (crash nahi) |
| `lib/{data-dir,orders,payments,store-settings,delivery,messages,manual-invoices,checkout-events,traffic}.ts` | `node:fs` → `@/lib/fs-runtime` | `EPERM: operation not permitted` se `/api/settings`, `/api/delivery/check`, `POST /api/orders` 500 ho rahe the |
| `scripts/build-policies.mjs` → `src/content/policies.generated.ts` | policies build-time bundle | `/policies/:slug` runtime `readFileSync` par 404 de raha tha |
| `scripts/build-invoice-logo.mjs` → `src/content/invoice-logo.generated.ts` | invoice logo base64 | Workers par `public/` disk se padha nahi ja sakta — invoice par wahi logo |
| `src/app/api/health/route.ts` | `runtime`, `storage`, `durable` fields | deploy ke baad ek hi call me pata chale ki data durable hai ya nahi |
| `src/app/policies/[slug]/page.tsx` | generated markdown import | runtime fs nahi |

**Sabse zaroori baat:** Workers par `DATABASE_URL` ke bina orders **memory** me
jaate hain (per-isolate, restart par gayab). `/api/health` aise case me
`"storage":"memory", "durable":false` batata hai. Production me ye **nahi** hona
chahiye.

---

## 6. Feature-by-feature runtime status (local workerd, port 8787/3001)

`✅` = workerd par chala kar dekha gaya (R34), `—` = Node-only by design.

| Feature | Route | workerd |
| --- | --- | --- |
| Home, nav, collections, PDP (variants/images) | `/`, `/collections/:handle`, `/products/:handle` | ✅ 200 |
| Search / filters | `/search`, `/api/search`, `/api/products` | ✅ 200 |
| Cart + server-side pricing | client + `/api/orders` | ✅ (price catalogue se) |
| Order create + idempotency | `POST /api/orders` | ✅ 201; same `idempotency-key` → 200 `idempotent:true` |
| Order page + tracking sach | `/orders/:orderNumber?phone=`, `/api/orders/:n/public` | ✅ status/payment/courier/AWB dikhte hain |
| Admin auth + status/tracking update | `/api/admin/*` | ✅ bina token 401, token ke saath 200; payment gate + status machine kaam karti hai |
| Payment link + UPI confirm | `/api/payments/*` | ✅ verification ke bina 401 (contract same) |
| Payment webhook (dormant) | `/api/webhooks/razorpay` | ✅ 503 (configured nahi) |
| GST invoice PDF | `/api/orders/:n/invoice?phone=` | ✅ `200 application/pdf` (~146 KB, logo embed) |
| Settings (owner sheet par) | `/api/settings`, `/api/admin/settings` | ✅ 200 |
| Delivery/pincode check | `/api/delivery/check` | ✅ 200 (valid + invalid pincode) |
| Contact / newsletter | `/api/contact`, `/api/newsletter` | ✅ 201 |
| Best-sellers | `/api/best-sellers` | ✅ 200 |
| Policies | `/policies/:slug` | ✅ 200 (chaaron) |
| SEO | `/sitemap.xml`, `/robots.txt` | ✅ 200 |
| Health | `/api/health` | ✅ 200, `runtime: cloudflare-workers` |
| Admin panel (Next server actions) | `apps/admin` | — Node (Render/Vercel) |
| Express API | `apps/api` | — Node |

**Verification (R34 me chalaya gaya):**

- `BASE_URL=http://127.0.0.1:3001 npm run test:smoke` → **88 passed, 0 failed**
  (`dev:vinext` = asli workerd + `.dev.vars`).
- `BASE_URL=http://127.0.0.1:8787 npm run test:smoke` → **88 passed, 0 failed**
  (`vite preview` = production bundle, local values `apps/web/.env` se).
  Note: secrets ke bina preview me admin-token wale checks 401 dete hain (10 checks) —
  isliye local `.env`/`.dev.vars` me dev values zaroori hain; deploy par `wrangler secret put`.
- `dev:vinext` start par warning aati hai:
  `Missing required secrets for Worker "liksha-storefront": …` — local dev me jinke paas value
  nahi, unke liye. Production me sab set hone chahiye (§4).
- Invoice PDF dono jagah `200 application/pdf` (~146 KB, logo embed); bina `?phone=` → 403.

---

## 7. Deploy — step by step (dashboard se, ya CLI se)

### 7.0 Pehle: "Could not detect a directory containing static files" kyun aaya?

Agar Cloudflare dashboard (Workers Builds / Git connected) me deploy command
`npx wrangler deploy` chala aur error aaya:

```
✘ [ERROR] Could not detect a directory containing static files (e.g. html, css and js)
```

Matlab: **repo me koi wrangler config nahi tha**, isliye wrangler ne socha ki ye
ek static-assets project hai (jinme build output `dist/` me hota hai). Hamari site
static nahi hai — ye ek **Next.js Worker** (vinext) hai, jise pehle **build** karna
padta hai aur phir `main` entrypoint + assets ke saath deploy karna hota hai.

Fix do hisson me hai (dono is repo me ho gaye):

1. **`apps/web/wrangler.jsonc`** (committed) — Worker ka `main`, `compatibility_flags: ["nodejs_compat"]`,
   assets (`binding: ASSETS`, `run_worker_first`), aur public var `NEXT_PUBLIC_SITE_URL`.
2. **Deploy se pehle build** — `npm run build:vinext --workspace @liksha/web`
   (output: `apps/web/.cloudflare/output/v0/workers/default/{bundle,assets}`).

Yaani deploy command ko sirf `npx wrangler deploy` nahi rehna chahiye — neeche exact
fields hain.

### 7.1 Cloudflare dashboard (Git connected) — exact fields

Workers & Pages → apna Worker (`liksha-storefront`) → **Settings → Build**:

| Field | Value |
| --- | --- |
| **Git repository** | `mystorebyme/tannu-product-` |
| **Production branch** | `arena/f713eef1-tannu-product` (ya `main`, jab merge ho jaye) |
| **Root directory** | *(khaali chhod dein — repo root)* |
| **Build command** | `npm ci && npm run build:vinext --workspace @liksha/web` |
| **Deploy command** | `npx wrangler deploy --config apps/web/wrangler.jsonc` |
| **Node version** | `22` (`NODE_VERSION=22` build env var) |

> Root directory `apps/web` **na** rakhein — npm workspaces ka install repo root se
> hota hai (`@liksha/types` etc. wahin resolve hote hain).

Worker name config me `liksha-storefront` hai — dashboard ka Worker naam bhi wahi
rakhein, warna deploy **naya** Worker bana dega.

### 7.2 Secrets / env (dashboard)

Worker → **Settings → Variables and Secrets** (production) — ye names exactly:

| Name | Type | Value kahan se |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Postgres (Supabase/Neon) connection string — **iske bina orders memory me** |
| `ADMIN_API_TOKEN` | Secret | wahi token jo admin panel use karta hai |
| `GOOGLE_SHEETS_WEBAPP_URL` | Secret | Apps Script `/exec` URL (`?action=settings` wala) |
| `GOOGLE_SHEETS_TOKEN` | Secret | Apps Script ka `TOKEN` |
| `GOOGLE_SHEETS_SETTINGS_CSV_URL` | Secret (optional) | published Settings CSV — Apps Script down ho to fallback |
| `UPI_RETURN_SECRET` | Secret | random string (`openssl rand -hex 24`) |
| `OTP_TOKEN_SECRET` | Secret | random string |
| `SHEET_SELFTEST_KEY` | Secret (optional) | `/api/sheet-selftest` gate |
| `RESEND_API_KEY` | Secret (optional) | email |
| `NEXT_PUBLIC_SITE_URL` | Var (already config me) | `https://designerclothing.fashion` |

**Sheet wala UPI/diagnostics tabhi kaam karega jab `GOOGLE_SHEETS_WEBAPP_URL` (+ token)
set ho.** Set na ho to `/api/settings` me `sheet.configured: false` dikhega —
yahi wajah hoti hai ki "sheet me UPI badla par site par nahi aaya".

### 7.3 CLI se deploy (laptop / sandbox / CI)

```bash
# ek baar login (ya CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env me)
npx wrangler login

# 1) secrets (ek-ek; value paste, repo me kabhi nahi)
npx wrangler secret put DATABASE_URL      --config apps/web/wrangler.jsonc
npx wrangler secret put ADMIN_API_TOKEN   --config apps/web/wrangler.jsonc
npx wrangler secret put GOOGLE_SHEETS_WEBAPP_URL --config apps/web/wrangler.jsonc
npx wrangler secret put GOOGLE_SHEETS_TOKEN      --config apps/web/wrangler.jsonc
npx wrangler secret put UPI_RETURN_SECRET --config apps/web/wrangler.jsonc
npx wrangler secret put OTP_TOKEN_SECRET  --config apps/web/wrangler.jsonc

# 2) build + deploy
npm run build:vinext --workspace @liksha/web
npx wrangler deploy --config apps/web/wrangler.jsonc

# (vikalp) vinext ka apna deployer — build bhi khud karta hai:
npm run deploy:vinext --workspace @liksha/web
```

`apps/web` ke andar se chalane par `--config` ki zaroorat nahi (config wahin hai).

### 7.4 Deploy se pehle local pe wahi config test karein

```bash
npm run build:vinext --workspace @liksha/web
cd apps/web && npx wrangler dev --config wrangler.jsonc --port 8788
# teesre terminal me:
BASE_URL=http://127.0.0.1:8788 npm run test:smoke      # R35: 85 pass / 0 fail
```

`wrangler deploy --dry-run` bhi useful hai (upload ke bina config check):

```bash
npx wrangler deploy --config apps/web/wrangler.jsonc --dry-run
# → Read 78 files from the assets directory … / Total Upload: ~6.7 MiB / gzip ~1.5 MiB
```

### 7.5 Deploy ke baad smoke (asli domain/worker URL par)

```bash
BASE=https://liksha-storefront.<account>.workers.dev
curl -s $BASE/api/health | python3 -m json.tool          # storage=postgres, durable=true chahiye
curl -s $BASE/api/settings | python3 -m json.tool        # sheet.configured/readFrom dekho
curl -s -o /dev/null -w '%{http_code}\n' $BASE/          # 200
curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/admin/orders   # 401
```

**`/api/health` me `durable:true` na dikhe to us Worker par orders durable nahi** —
pehle `DATABASE_URL` set karein, phir traffic badhayein.

### 7.6 Custom domain (abhi nahi)

`www.designerclothing.fashion` / apex ko Cloudflare Worker par **sirf tab** le jaayein
jab owner Vercel se cutover ka faisla kare (Worker → Settings → Domains & Routes).
Domain abhi Vercel par hai — is doc ka koi step DNS nahi badalta.

---

## 8. Kya **nahi** kiya gaya (jaan-boojh kar)

- Production DNS touch nahi hua; `designerclothing.fashion` abhi bhi Vercel par.
- Cloudflare account/credentials nahi the → **preview deploy nahi hua**, sirf local
  workerd par verify hua.
- Vercel/Render/GitHub Pages config hataya nahi gaya; `next dev`/`next build` intact.
- Postgres-over-Workers end-to-end **test nahi** hua (sandbox me Postgres nahi tha).
  Isliye preview deploy ke pehle `/api/health` check anivarya hai (§7 step 3).
- Admin panel (`apps/admin`) ko vinext par migrate nahi kiya — server actions +
  HMAC session + middleware ka apna audit chahiye (alag kaam).

---

## 9. Rollback

Repo: `git revert <R34 commit>` — vinext files/scripts hat jaate hain, `next build`
waisa hi chalta rehta hai (ye changes Next path ko chhoote nahi). Deployed preview
Worker: Cloudflare dashboard → Worker `liksha-storefront` → Deployments → pichla
version, ya Worker delete. **Vercel production par koi asar nahi** — DNS wahin hai.

---

## 10. Known limitations

| Cheez | Asar | Hal |
| --- | --- | --- |
| `DATABASE_URL` bina deploy | orders memory me (restart par gone) | `/api/health` → `durable:true` check; Postgres/Hyperdrive set karein |
| Postgres TCP from Workers | sandbox me verify nahi hua | preview deploy par health check; Hyperdrive recommended |
| `pdfkit` bundle ~1 MB | Worker size badhta hai (limits ke andar) | chaho to invoice PDF ko alag service par le jaayein |
| `.cloudflare/` build output | audit me na aaye | `scripts/repo-audit.mjs` aur `.gitignore` me excluded |
| `cf@1.0.0-beta.23` engine warning (node ^22.23) | sirf warning, build chalti hai | Node minor bump (alag decision) |
