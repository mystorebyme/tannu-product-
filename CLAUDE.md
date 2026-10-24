# CLAUDE.md

Claude (ya koi bhi coding agent) ke liye entry point. Detailed rules `AGENTS.md` me hain — yahan sirf
short version aur pointers.

## TL;DR

- Monorepo: `apps/web` (3000), `apps/admin` (3001), `apps/api` (4000), shared `packages/*`.
- Paisa paise me. Server price compute karta hai. Catalogue generated JSON hai.
- 287 products, 9 collections, data source `likshaclothing.com`.
- Payments third-party (Razorpay); hum card data kabhi nahi chhoote.

## Skills (`.claude/skills/`)

`storefront-ui` · `catalogue-sync` · `order-lifecycle` · `api-module` · `admin-panel` ·
`database-prisma` · `testing` · `deploy-ops` · `monorepo-conventions` · `security-baseline` ·
`storefront-quality` · `ecommerce-payments` · `inventory-concurrency` · `india-compliance` ·
`agent-common-mistakes`

Task se match hone wali skill pehle padho — usme commands, file paths aur traps already likhe hain.

## Verify loop

```bash
npm run typecheck && npm run test:all
```

Kuch bhi ship karne se pehle: `PROGRESS.md` me ek line, aur agar behaviour badla to `docs/` update.

## Known traps

- `cd apps/admin && npx next build` (root se admin build fail hoti hai).
- `next dev` ke saath `.next` clean karo build se pehle.
- Client component me `@/lib/store` import mat karo (410KB bundle).
- `quantity` field name hai (`qty` nahi).
- Sandbox me outbound curl block hai — live data ke liye `fetch` tool ya `npm run catalog:sync-live` apni machine par.
