# Google Sheets — owner ka control panel (bina database kharch)

Owner ko har chhote change ke liye developer ya database chahiye na ho, isliye do kaam
Google Sheet se hote hain:

| Sheet | Kya hota hai | Website kya karti hai |
| --- | --- | --- |
| **Settings** | owner phone, WhatsApp, email, UPI ID, payee name, announcement, GSTIN, free shipping badalta hai | har **15 second** me padhti hai (`/api/settings`, `no-store`) — redeploy nahi |
| **Orders** | har order + status change ki nayi row | order place / status change par append |
| **Payments** | UTR submit + payment verified rows | payment reference submit aur verify par append |
| **Messages** | contact form ke messages | message save hone par append |
| **Newsletter** | email subscribers | subscribe hone par append |
| **Checkout** | checkout funnel — started / review / order placed / order failed (+ reason, phone) | customer checkout ke har stage par append |

Sheet **append-only log** hai — purani row kabhi overwrite nahi hoti, isliye owner ko
poora timeline milta hai (kab order aaya, kab payment aaya, kab ship hua).

Database (Postgres / JSON) **primary** hai: order, payment verification, invoice, tracking
sab wahin rehta hai. Sheet uski live copy + owner ke settings ka source hai. Sheet down ho
jaye to site chalti rehti hai (sirf owner edits ruk jaate hain) — koi order fail nahi hota.

## 0. Ready-made sheet (link — owner ke account me already shared)

Sheet ban chuki hai, tabs + headers ready hain, aur **`info.likshaclothing@gmail.com`**
ko **Editor** access de diya gaya hai (notification mail bhi gaya hai):

| Cheez | Value |
| --- | --- |
| Sheet ka naam | `Designer Clothing — Store (Orders · Payments · Settings)` |
| Link | https://docs.google.com/spreadsheets/d/1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo/edit |
| Tabs | `Settings` (10 keys bhare hue), `Orders` (25 columns), `Payments` (25 columns), `Messages` (7), `Newsletter` (2), `Checkout` (8) |
| Access | owner ka email = Editor · "Anyone with link" = **off** (customer data protect) |

`Settings` tab me ye values pehle se hain: `support_phone` = 8005900581,
`whatsapp` = 8005900581, `support_email` = Info.likshaclothing@gmail.com,
`upi_id` = dhakadgourav@fam, `upi_name` = Designer Clothing, `announcement` = Diwali Sale,
`free_shipping` = true, `shop_name` = Designer Clothing. `gstin` aur `admin_url` khaali hain —
owner jise chahe bhar de (khaali = site apni default use karti hai).

**Baaki 2 step owner ke account se** (ye developer nahi kar sakta, Google permission chahiye):

1. Us sheet me **Extensions → Apps Script** → `scripts/google-apps-script/liksha-sheets.gs`
   ka code paste → `TOKEN` set → **Run `setup`** (tabs already hain, sirf headers verify hote hain).
2. **Deploy → New deployment → Web app** (`Execute as: Me`, `Who has access: Anyone`) →
   `/exec` URL copy → Render env me `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` →
   redeploy. Verify: `GET /api/settings` me `"source": "google-sheet"`.

Sheet id/URL ya token **kabhi** frontend bundle ya docs-only public page me nahi jaata —
sirf server env + admin panel ke `/sheet` screen me.

## 1. Sheet + Apps Script setup (ek baar, ~5 minute)

