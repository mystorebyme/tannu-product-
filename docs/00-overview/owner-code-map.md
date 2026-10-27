# Code Map — "Ye sab kahan hai code mai?"

> Ye doc sirf aapke liye hai (owner). Isme har feature ka **exact file** aur **exact function** likha hai.
> Aapko manually kuch daalna ho to seedha isi table se file kholiye.
> Saare path root (`tannu-product-/`) se shuru hote hain.

---

## 0. Pehle 2 minute: project ka shape

Repo me **do Next.js apps** hain (ek hi repo, do deploy):

| App | Folder | Kaam | Live URL |
| --- | --- | --- | --- |
| Storefront (customer) | `apps/web/` | website, products, cart, checkout, payment, tracking | **`designerclothing.fashion`** |
| Admin (aapka panel) | `apps/admin/` | orders, payment verify, invoice, products, pincode block | **`admin.designerclothing.fashion`** |
| Shared types | `packages/types/` | `Product`, `Order` wagairah ka TypeScript shape | — |
| Catalog data | `database/seeds/**` → build par `apps/web/src/data/catalog.json` | saare 446 products + collections + prices | — |
| Google Sheet script | `scripts/google-apps-script/liksha-sheets.gs` | sheet me row likhne wala Apps Script | aapke Google account me |

**Rule:** `/docs/00-overview/` me jo bhi doc hai wo explanation hai; **code sirf `apps/`, `packages/`, `scripts/` me hai.**

---

## 1. "Main ye badalna chahta hoon" — seedha jawab

| Aap kya badalna chahte hain | File kholiye | Function / jagah |
| --- | --- | --- |
| Phone / WhatsApp number | **Sheet → `Settings` tab** (code nahi) | keys: `support_phone`, `whatsapp` |
| UPI ID / payee naam | **Sheet → `Settings` tab** (code nahi) | keys: `upi_id`, `upi_name` |
| Announcement / sale line (top bar) | **Sheet → `Settings` tab** | key: `announcement` |
| Free shipping on/off | **Sheet → `Settings` tab** | key: `free_shipping` = `true`/`false` |
| Support email | **Sheet → `Settings` tab** | key: `support_email` |
| GSTIN (invoice par) | **Sheet → `Settings` tab** ya Admin → Settings | key: `gstin` / `apps/admin/src/app/(admin)/settings/page.tsx` |
| Product ka price (₹499/549/599/649/699) | `database/seeds/live/products.json` + `database/seeds/extra/products.json` | har product ka `price` (paise me, ₹499 = `49900`) |
| Size ke hisaab se extra price (XL +100 …) | `apps/web/src/data/catalog.json` → `sizePricing` | build par seed se aata hai; admin se `updatePriceAction` |
| Product ka photo | `database/seeds/*/products.json` → `images[]` | CDN URL (`cdn.shopify.com/...`) |
| Product ko site par chhupana/dikhana | Admin → Products (toggle) | `apps/admin/src/app/actions.ts` → `toggleProductVisibilityAction` |
| Naya product jodna | Admin → Products → New | `apps/admin/src/app/actions.ts` → `createProductAction` |
| Header / menu / nav links | `apps/web/src/components/site-header.tsx` | `nav` array + `SiteHeader` |
| Footer (links, address, social) | `apps/web/src/components/site-footer.tsx` | `SiteFooter` |
| Logo (badalna nahi hai, sirf reference) | `apps/web/public/images/brand/` | `brand-lockup.tsx` use karta hai |
| Checkout me state/pincode galat ho to rokna | `apps/web/src/lib/state-match.ts` + `lib/orders.ts` | `statesMatch()`, `createOrder()` |
| Pincode block (state-wise / per-pincode) | Admin → Delivery | `apps/admin/src/app/actions.ts` → `saveDeliverySettingsAction`, `togglePinRuleAction` |
| Payment page ka text / UTR / last-4 logic | `apps/web/src/components/upi-payment.tsx` | `submit()`, `claimPaid()` |
| WhatsApp screenshot bhejne ka button | `apps/web/src/components/upi-payment.tsx` | `data-testid="upi-whatsapp-screenshot"` + `lib/whatsapp.ts` → `whatsappLink()` |
| Sheet ke 7 tab / columns | `scripts/google-apps-script/liksha-sheets.gs` | `HEADERS` object (line ~82) |
| Sheet ka id (account badalna ho to) | `scripts/google-apps-script/liksha-sheets.gs` | `SPREADSHEET_ID` (line ~150) + `GIDS` |
| GST invoice ka format | `apps/web/src/lib/invoice.ts` + `invoice-pdf.ts` | `buildInvoice()`, `renderInvoicePdf()` |
| Order status / tracking | Admin → Orders → order kholiye | `setOrderTracking`, `updateOrderStatusAction` |
| Reviews (daily auto-update) | `database/seeds/reviews/` → `apps/web/src/data/reviews.json` | `apps/web/src/lib/reviews.ts` → `reviewsFor()` |
| Domain / DNS | code nahi — Vercel + GoDaddy/Hostinger DNS | `docs/00-overview/sheet-setup-owner.md` §Domain |
| Env variables (secrets) | Vercel → Project → Settings → Environment Variables | list §12 niche |

