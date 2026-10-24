# Deploy — Render (storefront + admin + Postgres)

Yeh production deployment hai: `https://likshaclothing.onrender.com`.
Sab kuch repo ke `render.yaml` (Blueprint) se banta hai — dashboard me manually service banane ki
zaroorat nahi.

## Kya banta hai

| Resource | Naam | Kya karta hai |
| --- | --- | --- |
| Web service | `liksha-storefront` | Customer site + `/api/admin/orders` (admin API) |
| Web service | `liksha-admin` | Admin panel (`STORE_API_URL` se storefront ko call karta hai) |
| Postgres | `liksha-db` | Orders, items, shipments, payments, invoices |

## Steps

1. Render dashboard → **New → Blueprint** → repo `mystorebyme/tannu-product-` → branch select.
2. Blueprint padhne ke baad **Apply** — teen resources ban jaate hain.
3. `liksha-admin` ke env me `ADMIN_PASSWORD` set kariye (`sync: false`, dashboard se).
   Login email default `admin@likshaclothing.com` hai.
4. Pehla deploy par storefront ka start command `npm run db:migrate` chalata hai:
   `database/schema.sql` (pehli baar) + `database/migrations/*.sql`, phir `next start`.

## Env vars (blueprint se automatic)

| Key | Kahan | Value |
| --- | --- | --- |
| `DATABASE_URL` | storefront | `liksha-db` ka internal connection string |
| `ADMIN_API_TOKEN` | storefront → generated, admin → `fromService` | dono me same (admin API auth) |
| `NEXT_PUBLIC_SITE_URL` | storefront | `https://likshaclothing.onrender.com` |
| `OTP_TOKEN_SECRET`, `ADMIN_SESSION_SECRET` | generateValue | automatic |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | admin | dashboard me set |
| `STORE_API_URL` | admin | `https://likshaclothing.onrender.com` |
| `OTP_DEV_MODE` | storefront | `on` (Firebase keys lagne tak dev OTP) |

Baad me real integrations: `FIREBASE_*` keys + `OTP_DEV_MODE=off`, `SELLER_GSTIN` (GST invoice),
`WHATSAPP_NUMBER` (order confirmation / payment verify).

## Data flow

```
customer → storefront (:443)  ── orders/payments ──► Postgres
admin panel ──Bearer ADMIN_API_TOKEN──► storefront /api/admin/orders
                                        └─ status/tracking/payment update → Postgres
```
Customer ka track page (`/orders/LK-XXXX`) usi DB se padhta hai, isliye admin jo status/AWB save
karta hai wo turant customer ko dikhta hai.

## Free plan ki limits (jaanna zaroori)

1. Free Postgres **30 din** me expire hota hai — dashboard se renew karte rehna, warna naya DB khali
   milega. Paid plan lene par yeh issue khatam.
2. Free web service 15 min idle par sleep karti hai → pehla request ~50s (cold start).
3. Free plan par disk nahi hota — isliye orders Postgres me hain, disk par nahi.
4. Admin ke settings/manual-invoice data abhi admin service ke local dir me hain (redeploy par reset).

## Health / verify

- `GET /api/health` → `{"data":{"status":"ok","ordersStore":"postgres"}}` — `ordersStore` `postgres`
  dikhe to DB connected hai.
- `GET /api/admin/orders` (Bearer `ADMIN_API_TOKEN`) → orders list.
- Admin panel → Orders → order kholiye → status + courier/AWB save kariye → customer page refresh.

## Migrations

```bash
DATABASE_URL=postgres://… npm run db:migrate          # apply (idempotent)
npm run test:db                                      # Postgres path ka test (WASM Postgres)
```

Naya migration add karna ho to `database/migrations/0002_xxx.sql` banao — blueprint ke start command
se apne aap apply ho jayega (advisory lock se double-run nahi hota).
