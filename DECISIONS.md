# Decisions log

Architecture decisions live in `docs/03-architecture/adr/` (0010 total). Yeh file **product/business**
decisions rakhti hai — jo cheezein code me dikhti hain par reasoning kahin likhi nahi thi.

| # | Decision | Why | Date |
| --- | --- | --- | --- |
| D1 | Catalogue mirrors likshaclothing.com exactly; no invented products | User requirement: "everything same product and exact". Trust > volume. | 2026-10-24 |
| D2 | Prices stored in paise | Float rupees lose precision and invite rounding bugs in totals/GST | 2026-10-24 |
| D3 | COD capped at Rs. 3,500, Rs. 50 fee | Same as the live store's own banner; limits fake-order cost | 2026-10-24 |
| D4 | Payments via Razorpay hosted links only | User: "payment third party se karenge". No PCI scope, faster launch | 2026-10-24 |
| D5 | Guest checkout, no accounts in Phase 1 | Accounts add friction before trust exists; WhatsApp support already works | 2026-10-24 |
| D6 | `saree` collection stays empty | The live store's saree collection is empty today (verified). Fake fills would break parity | 2026-10-24 |
| D7 | `trending` = the 4 products on the live store | Verified from the live collection page; recorded in `scripts/data/collection-membership.json` | 2026-10-24 |
| D8 | Emoji product handle sanitised to ASCII (`✨-ruby…` → `ruby…`) | Emoji URLs break sitemaps/social previews; `sourceHandle` keeps traceability | 2026-10-24 |
| D9 | One image per product until `catalog:sync-live` runs | Sandbox has no outbound network; primary image is still the exact real image | 2026-10-24 |
| D10 | Inventory starts at 10 per size, manual in Phase 1 | Prevents unfulfillable orders while stock data is not integrated | 2026-10-24 |
| D11 | Admin stays a separate app on a subdomain | Customer bundle stays clean; independent deploy/rollback; easy `noindex` | 2026-10-24 |
| D12 | Orders in JSON files for Phase 1 | 5–30 orders/day; zero infra; the swap to Postgres touches one module | 2026-10-24 |
| D13 | No Google Fonts at build time | Offline/restricted CI breaks `next/font/google`; system stack + `<link>` works everywhere | 2026-10-24 |
| D14 | Free shipping on all orders | Matches the live store banner; simpler checkout, higher conversion | 2026-10-24 |
| D15 | Coupons `LIKSHA10`, `WELCOME15` | Live store advertises BOB20 as a popup coupon; ours are deliberate launch offers | 2026-10-24 |
| D16 | Status changes require an allowed transition | Prevents `placed → delivered` mistakes that corrupt revenue reporting | 2026-10-24 |

## Open questions

1. Which GST scheme (composition vs regular)? Needs the CA — affects invoice format.
2. Return window: 7 days (policy draft) vs store practice — confirm with the owner.
3. Do we mirror the store's BOB20 coupon or keep our own launch codes?
4. Image hosting: keep Shopify CDN (zero cost) vs migrate to R2 (independent, costs a little).