---

## 2. Storefront: page → file

| Page (URL) | File |
| --- | --- |
| Home `/` | `apps/web/src/app/page.tsx` |
| Product listing `/collections/[handle]` | `apps/web/src/app/collections/[handle]/page.tsx` |
| Product detail `/products/[handle]` | `apps/web/src/app/products/[handle]/page.tsx` |
| Cart `/cart` | `apps/web/src/app/cart/page.tsx` + `components/cart-provider.tsx` |
| Checkout (step 1–3: delivery → review → **payment**) `/checkout` | `apps/web/src/app/checkout/page.tsx` + `components/checkout-form.tsx` + `components/checkout-payment-step.tsx` |
| Saved delivery details (browser cache) | `apps/web/src/lib/checkout-details.ts` |
| **Sheet = order ka DB (R37)** — status/courier/AWB/note sheet se merge | `apps/web/src/lib/sheet-tracking.ts` + `apps/web/src/lib/sheet-merge.ts` (Apps Script: `scripts/google-apps-script/liksha-sheets.gs` → `onEdit` + `?action=timeline`) |
| **Sheet HI orders ka DB (R40)** — create/read/update sab sheet se; Supabase/Postgres runtime se out; sheet id kahin hardcoded nahi | `apps/web/src/lib/orders-sheet.ts` + `lib/sheet-merge.ts` (`parseOrderState`/`orderFromSheetRows`) + script `?action=order_state`/`orders_state`/`sheet_set`; auto-heal `lib/google-sheets.ts` → `healSheetConfig()` |
| **Sheet pipeline report card (R38)** — owner browser me khud diagnose kare | `apps/web/src/app/api/sheet-health/route.ts` (public) + script ka `?action=health`; likhne ka hisaab `sheetWriteInfo()` (`lib/google-sheets.ts` retry ke saath) |
| **Token paste-proof (R38)** — script ka token Script Properties me | `liksha-sheets.gs` → `effectiveToken_` + `?action=set_token` (ek baar) + `?action=adopt` (bound sheet apnao); UPI sirf sheet se — payment pause state `components/upi-payment.tsx` (`upi-unavailable`) |
| **India timezone (R39)** — har date IST me | `apps/web/src/lib/format.ts` (`STORE_TIME_ZONE`) + `lib/tracking.ts` + `lib/invoice-pdf.ts` + `apps/admin/src/lib/format.ts` — sab `timeZone: "Asia/Kolkata"` pin |
| **Sheet-driven per-order note (R39)** — Admin Note column | script r39-1: `HEADERS.Orders` + `timeline_().adminNote` + `onEdit` branch → site: `lib/sheet-merge.ts` (`adminNote` hamesha jeetta) → `orders/[orderNumber]/page.tsx` note-box (`order-note-box`, default "Waiting for confirmation") |
| **/exec control panel (R39)** — browser se script ki sehat | `liksha-sheets.gs` → `controlPanel_()` (action ke bina GET = HTML panel; website ka JSON contract same) |
| **Final sheet id (R39)** | `1b8DReh2RF5JeOSJeknWmH1KSE1RZgmBjatgkCDS9w_4` — `.gs` `SPREADSHEET_ID`, `lib/google-sheets.ts` `EXPECTED_SHEET_ID`, `scripts/sheets-selfcheck.mjs`, Vercel env `SHEET_EXPECTED_ID` |
| Phone prefix auto-fix (`+91`/`91`/`0` → 10 digit) | `apps/web/src/lib/phone.ts` + `packages/validation/index.ts` (`phoneSchema`) |
| Step 3 ka data API | `apps/web/src/app/api/orders/[orderNumber]/payment-context/route.ts` |
| Order confirm / tracking `/orders/[orderNumber]` | `apps/web/src/app/orders/[orderNumber]/page.tsx` |
| Payment deep link (WhatsApp/email/QR) `/orders/[orderNumber]/pay` | `apps/web/src/app/orders/[orderNumber]/pay/page.tsx` + `components/upi-payment.tsx` |
| Track order form `/track-order` | `apps/web/src/app/track-order/page.tsx` + `components/track-order-form.tsx` |
| Wishlist / Compare | `apps/web/src/app/wishlist/`, `apps/web/src/app/compare/` |
| Account `/account` | `apps/web/src/app/account/page.tsx` |
| Contact | `apps/web/src/app/pages/contact/page.tsx` + `components/contact-form.tsx` |
| Policies (privacy/return/shipping) | `apps/web/src/app/policies/[slug]/page.tsx` + `content` folder |
| Search | `apps/web/src/app/search/page.tsx` + `components/search-bar.tsx` |
| 404 | `apps/web/src/app/not-found.tsx` |

