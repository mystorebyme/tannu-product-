# Live deployment — Vercel + Google Sheet (R18 me Vercel + Supabase tha)

> **R40 update (27 Oct):** owner ne Supabase project **khud band kar diya** — ab orders ka
> DB **sirf Google Sheet** hai (owner: *"supabase pr nhai chiye… sheet mai hi chiye… only
> sheet"*). Vercel se `DATABASE_URL` **delete** kar diya gaya. Neeche ka Postgres content
> history + dev-fallback ke liye hai; live stack = Vercel + Apps Script (**r40+**) + owner
> ki sheet. Setup: `docs/09-devops/google-sheets.md` §4g.

Render (`likshaclothing.onrender.com`) ne kaam karna band kar diya (har path par `Not Found`,
`/api/health` bhi). Isliye production stack R18 se **Vercel** par hai — same
repo, same code, zero code change ke saath.

## 1. Live URLs

| Kya | URL |
| --- | --- |
| Storefront (public) | **https://liksha-clothing.vercel.app** |
| Payment page (order ke baad) | `https://liksha-clothing.vercel.app/orders/<LK-XXXX>/pay` |
| Admin panel | **https://liksha-admin.vercel.app** (login) |
| Database | **Google Sheet (R40)** — owner ki final sheet hi orders/invoices/messages ka DB hai; ~~Supabase `Liksha Clothing`~~ project R40 me band |
| Static preview (sirf browse) | https://mystorebyme.github.io/tannu-product-/ |

## 2. Vercel projects

| Project | Root Directory | Framework | Install | Build |
| --- | --- | --- | --- | --- |
| `liksha-clothing` | `apps/web` | Next.js | `cd ../.. && npm ci` | `cd ../.. && npm run build --workspace @liksha/web` |
| `liksha-admin` | `apps/admin` | Next.js | `cd ../.. && npm ci` | `cd ../.. && npm run build --workspace @liksha/admin` |

Monorepo hone ke kaaran install/build repo root se chalta hai (`cd ../..`), output wapas app ke
`.next` me aata hai.

## 3. Environment variables

### `liksha-clothing` (storefront)

| Key | Value / kahan se |
| --- | --- |
| `DATABASE_URL` | ❌ **R40 me delete** — Supabase project owner ne band kiya; orders sirf sheet me, Postgres runtime me chahiye hi nahi |
| `NEXT_PUBLIC_SITE_URL` | `https://liksha-clothing.vercel.app` (domain lagne par `https://www.likshaclothing.com`) |
| `ADMIN_API_TOKEN` | random long string — **admin project me wahi** hona chahiye |
| `STORE_UPI_ID` | ❌ **R38 me delete** — UPI sirf sheet ke `upi_id` se aati hai (koi fallback payee nahi) |
| `STORE_UPI_NAME` | owner ke UPI account ka naam |
| `UPI_RETURN_SECRET` | random (UPI return callback signing) |
| `GOOGLE_SHEETS_WEBAPP_URL` / `GOOGLE_SHEETS_TOKEN` | owner ki sheet settings — token R38 me rotate hua (48-char; script me `?action=set_token` se) |
| `SHEET_EXPECTED_ID` | R39: `1b8DReh2RF5JeOSJeknWmH1KSE1RZgmBjatgkCDS9w_4` — owner ki **final sheet**; `/api/sheet-health` isse `idMatch` verify karta hai. Sheet badle to env update + redeploy (code change nahi) |

### `liksha-admin`

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ADMIN_API_TOKEN` (same as storefront),
`STORE_API_URL=https://liksha-clothing.vercel.app`, `NEXT_PUBLIC_STORE_URL` (same).

> `ADMIN_PASSWORD` production me zaroori hai — na ho to login band rehta hai (safety).

## 4. Data store — R40 se sheet hi DB hai

Production me koi Postgres nahi: orders, invoices, messages, newsletter — sab owner ki
Google Sheet me (Apps Script **r40+** bridge). Order create **awaited** append hai (sheet
fail → honest 503 + WhatsApp order ka raasta, jhoothi success nahi); read
`?action=order_state`/`?action=orders_state` se; owner ke sheet edits (status, Admin Note,
courier/AWB) ~2 second me site par. Backend selection: **`sheet`** (GOOGLE_SHEETS_* set ho)
→ `postgres` (DATABASE_URL ho tab — sirf dev/backup) → `json` (dev).
Check: `GET /api/health` → `{ ordersStore: "sheet" }` + `/api/sheet-health` → `ok: true`.

> **History (R18–R39, ab sirf dev-fallback):** Postgres auto-migrate — `db-schema.ts`
> (`database/schema.sql` + migrations embed), pehli query par `ensureSchema()` (advisory
> lock, idempotent). Naya DB chahiye ho (dev): `DATABASE_URL` set + `ORDERS_STORE=postgres`.

## 5. Payment + tracking flow (jo live verify hua)

```
checkout → POST /api/orders (server validation: stock, size, pincode, price)
        → order **sheet** me (R40): Orders row + `Order JSON` snapshot, status=placed,
          payment_status=pending, order number LK-…  (append fail → honest 503)
        → redirect /orders/<LK-…>/pay   (payment page ALAG)
             • order number, amount, items, live payment state
             • UPI QR + UPI ID + "Open UPI app" (mobile)
        → customer UTR daalta hai → payment_status=processing (sheet + site)
        → admin panel → payment verify (ya UPI return auto-confirm) → paid
        → order status: placed → confirmed
        → /orders/<LK-…> par tracking timeline + courier/AWB
```

Rules jo code me hard-locked hain:

- Payment confirm hone se pehle order **packed/shipped/delivered** nahi ho sakta (409 `payment_pending`).
- `payment_status` ke saare states save hote hain (R40: sheet rows + `Order JSON`): `pending`, `processing`, `paid`, `failed`, `refunded`.
- Customer ke liye `/api/orders/<num>/payment` (no-store) — payment page 8s me poll karta hai.

## 6. Deploy / redeploy

```bash
# code push (branch: arena/f713eef1-tannu-product)
git push origin arena/f713eef1-tannu-product

# Vercel: project settings → Deployments → Redeploy
# (ya CLI: vercel --prod --cwd apps/web)
```

GitHub Actions:

- `CI` — typecheck, unit/integration/db tests, web+admin build, smoke.
- `GitHub Pages preview` — static browse build.
- `Live payment + tracking smoke` — manual (`workflow_dispatch`) ya commit message me
  `[live-test]` likhne par live URL par poora public flow test karta hai (order create →
  payment page → pending → processing → tracking). Log `live-logs` branch par jaata hai.

## 7. Domain (baad me)

`NEXT_PUBLIC_SITE_URL=https://www.likshaclothing.com` set karke Vercel → Domains me
`likshaclothing.com` + `www` add karna hai; admin ke liye `admin.likshaclothing.com`.
Canonical/OG/WhatsApp links isi env se bante hain — code change nahi chahiye.

## 8. Render (purana)

`render.yaml` repo me maujood hai (backup ke liye) — par Render service abhi har path par
`Not Found` deti hai. Dobara use karna ho to Render dashboard → service → Manual Deploy +
naya Postgres. Vercel primary hai.
