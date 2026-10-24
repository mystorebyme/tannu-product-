# Seeds

## Catalogue seed

`database/seeds/seed.ts`:

1. `catalog.json` parse.
2. Collections upsert (handle, title).
3. Products upsert by `handle` — title, description, productType, vendor, price, compareAt, tags, publishedAt.
4. Variants: size + sku + `stock: 10` default (owner admin se adjust kare).
5. Images: sort order 0..n, alt default.
6. Product↔collection links.

Idempotent: dobara chalane par duplicate nahi banta (upsert on unique `handle`).

## Demo/test seed

`database/seeds/seed.dev.ts` — 3 orders (placed, packed, delivered), 5 coupons, 2 messages,
1 settings row. Sirf local/preview me.

## Inventory policy

- Default stock 10/size (COD cancellation buffer).
- Out-of-stock size UI me disabled + "Notify me" (Phase 2).
- Admin `updateStockAction` → override file; catalogue rebuild stock ko overwrite nahi kare
  (overrides loader ke through merge hota hai).

## Commands

```bash
npm run catalog:build                 # json regenerate
npx tsx database/seeds/seed.ts        # DB/override seed
npx tsx database/seeds/seed.dev.ts    # demo data (dev only)
```
