# Deploy — storefront & admin (Vercel)

## Projects

| Project | Root | Domain |
| --- | --- | --- |
| liksha-web | `apps/web` | likshaclothing.com, www |
| liksha-admin | `apps/admin` | admin.likshaclothing.com |

## Settings

- Framework: Next.js (auto-detected)
- Node: 22.x
- Install: `npm install` (workspace root — Vercel root directory ke parent se install)
- Build: `npm run build --workspace @liksha/web`
- Output: `.next`
- Region: `bom1` (Mumbai) — Indian traffic ke liye lowest TTFB

## Env vars (web)

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `ORDERS_API_URL`, `ADMIN_API_TOKEN`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`

## Env vars (admin)

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `LIKHSA_DATA_DIR` (agar shared volume nahi to API mode), `API_BASE_URL`

## Deploy flow

```bash
vercel --prod                  # web (root se, project linked)
cd apps/admin && vercel --prod
```

GitHub integration on: `main` push = prod deploy; PR = preview URL.

## Notes

1. `.data` Vercel par ephemeral hai — orders **API/Render** par persist hone chahiye. Isliye prod me
   `ORDERS_API_URL` set karke web ka `/api/orders` proxy mode use karo (Phase 2 hardening item).
2. Admin same reason se API mode recommend; standalone mode sirf single-instance deploy (Render) par.
3. Image domains `next.config.ts` me `cdn.shopify.com` + `images.remotePatterns`.