### 2.1 Product / price / stock ka source of truth

```
database/seeds/live/products.json     ← likshaclothing.com se aaye asli products (287)
database/seeds/extra/products.json    ← thestoreofbufani.com se extra (159)
database/seeds/catalog.json           ← dono merge + colour group + collection mapping
        │  (build step)
        ▼
apps/web/src/data/catalog.json        ← 446 products, build ke waqt copy
        │
        ▼
apps/web/src/lib/store.ts             ← products, collections, colourGroups, findProduct()
apps/web/src/lib/colour.ts            ← ek design ke saare colour = ek card
apps/web/src/lib/best-sellers.ts      ← "Best sellers" auto (order count se, hardcode nahi)
```

- Price **paise** me hai: `₹499 → 49900`.
- Size ka extra price: product ke `sizePricing` me (`{ XL: { price: 54900, available: true } }`).
- `apps/web/src/lib/store.ts` → `findProduct(handle)` server par product dhoondhta hai; `createOrder()` isi se price confirm karta hai (client ka bheja price **nahi** maanta — isliye koi price hack nahi kar sakta).

---

## 3. Store settings — sheet se live (koi hardcode nahi)

Sheet → **`Settings` tab** me row badalne se **turant** website par badal jaata hai:

```
Sheet "Settings" tab (key | value)
        │  Apps Script doGet → JSON
        ▼
apps/web/src/lib/google-sheets.ts   → readSheetSettings()   (CACHE_MS = 15s)
        │
        ▼
apps/web/src/lib/sheet-format.ts    → normaliseSheetSettings()  (naam ka mapping)
        │
        ▼
apps/web/src/lib/store-settings.ts  → getStoreSettings()        (5s memory cache)
                                    → getStoreSettingsFast(700) (pay/track page — turant)
        │
        ▼
components/store-settings-provider.tsx  → poore site par context
```

**Settings keys (exact naam):**

| Key | Kaam |
| --- | --- |
| `support_phone` | footer/contact me number (8005900581) |
| `whatsapp` | WhatsApp button ka number |
| `support_email` | email |
| `upi_id` | payment page ka UPI — **sirf owner ki sheet se** (R38: koi code default nahi) |
| `upi_name` | UPI app me dikhne wala payee naam |
| `announcement` | top announcement bar |
| `gstin` | invoice par GSTIN |
| `free_shipping` | `true` / `false` |
| `admin_url` | admin panel ka link |

