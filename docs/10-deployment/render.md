# Deploy — API (Render)

## Service

| Property | Value |
| --- | --- |
| Type | Web Service (Node) |
| Repo | `mystorebyme/tannu-product-` |
| Root | repo root (workspaces) |
| Build | `npm ci && npm run build --workspace @liksha/api` (esbuild → `apps/api/dist/server.cjs`) |
| Start | `node apps/api/dist/server.cjs` |
| Health check | `/api/v1/health` |
| Region | Singapore / Mumbai (nearest) |
| Disk | 1GB mounted at `/app/.data` |

## Worker (email)

Separate Background Worker: `node apps/api/dist/worker.cjs`, same disk, same env.

## Env vars

`NODE_ENV=production`, `PORT=10000` (Render injects), `WEB_ORIGIN`, `ADMIN_ORIGIN`,
`ADMIN_API_TOKEN`, `RAZORPAY_*`, `RESEND_API_KEY`, `LIKHSA_DATA_DIR=/app/.data`.

## Deploy hook

`https://api.render.com/deploy/srv-xxx?key=yyy` — CI se curl; ya auto-deploy on `main`.

## Notes

1. Free tier sleep = 50s cold start → orders fail. Paid instance (Starter) minimum for prod.
2. Persistent disk single instance se bandha hai — scale-out ke liye Postgres (Phase 2).
3. Zero-downtime: Render rolling deploy; health check pass hone tak purana instance chalta hai.
4. DB backup: `bash database/scripts/backup.sh` → disk snapshot + weekly download.
