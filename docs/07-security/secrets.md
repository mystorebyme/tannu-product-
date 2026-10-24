# Secrets management

## Inventory

| Secret | Used by | Exposure if leaked |
| --- | --- | --- |
| `ADMIN_PASSWORD` | admin | full store control |
| `ADMIN_SESSION_SECRET` | admin | session forgery |
| `ADMIN_API_TOKEN` | admin → api | order read/status write |
| `RAZORPAY_KEY_ID` | web/api | public-ish (Publishable) |
| `RAZORPAY_KEY_SECRET` | api | charge/refund |
| `RAZORPAY_WEBHOOK_SECRET` | api | fake paid events |
| `RESEND_API_KEY` | api | email spoofing |
| `DATABASE_URL` | Phase 2 | full data |

## Rules

1. Secrets sirf env vars me — repo me nahi (`.env*` gitignored, `.env.example` sirf keys + placeholders).
2. `NEXT_PUBLIC_*` = public by definition; usme koi secret kabhi nahi.
3. Dev defaults code me hain (`dev-only-secret-change-me`) — production me boot par fail karo agar default mile.
4. Logs me secrets/PII nahi (mask phone `98******10`).
5. Rotate schedule: `docs/06-api/auth.md`.
6. Local: `.env.local` (gitignored). Preview/prod: host dashboard (Vercel/Render env).

## Boot validation

`config/env.ts` zod se required keys validate karta hai; production me missing/weak → process exit.

## Leak response

1. Rotate secret (dashboard) → 2. redeploy → 3. provider dashboard me revoke → 4. audit log check
   → 5. `docs/11-maintenance/changelog.md` me entry (impact likho).