**Zaroori:** sirf 2 column rakhiye (key, value). Row ka **naam badalna nahi** — `sheet-format.ts` ke mapping se juda hai.

---

## 4. Checkout — 3 step, aur "very fast order"

**Step 1 + 2 ek hi screen par: address** (owner rule: address aur payment kabhi ek screen par nahi).
Payment **step 3 alag page** par, order banne ke baad.

```
components/checkout-form.tsx      → form, pincode check, state↔pincode guard
        │  POST
        ▼
app/api/orders/route.ts           → POST handler
        │
        ▼
lib/orders.ts → createOrder()     ← asli validation + price + order number
    ├─ lib/delivery.ts     → checkPincode()        (serviceable? blocked?)
    ├─ lib/state-match.ts  → statesMatch()         (pincode ka state match?)
    ├─ lib/store.ts        → products / findProduct
    ├─ **R40: lib/orders-sheet.ts → persistOrderEvent()**   ← AWAITED batch append
    │        (Orders row + `Order JSON` snapshot + OrderItems rows + Payments row)
    ├─ lib/orders-pg.ts    → saveOrders()          (sirf DATABASE_URL ho tab — dev/backup)
    └─ JSON fallback       → ephemeral file        (dev only — production me nahi)
```

**Owner rules "order turant bane" + "only sheet" (R40 balance):**

- **R40: sheet write `await` hota hai** — sheet hi DB hai, isliye row likhe bina customer ko
  "order placed" nahi bolte (fail → honest 503 + WhatsApp order ka raasta). Par ek **batch**
  append hai (Orders+OrderItems+Payments ek hi POST me) + 2s TTL cache — order ~1–2s me banta hai.
- Payment page `getStoreSettingsFast(700)` use karta hai → sheet slow ho to bhi page turant khulta hai
  (`lib/store-settings.ts`).
- Order read: `getOrder()` → `?action=order_state` (JSON snapshot + owner ke sheet edits ka
  overlay); list `?action=orders_state` (newest-first, admin `/orders` isi se).

**Order number format** → `lib/orders.ts` → `generateOrderNumber()`.

**State mismatch ka error** → `lib/orders.ts` line ~157 (`state_mismatch`) + `lib/state-match.ts`.

---

## 5. Payment (step 3) — UPI, UTR, last-4, screenshot

```
app/orders/[orderNumber]/pay/page.tsx     ← page (server) — settings + order
components/upi-payment.tsx                ← poora payment UI + logic
    ├─ components/upi-qr.tsx              ← QR (UPI app se scan)
    ├─ lib/upi.ts → buildUpiUri()         ← "upi://pay?pa=…&am=…&tn=…" (koi gateway nahi)
    ├─ submit()                           ← 3 tarike se submit:
    │     1. UTR (12 digit) daala → claim
    │     2. UTR khaali + last 4 digit daala → claimPaid() (smart submit)
    │     3. WhatsApp par screenshot → data-testid="upi-whatsapp-screenshot"
    └─ components/payment-status-watcher.tsx  ← status poll (pending/success/failed)
            │  POST
            ▼
app/api/payments/claim/route.ts   → art payment claim (UTR / last4)
app/api/payments/failed/route.ts  → customer "payment fail hua"
app/api/payments/manual/route.ts  → manual claim (screenshot wala case)
app/api/payments/status/route.ts  → watcher isse poll karta hai
        │
        ▼
lib/payments.ts / lib/payments-orders.ts → payment record + order update
lib/upi.ts → normaliseUpiReference()     (UTR 12 digit, last4 4 digit validate)
```

**Sheet me kya jaata hai:** payment submit/verified par `"Payments"` tab me nayi row
(`lib/orders.ts` → `syncOrderToSheet(order, "payment.pending" | "payment.paid")`).

**Owner ke liye verify:** Admin → Payments → order kholiye → `verifyPaymentAction` / `reversePaymentAction`.

⚠️ **Koi brand naam UI me nahi** (GPay/PhonePe/Paytm likha nahi jaata) — sirf "UPI app" + icons-free text.
Wo text `components/upi-payment.tsx` me hai.

---

