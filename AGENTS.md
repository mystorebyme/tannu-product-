# AGENTS.md — working rules for AI coding agents

Read this first. Then `STRUCTURE.md`, then `PROGRESS.md`, then the matching skill in `.claude/skills/`.

## The 10 rules

1. **Money = integer paise.** No floats, no rupees in storage. `formatPrice()` only at render time.
2. **Never trust client prices.** Orders are priced from the catalogue on the server.
3. **Catalogue is generated.** Change `scripts/build-catalog.mjs`, `scripts/data/*`, or run
   `npm run catalog:sync-live`; never hand-edit `catalog.json` copies inside apps.
4. **Business rules live once** — `packages/validation/index.ts` (coupons, COD limits, status machine,
   order number format). Import it, don't copy it.
5. **Server vs client:** `@/lib/store` and anything touching `fs` is server-only. Client components
   never import the catalogue.
6. **Validate at the edge.** zod schema on every write path; `String(req.params.x)` in Express handlers.
7. **Every admin mutation writes an audit entry** and calls `revalidatePath`.
8. **Idempotency + atomic writes** for anything money-related (`.data/*.json`, tmp+rename).
9. **Tests are part of the change.** Unit for rules, integration for endpoints; run `npm run test:all`.
10. **Docs and code ship together.** If behaviour changes, update `docs/0X-…` and `PROGRESS.md`.

## Golden commands

```bash
npm run typecheck                 # must be clean before you stop
npm run test:all                  # unit + integration
npm run catalog:verify            # if catalogue touched
npm run build:web                 # if storefront touched
cd apps/admin && npx next build   # admin root se build nahi hoti
npm run dev / dev:admin / dev:api # ports 3000 / 3001 / 4000
```

## Never do

- `git push` to any branch other than the session branch; never rewrite history on `main`.
- Add a dependency without need (no UI kit, no state library, no animation library).
- Put secrets in `NEXT_PUBLIC_*` or in the repo.
- Use `next/font/google` (breaks offline builds) or `next/image` with the Shopify CDN.
- Delete or rename `database/seeds/catalog.json` structure without updating tests.
- Invent product data. `likshaclothing.com` is the only source of truth.

## When stuck

| Symptom | Where to look |
| --- | --- |
| Build oddities | `docs/08-testing` + `agent-guides/troubleshoot-storefront.md` |
| Order/money bug | `.claude/skills/order-lifecycle` |
| API shape change | `.claude/skills/api-module` + `docs/06-api` |
| Admin behaviour | `.claude/skills/admin-panel` |
| Catalogue mismatch | `.claude/skills/catalogue-sync` |
| Deploy | `.claude/skills/deploy-ops` |

## Definition of done

Typecheck clean · tests pass · mobile 360px checked · empty/error states handled · docs updated ·
`PROGRESS.md` line added.