1. [sheets.new](https://sheets.new) par nayi sheet banao, naam do `Liksha Store`.
2. **Extensions → Apps Script** kholo.
3. Repo ki file `scripts/google-apps-script/liksha-sheets.gs` ka poora code paste karo.
4. Sabse upar `var TOKEN = 'CHANGE-ME-liksha-token';` me apna lamba random token daalo
   (jaise `liksha-9f3k2m-2026`). Isi token ko website env me bhi daalna hai.
5. **Save → Run → `setup`** — permission maange to *Review permissions → Allow*.
   Isse `Settings`, `Orders`, `Payments`, `Messages`, `Newsletter`, `Checkout` tabs + headers ban jaate hain.
6. **Deploy → New deployment → Web app**
   - Description: `Liksha site`
   - Execute as: **Me**
   - Who has access: **Anyone** ← zaroori (website anonymous request bhejti hai; token check script karti hai)
   - **Deploy** → `/exec` par khatam hone wala URL copy karo.
7. Website ke environment me daalo (Render → liksha-storefront → Environment):

   ```
   GOOGLE_SHEETS_WEBAPP_URL = https://script.google.com/macros/s/AKfy…/exec
   GOOGLE_SHEETS_TOKEN      = liksha-9f3k2m-2026
   ```

   Redeploy karo. `GET /api/settings` me `"source": "google-sheet"` dikhne lage to connect ho gaya.

> Code badalne par: **Deploy → Manage deployments → Edit → New version → Deploy**.
> URL wahi rehta hai.

## 2. Settings sheet me kya likhna hai

| key | example | website me kahan |
| --- | --- | --- |
| `support_phone` | `8005900581` | footer, contact page, header |
| `whatsapp` | `8005900581` | WhatsApp buttons (91 lagakar) |
| `support_email` | `Info.likshaclothing@gmail.com` | footer, contact page, mailto |
| `upi_id` | `dhakadgourav@fam` | checkout + order page QR (**`UPI ID`, `Upi-Id`, `upi_vpa`, `VPA` bhi chalte hain**) |
| `upi_name` | `Designer Clothing` | UPI app me payee name |
| `announcement` | `Diwali Sale — Flat 70% OFF` | top announcement bar |
| `gstin` | `27AAAAA0000A1Z5` | invoice |
| `free_shipping` | `true` / `false` | shipping text |

Khaali cell = website apni default value use karti hai (kuch tootta nahi).

**Key ki spelling:** R35 se website key ko normalise karti hai — `upi_id`, `UPI ID`,
`upi id`, `Upi-Id`, `upi_vpa`, `VPA` sab ek hi cheez hain. Waise hi `Support Phone`,
`Free Shipping`, `WhatsApp Number`, `Payee Name` bhi. (Pehle sirf exact `upi_id`
padhi jaati thi, isliye haath se "UPI ID" likhne par change site par nahi aata tha.)

**Value saaf hoti hai:** `UPI ID: x@y` ya extra spaces ho to bhi `x@y` hi liya
jaata hai. Jo cheez valid UPI (kuch@handle) nahi hai wo **ignore** hoti hai —
site galat UPI par kabhi nahi jaati.

## 3. Verification (curl)

```bash
# settings (browser me bhi khul jaata hai)
curl -s "$SHEET_URL?action=settings&token=$TOKEN" | head -c 400

# health — har sheet me kitni rows hain
curl -s "$SHEET_URL?action=health&token=$TOKEN"

# last rows (admin panel ka "Google Sheet" screen yahi use karta hai)
curl -s "$SHEET_URL?action=recent&sheet=Orders&limit=20&token=$TOKEN"

# test row (Apps Script editor me `testAppend` bhi chala sakte hain)
curl -s -X POST "$SHEET_URL" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"token":"'"$TOKEN"'","action":"append","rows":[{"sheet":"Orders","row":{"Order number":"LK-TEST01","Event":"test","Total":499}}]}'
```

## 4. Website side (code)

| File | Kaam |
| --- | --- |
| `apps/web/src/lib/google-sheets.ts` | settings read (15s cache, 5s timeout, Apps Script → published CSV fallback) + rows append (6s timeout, best-effort) |
| `apps/web/src/lib/sheet-settings-cache.ts` | last-known-good sheet settings (Postgres `.data` me) — sheet fail par bhi sahi UPI |
| `apps/web/src/lib/sheet-format.ts` | pure row/format helpers (unit tested) |
| `apps/web/src/lib/store-settings.ts` | DB/file settings + sheet merge (sheet jeetti hai, fail par last-known-good) |
| `apps/web/src/lib/orders.ts` | `order.placed`, `order.status.*`, `payment.paid`, `payment.reference_submitted`, `order.tracking_updated` par append |
| `apps/web/src/lib/messages.ts` | contact message + newsletter subscriber append |
| `apps/web/src/app/api/settings/route.ts` | public settings (UPI, phone, email, announcement) no-store |

## 5. Security

- Apps Script URL + token dono **server-side env** me hain, browser bundle me nahi.
- Sheet me customer ka poora data hai (phone, address) — sheet ko sirf owner ke Google
  account ke saath share karo, "Anyone with link" **nahi**.
- Token leak ho jaye to Apps Script me `TOKEN` badal ke naya version deploy karo aur env update karo.
- Payment yahan **verify** nahi hota — UTR sheet me aata hai, admin panel se verify hota hai.

## 6. Admin panel se sheet dikhna + update hona

| Screen | Kya karta hai |
| --- | --- |
| `/sheet` | Sheet ki **live settings** (UPI ID, phone, WhatsApp, email, announcement) + last order / payment / message rows dikhata hai. Connected na ho to setup steps batata hai. |
| `/settings` | Save karte hi values DB me **aur** seedha sheet me (`action: settings_save`) likh di jaati hain — owner ko wahi value dikhti hai. |
| `/orders` | Har status / tracking change sheet me nayi row append karta hai (`update` ka kaam append-only log se hota hai). |
| `/products/new` | Naya product + 10 photos; publish par catalogue rebuild. |

Storefront par admin ka data do tarah se aata hai: `STORE_API_URL` (Render) se admin
`/api/admin/sheet` call karta hai, jo Apps Script se `action=recent` + `action=settings` leta hai.

```bash
# admin ka view (token ke saath)
curl -s -H "Authorization: Bearer $ADMIN_API_TOKEN" "$STORE/api/admin/sheet" | head -c 500
```

Sheet me order rows **append hote hain** (overwrite nahi) — isliye ek order ka poora
timeline mile: `order.placed` → `order.status_changed` → `order.tracking_updated` →
`payment.reference_submitted` → `payment.paid`.

## 2. Kaunsa Google account? (owner ke liye clear)

Repo me sheet ka URL/token **nahi** hota — sheet aapke Google account me rehti hai, website
sirf deployed Apps Script se baat karti hai. Isliye:

- Sheet usi Google account me banao jo dukaan ka official account hai —
  recommended: **`Info.likshaclothing@gmail.com`**.
- Usi account se **Extensions → Apps Script → Deploy → Web app** kariye (`Execute as: Me`,
  `Who has access: Anyone`).
- Sheet ko kisi CA/developer ke personal account me na rakhein; agar karna pade to
  **Share → Editor** se owner ka email add karein, warna owner ke paas access nahi rahega.
- Sheet ka naam suggestion: `Designer Clothing — Store` (tab naam `Settings`, `Orders`,
  `Payments`, `Messages`, `Newsletter` — script khud bana deta hai).
- Sheet ka link **kabhi website par nahi dikhta**: `/api/settings` sirf public values
  (phone, WhatsApp, email, UPI ID, announcement) deta hai; sheet URL/token sirf server env me hai.
- Admin panel ka link sheet ke `Settings` tab ki `admin_url` row se aata hai aur sirf
  admin panel me dikhta hai (customer-facing pages par nahi).

Agar account badalna ho: nayi sheet + naya Apps Script deploy karo, naya `/exec` URL aur
token Render ke environment me daalo, redeploy — data purani sheet me safe rehta hai.

## 3. Sheet me payment ka har stage

| Event | Kahan jaata hai | Kab |
| --- | --- | --- |
| `order.placed` | `Orders` | order place hote hi |
| `payment.pending` | `Payments` | order place hote hi (paisa aana baaki) |
| `payment.reference_submitted` | `Payments` | customer UTR/12-digit reference daalta hai |
| `payment.paid` | `Payments` | admin payment verify karta hai |
| `payment.auto_confirmed` | `Payments` | UPI app se wapas aane par order auto-confirm (signed token) |
| `payment.reversed` | `Payments` | owner ne "payment not received" kaha — wapas pending |
| `payment.failed` | `Payments` | customer "payment failed" report karta hai (`/api/payments/failed`) |
| `order.status_changed` / `order.tracking_updated` | `Orders` | admin status/courier update karta hai |

Sab rows append-only hain — ek order ka poora payment timeline sheet me dikhta hai.

## 7. "Sheet me UPI badla, site par nahi aaya" — 5 minute ka check (R35)

Sabse pehle **yahi** dekho (koi token/URL share nahi hota):

```bash
curl -s https://designerclothing.fashion/api/settings | python3 -m json.tool
# turant (cache bypass) — sheet save ke baad verify karne ke liye:
curl -s "https://designerclothing.fashion/api/settings?fresh=1" | python3 -m json.tool
```

| `data.sheet` me kya dikha | Matlab | Kya karna hai |
| --- | --- | --- |
| `"readFrom": "apps-script"`, `stale: false` | Sheet se value aa rahi hai ✅ | UPI `data.upiId` me hi hai — customer ko wahi dikhega |
| `"readFrom": "csv"` | Apps Script down hai, published CSV se chal raha hai | Apps Script ka naya version deploy karo (§1) |
| `stale: true` + `error` | Sheet se value **nahi** aa rahi | Neeche wali table dekho |
| `configured: false` | Sheet env hi set nahi | `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` set karo |

`error` ka matlab:

| Error | Wajah | Fix |
| --- | --- | --- |
| `... HTML page bheja (JSON nahi)` | Apps Script ka deployment "Anyone" par nahi hai (Google login page) | Script → Deploy → Manage deployments → **Who has access: Anyone** |
| `Apps Script ne mana kiya: unauthorized — token match nahi hua` | `TOKEN` aur env ka token alag hain | Script ka token aur `GOOGLE_SHEETS_TOKEN` same karo |
| `Settings sheet me koi recognised key nahi mili` | Settings tab khaali/keys galat | §2 wali keys likho (`upi_id`) |
| `HTTP 404 / 500` | Purana deployment URL | Naya web app URL copy karke env update karo |

Aur agar Apps Script ka deployment hi purana hai to **naya code** paste karke naya
version deploy karo — is round me script `r35-1` hai (`?action=version&token=…` se check karo):
`"UPI ID"` style rows aur `upi_vpa` bhi padhta hai.

**Kitni der me live?** Website 15s cache karti hai; payment/order page turant
(last-known-good value) dikhata hai. Browser tab ka client har 30s aur tab focus par
`/api/settings` dobara padhta hai. Yaani sheet save → **~15–30 second** me site par.

**Admin se diagnostics:**

```bash
curl -s -H "authorization: Bearer $ADMIN_API_TOKEN" \
  https://designerclothing.fashion/api/admin/settings | python3 -m json.tool
# → { data: {…}, sheet: { configured, appsScript, publishedCsv, readFrom, readAt, usingSheetValue, error? } }
```

Tests (yahi behaviour pin karte hain): `npm run test:runtime` (9 checks — sheet se
UPI, sheet down par last-known-good, HTML/token errors, CSV fallback, fast path)
aur `tests/unit/sheet-settings-keys.test.ts` (spelling roop).