## 6. Google Sheet — "db sheet me data nahi aa raha" ka poora rasta

### 6.1 Sheet kaun si hai (asli)

| | |
| --- | --- |
| Sheet | **Designer Clothing — Store (Orders · Payments · Settings)** |
| id | `1b8DReh2RF5JeOSJeknWmH1KSE1RZgmBjatgkCDS9w_4` |
| Link | https://docs.google.com/spreadsheets/d/1b8DReh2RF5JeOSJeknWmH1KSE1RZgmBjatgkCDS9w_4/edit |

⚠️ Purane `pub?output=csv` link (`2PACX-1vTLs42cuo-…`, gids 1135948941/1261780310/…) **doosre account ki copy** ke hain — un gid ka koi tab is sheet me nahi. Code **naam** se tab dhoondhta hai, isliye tab ka **naam** badalna mat.

> **R40: ye id code me kahin hardcoded nahi** — script me sirf Script Properties (`SHEET_ID`),
> site me sirf env (`SHEET_EXPECTED_ID`, wo bhi sirf auto-heal ke liye). Sheet badalni ho to
> script ke `/exec` par "Sheet URL set karein" form ya `?action=sheet_set&id=…` — **koi
> redeploy nahi, koi code change nahi**. Ye doc sirf owner ki reference ke liye hai.

### 6.2 Tabs aur unke columns (R40 — exact count `.gs` `HEADERS` me)

| Tab | Columns |
| --- | --- |
| `Settings` | `key`, `value` (2 column, §3 dekhein) |
| `Orders` | Timestamp, Event, Order number, Order status, Payment status, …, Source, Device, **`Order JSON`** — 29 columns; `Order JSON` = order ka poora snapshot (site isi se order banati hai) |
| `OrderItems` | per-item rows (13 columns) — order ke items ka hisaab |
| `Payments` | bilkul `Orders` jaisa (payment events alag tab me, 27 columns) |
| `Invoices` | 19 columns + **`Invoice JSON`** (manual invoice ka snapshot) |
| `Messages` | Timestamp, Name, Email, Phone, Subject, Message, Status, **Message ID, Replied, Replied at** (11) |
| `Newsletter` | 4 columns |
| `Checkout` | Timestamp, Event, Step, Order number, Items, Subtotal, Reason, Phone (12) |
| `Audit` | Timestamp, Actor, Action, Target, Details (6) |
| `Shipments` | 9 columns (shipping events) |

Headers ka master list: `scripts/google-apps-script/liksha-sheets.gs` → **`HEADERS`** (line ~82).
Row ka shape: `apps/web/src/lib/sheet-format.ts` → `orderSheetRow()`, `checkoutEventSheetRow()`, `messageSheetRow()`, `subscriberSheetRow()`.

> Naya column add karna ho to **dono jagah** naam same daalna: `.gs` ke `HEADERS` me aur `sheet-format.ts` ke row function me. `tests/unit/apps-script.test.ts` yahi check karta hai.

### 6.3 Likhne ka rasta (write path)

```
1) Order create/update (R40 — AWAITED, sheet hi DB hai)
      lib/orders.ts          → createOrder() / writeAll()
      lib/orders-sheet.ts    → persistOrderEvent(order, event)
                               ← Orders (+ Order JSON) + OrderItems + Payments ek batch me
      lib/messages.ts        → message row (+ Message ID / Replied)
      lib/manual-invoices.ts → Invoices (+ Invoice JSON)
      lib/checkout-events.ts → mirrorCheckoutEventToSheet(event)
                │
                ▼
2) apps/web/src/lib/google-sheets.ts
      appendSheetRows(rows)      ← Apps Script ko POST (6s timeout)
      scriptGet()/scriptPost()   ← order_state / orders_state / settings reads
      healSheetConfig()          ← `sheet_not_configured` mile to khud `sheet_set`
                                   (env SHEET_EXPECTED_ID se; 10-min rate limit)
      env: GOOGLE_SHEETS_WEBAPP_URL + GOOGLE_SHEETS_TOKEN
                │
                ▼
3) scripts/google-apps-script/liksha-sheets.gs (r40-1)
      doPost / doGet  → JSON {ok, ...}
      sheet_(name)    → tab dhoondho (naam se), na ho to banao
                        (ensureHeaders_ naye columns END me append karta hai — purana data safe)
      appendRows_()   → header naam se column match karke row likho
      book_()         → SIRF Script Property SHEET_ID (R40: koi constant/bound-sheet
                        fallback nahi — props khaali = loud `sheet_not_configured`
                        + /exec par "Sheet URL set karein" form)
      orderStates_()  → last 4000 rows → per-order latest JSON + poori history
      readSettings_() → Settings tab ke key/value
```

