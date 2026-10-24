# Admin → customer order updates

Admin jo bhi order par karta hai, customer ko `/orders/<number>` par wahi dikhna chahiye.
Ye doc Round 8 me bane parity work ka contract hai.

## 1. Status (order kahan hai)

`PATCH /api/admin/orders/:orderNumber` — `action: "status"`

```json
{ "action": "status", "status": "confirmed", "note": "size confirm ho gaya", "actor": "admin@likshaclothing.com" }
```

- Allowed transitions `@liksha/validation` me hain (`placed → confirmed → packed → shipped → delivered`).
- Invalid transition par kuch nahi likha jaata (silent no-op), UI refresh par purana status dikhta hai.
- Customer page par tracking timeline (`data-testid="order-tracking"`) me step + time dikhta hai.

## 2. Free-text note ("abhi kahan atka hai")

`PATCH /api/admin/orders/:orderNumber` — `action: "note"`

```json
{ "action": "note", "text": "Delhivery pickup kal subah", "actor": "admin@likshaclothing.com" }
```

- Type: `OrderStatusNote = { text, at, by, status }` (`@liksha/types`).
- 240 characters tak; **khaali text = note clear**.
- Audit: `order.note_updated` / `order.note_cleared`.
- Customer page: timeline ke neeche "Update from our team" box (`data-testid="order-note"`).
- Postgres: `orders.status_note` (jsonb, migration `0004`).

## 3. Payment verification (manual UPI / bank transfer)

`PATCH /api/admin/orders/:orderNumber` — `action: "payment"`

```json
{ "action": "payment", "reference": "UPI-REF-123", "amount": 199900, "actor": "admin@likshaclothing.com" }
```

- `reference` (UTR) required — bina reference payment verify nahi hoti.
- `amount` paise me (admin UI rupees me leta hai aur convert karta hai).
- Order `placed` tha to `confirmed` ho jaata hai, `paymentStatus` = `paid`, `verifiedAt`/`verifiedBy` set.
- Customer page ka payment block (`data-testid="payment-status"`) verified date + reference dikhata hai.
- Ulta case: `action: "payment_failed"` (reason ke saath) — `paymentStatus = "failed"`.

## 4. Tracking

`PATCH /api/admin/orders/:orderNumber` — `action: "tracking"`

```json
{ "action": "tracking", "courier": "Delhivery", "awb": "AWB123", "url": "https://www.delhivery.com/track/AWB123" }
```

Customer page par courier + AWB + direct tracking link.

## 5. Manual invoices (admin ke apne naam/address par)

| Method | Path | Kaam |
| --- | --- | --- |
| `GET` | `/api/admin/invoices` | saare manual invoices |
| `POST` | `/api/admin/invoices` | naya invoice (`LK/MANUAL/0001`, `0002`, …) |
| `GET` | `/api/admin/invoices/:number` | ek invoice |

- Series `LK/MANUAL/` real GST order series (`LK/YYYY-MM/`) se alag rehti hai, isliye numbering clash nahi hoti.
- Amounts **paise** me.
- Storage: Postgres `manual_invoices` (migration `0004`), local dev me `.data/manual-invoices.json`.
- Admin UI: `/invoices` (banao + list), `/invoices/<number>` (print/WhatsApp).

## Auth

Sab `/api/admin/*` routes `authorization: Bearer $ADMIN_API_TOKEN` maangte hain; token na ho ya galat ho to `401`.
Admin panel remote mode me `STORE_API_URL` + `ADMIN_API_TOKEN` se hi in routes ko call karta hai — koi local copy nahi rakhta.

## Tests

- `tests/e2e/smoke.mjs` — note save → customer page par text, payment verify → `paid` + UTR customer page par,
  invoice create/list, aur token ke bina `401`.
- `tests/db/postgres.test.ts` — `status_note` jsonb round-trip, note clear, manual invoice series + persistence.