**Sheet me data na aane ki wajah (R40):**

1. Vercel me `GOOGLE_SHEETS_WEBAPP_URL` / `GOOGLE_SHEETS_TOKEN` **set nahi** → order place **honest 503** deta hai (ab chup-chaap skip nahi hota).
2. Apps Script deploy nahi hua / access "Anyone" nahi / version **r40 se purana** → site 503 `sheet_store_not_ready` deti hai — naya code paste → **New version → Deploy**.
3. Script props khaali ya galat sheet id → `/exec` kholiye (form dikhega) ya `?action=sheet_set&id=…`; site ke env me `SHEET_EXPECTED_ID` hai to **auto-heal** khud `sheet_set` kar deta hai.

**Deploy ka tarika:** `docs/00-overview/apps-script-code.md` (poora copy-paste code + steps).
**Steps + troubleshooting:** `docs/00-overview/sheet-setup-owner.md`.

---

## 7. Admin panel — page → file → action

Har page: `apps/admin/src/app/(admin)/<naam>/page.tsx`
Har button ka server action: `apps/admin/src/app/actions.ts`
Data layer: `apps/admin/src/lib/data.ts`

| Admin page | File | Kaam / actions |
| --- | --- | --- |
| Dashboard (numbers clickable) | `(admin)/page.tsx` | cards + `PhoneLinks` — har number par call 💛 WA |
| **Orders list** | `(admin)/orders/page.tsx` | order number par click → detail |
| **Order detail + EDIT** | `(admin)/orders/[id]/page.tsx` | `updateContactAction` (naam/phone/address/pincode edit), `updateOrderStatusAction`, `updateTrackingAction`, `setOrderNoteAction`, `verifyPaymentAction`, `reversePaymentAction` |
| Naya manual order | `(admin)/orders/new/page.tsx` | `createOrderAction` |
| Payments | `(admin)/payments/page.tsx` | verify / reverse (`data.ts` → `pendingPayments`, `verifyOrderPayment`) |
| Invoices (GST) | `(admin)/invoices/page.tsx` | `createManualInvoiceAction` → `data.ts` → `createManualInvoice` |
| Products | `(admin)/products/page.tsx` | `saveProductEditAction`, `updatePriceAction`, `updateStockAction`, `toggleProductVisibilityAction`, `publishCatalogAction` |
| Collections | `(admin)/collections/page.tsx` | `saveCollectionEditAction` |
| Delivery (pincode/state block) | `(admin)/delivery/page.tsx` | `saveDeliverySettingsAction`, `togglePinRuleAction` |
| Coupons | `(admin)/coupons/page.tsx` | `apps/web/src/lib/rails.ts` (discount engine) |
| Reviews | `(admin)/reviews/page.tsx` | `lib/reviews.ts` data + moderation |
| Messages | `(admin)/messages/page.tsx` | `data.ts` → `markMessageHandled`, `setMessageReplied` |
| Customers | `(admin)/customers/page.tsx` | orders se derived + `PhoneLinks` |
| Sheet (status) | `(admin)/sheet/page.tsx` | `data.ts` → `getSheetOverview()` — kaun tab kitni row |
| Audit log | `(admin)/audit-logs/page.tsx` | `data.ts` → `getAudit()` |
| Settings | `(admin)/settings/page.tsx` | `saveSettingsAction` → `data.ts` → `saveSettings` |
| Staff | `(admin)/staff/page.tsx` | `lib/auth.ts` (roles) |
| Login | `login/page.tsx` | `loginAction`, `lib/session.ts` |

**Number clickable component:** `apps/admin/src/components/contact-links.tsx`
→ `PhoneLinks` (call + WhatsApp), `telHref()`, `whatsappHref()`, `cleanPhone()`.
Admin me `tel:` allowed hai (customer-facing site par nahi).

---

## 8. GST invoice

```
apps/web/src/lib/invoice.ts       → buildInvoice(order, settings)  (line items, tax split, total in words)
apps/web/src/lib/invoice-pdf.ts   → renderInvoicePdf()             (PDF)
apps/web/src/lib/amount-in-words.ts → numberToWords()
apps/web/src/lib/invoice-logo.ts  → logo embed (base64)
apps/web/src/app/api/admin/invoices/route.ts → download API
apps/admin/src/app/(admin)/invoices/page.tsx + actions.ts → createManualInvoiceAction
```

Seller block (naam, address, GSTIN) → `apps/web/src/lib/invoice.ts` → `sellerFromSettings()` + `sellerDetails()`
GSTIN sheet `Settings` tab ke `gstin` key se aata hai (public API me nahi jaata).

**R32 switch:** customer ke order page se invoice download **abhi band** hai —
`apps/web/src/lib/features.ts` → `customerFeatures.invoice = false` (owner ne kaha
"abhi sirf tracking"). PDF/API aur admin ka button pehle jaise chalte hain; wapas
dikhana ho to bas `invoice: true`. Customer ke payment page par "Order details
dekhein" ab highlight button hai (`data-testid="order-details-callout"`).

---

## 9. Reviews (daily auto-update, verified)

```
scripts/… (sync)  → database/seeds/reviews/*  → apps/web/src/data/reviews.json
apps/web/src/lib/reviews.ts   → reviewsFor(handle), latestReviews(), ratingBreakdown(), shopRating
apps/web/src/components/product-reviews.tsx, reviews-strip.tsx, stars.tsx
```

Owner rule: generated review **kabhi** "verified" nahi — flag `reviews.json` me `verified` sirf asli order
(`lib/reviews.ts` order-based check) se set hota hai.

---

## 10. SEO + performance (kahan hai)

| Cheez | File |
| --- | --- |
| sitemap | `apps/web/src/app/sitemap.ts` |
| robots | `apps/web/src/app/robots.ts` |
| metadata (title/desc/OG) | har page me `export const metadata`, default `apps/web/src/app/layout.tsx` |
| Product structured data (JSON-LD) | `apps/web/src/components/store-structured-data.tsx`, `product-detail.tsx` |
| PWA manifest + icons | `apps/web/src/app/manifest.ts` |
| Static rendering | `generateStaticParams()` — products/collections/policies pages |
| Prefetch + image | `components/safe-image.tsx` (next/image) |
| Fonts | `apps/web/src/app/layout.tsx` (next/font) |

Catalog build-time JSON hai (`lib/store.ts`), isliye product page DB hit nahi karta → TTFB fast.

---

## 11. Pincode / delivery

```
apps/web/src/lib/pincodes.ts        → evaluatePincode(), deliveryStates[], isPincodeFormat()
apps/web/src/lib/delivery.ts        → getDeliverySettings(), checkPincode(), saveDeliverySettings()
apps/web/src/lib/pincode-offline.ts → GitHub Pages/offline build ke liye (public/pincode-map.json)
apps/web/public/pincode-map.json    → asli India Post data (182 KB, build par copy)
database/seeds/delivery/pincodes.json → master data
apps/admin/src/lib/data.ts          → getDelivery(), saveDelivery()
apps/admin/src/app/actions.ts       → saveDeliverySettingsAction, togglePinRuleAction
```

Order par double check: `lib/orders.ts` → `createOrder()` (pincode serviceable + state match).

---

## 12. Env variables (Vercel → Settings → Environment Variables)

**Storefront (`liksha-clothing`):**

| Variable | Kaam | Zaroori? |
| --- | --- | --- |
| `GOOGLE_SHEETS_WEBAPP_URL` | Apps Script `/exec` URL — **R40: sheet hi orders ka DB** | ✅ |
| `GOOGLE_SHEETS_TOKEN` | script ke Script Properties `TOKEN` jitna hi | ✅ |
| `SHEET_EXPECTED_ID` | final sheet ka id — auto-heal (`sheet_set`) + `/api/sheet-health` `idMatch`; **code me kahin hardcoded nahi** | ✅ |
| `ADMIN_API_TOKEN` | admin → web API calls | ✅ |
| `OTP_TOKEN_SECRET` / `UPI_RETURN_SECRET` | OTP verify / payment return signing | ✅ |
| `SHEET_SELFTEST_KEY` | `/api/sheet-selftest` debugging | ✅ |
| `STORE_UPI_NAME` | payee-name fallback (sheet na chale tab) | optional |
| `NEXT_PUBLIC_SITE_URL` | canonical/OG URL | ✅ |
| `SHEET_READ_TIMEOUT_MS` / `SHEET_SETTINGS_TTL_MS` / `SHEET_TRACKING_TTL_MS` | sheet tuning (4000/2000/2000 set hain) | optional |
| `DATABASE_URL` | ❌ **R40 me delete** — Supabase project band; orders sirf sheet me | ❌ |
| `STORE_UPI_ID` | ❌ **R38 me delete** — UPI sirf sheet ke `upi_id` se | ❌ |

**Admin (`liksha-admin`):** `ADMIN_API_TOKEN` (same), `NEXT_PUBLIC_API_BASE` (web ka URL).

---

## 13. Domain / deploy (code nahi, DNS)

| Cheez | Abhi | Hona chahiye |
| --- | --- | --- |
| `designerclothing.fashion` | ✅ naya site (`/api/health` → `ordersStore:"sheet"`) | Cloudflare DNS records (doc: `docs/09-devops/domain-and-brand.md`) |
| `www.designerclothing.fashion` | ⏳ apex par 308 redirect (Vercel me set) | Cloudflare me `CNAME www` record |
| `admin.designerclothing.fashion` | ⏳ Vercel me set | Cloudflare me `CNAME admin` record |
| `liksha-clothing.vercel.app` / `liksha-admin.vercel.app` | ✅ backup URLs | chalta rahega (canonical nahi) |
| GitHub Pages preview | `mystorebyme.github.io/tannu-product-/` | static preview |

Deploy steps: `docs/00-overview/sheet-setup-owner.md` ke aakhir me **Deploy** section, aur `README.md` ka deployment block.

---

## 14. Tests / CI (kuch toota na ho)

```
npm run test:unit --workspace @liksha/web      # 117 tests
tests/e2e/*.mjs                                # payments, smoke, links, responsive, round16, round23
tests/unit/apps-script.test.ts                 # sheet headers ↔ row shape contract (10 checks)
.github/workflows/…                            # CI: build + tests + live flow
```

Commit message me `[live-test]` likhne par live flow (asli deployed site par) chalta hai.

---

## 15. Sabse chhota summary (aapke liye)

1. **Roz ka kaam (price, UPI, phone, sale text)** → **Google Sheet ke `Settings` tab** me. Code chhune ki zaroorat nahi.
2. **Orders sheet me save hote hain (R40 — Supabase band)** → script **r40-1** paste hona zaroori hai (Apps Script → naya code → New version → Deploy). Order par 503 mile to `/api/sheet-health` kholiye — har line me fix likha hai.
3. **Sheet me row na aaye / sheet badalni ho** → Vercel env me `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN`; sheet id badle to script ke `/exec` par form se ya `?action=sheet_set&id=…` — redeploy ki zaroorat nahi.
4. **Product / photo / price badalna** → `database/seeds/live/products.json` ya Admin → Products.
5. **Order status, tracking, invoice, pincode block** → Admin panel (`liksha-admin.vercel.app`), file `apps/admin/src/app/actions.ts`. Status/Admin Note seedha sheet me bhi edit kar sakte hain — site ~2s me utha leti hai.
6. **Payment page ka logic (UTR/last-4/WhatsApp)** → `apps/web/src/components/upi-payment.tsx`.

Kisi bhi line par "ye exact line kahan hai?" ho to file kholiye aur upar diya **function naam** search kariye — wahi jagah milegi.
