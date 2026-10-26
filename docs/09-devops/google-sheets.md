# Google Sheets — owner ka control panel (bina database kharch)

Owner ko har chhote change ke liye developer ya database chahiye na ho, isliye do kaam
Google Sheet se hote hain:

| Sheet | Kya hota hai | Website kya karti hai |
| --- | --- | --- |
| **Settings** | owner phone, WhatsApp, email, UPI ID, payee name, announcement, GSTIN, free shipping badalta hai | har **10 second** me padhti hai (`/api/settings`, `no-store`); payment page **turant** (`?fresh=1`) — redeploy nahi |
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
| `upi_id` | `dhakadgourav@fam` | checkout + order page QR |
| `upi_name` | `Designer Clothing` | UPI app me payee name |
| `announcement` | `Diwali Sale — Flat 70% OFF` | top announcement bar |
| `gstin` | `27AAAAA0000A1Z5` | invoice |
| `free_shipping` | `true` / `false` | shipping text |

Khaali cell = website apni default value use karti hai (kuch tootta nahi).

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
| `apps/web/src/lib/google-sheets.ts` | settings read (4s timeout, 10s TTL + stale-while-revalidate, fail par **last good** value, Workers par edge cache) + rows append (6s timeout, best-effort) |
| `apps/web/src/lib/sheet-format.ts` | pure row/format helpers (unit tested) |
| `apps/web/src/lib/store-settings.ts` | DB/file settings + sheet merge (sheet jeetti hai) + `getStoreSettingsFast()` — payment page: cache ho to turant, cold ho to 3s tak asli read, aur jab tak koi **last good** value hai tab tak hardcoded default kabhi nahi |
| `apps/web/src/lib/orders.ts` | `order.placed`, `order.status.*`, `payment.paid`, `payment.reference_submitted`, `order.tracking_updated` par append |
| `apps/web/src/lib/messages.ts` | contact message + newsletter subscriber append |
| `apps/web/src/app/api/settings/route.ts` | public settings (UPI, phone, email, announcement) no-store · `?fresh=1` = sheet se abhi padho · `meta` = read diagnostics |
| `apps/web/src/components/store-settings-provider.tsx` | browser me har 15s + tab focus par refresh — sheet ka change bina page reload dikhta hai |
| `apps/web/src/components/upi-payment.tsx` | payment page ka QR/UPI ID live sheet se (page pehle se khula ho to bhi naya UPI aa jaata hai) |

## 4b. Real-time: sheet me badla, site par **kab** dikhta hai?

| Jagah | Kab tak | Kaise |
| --- | --- | --- |
| Payment page (UPI ID + QR) | **turant** (page khulte hi) | client `/api/settings?fresh=1` call karta hai — sheet se abhi padh kar |
| Announcement bar, WhatsApp number, footer, shipping line | ≤ 15 second | provider har 15s poll karta hai; tab par wapas aate hi turant |
| Server-rendered pages (order page, invoice, contact) | ≤ 10 second | server TTL 10s + stale-while-revalidate (page kabhi sheet ka intezaar nahi karta) |
| Naya Cloudflare Worker isolate / Vercel cold start | turant | last good value Cloudflare Cache API me rehti hai — defaults par nahi jaata |

Page kabhi **block** nahi hota: sheet slow ya down ho to purani (par sahi) value turant
jaati hai aur nayi background me aa jaati hai. Read fail hone par bhi site
**default UPI par nahi girti** — last good value chalti rehti hai.

Tuning (env): `SHEET_READ_TIMEOUT_MS` (default 4000), `SHEET_SETTINGS_TTL_MS` (default
10000), `SHEET_SETTINGS_STALE_MS` (default 600000). Workers par ye do pehle
`apps/web/cloudflare.config.ts` me declared hain.

### "Sheet me UPI badla, site par nahi aaya" — 3 minute me check

1. **Key naam sahi hai?** `Settings` tab me row `upi_id` (column A), value column B me.
   Script lower-case + underscore padhta hai: `upi_id`, `upi_name`, `support_phone`,
   `whatsapp`, `announcement`, `gstin`, `free_shipping`, `admin_url`.
2. **Value valid UPI hai?** `name@bank` shape (jaise `owner@ybl`). Galat shape ho to site
   use ignore karke purani (sahi) value rakhti hai.
3. **Site se poochho** — `curl -s https://<site>/api/settings`:
   - `data.upiId` = sheet wala UPI → sab theek (browser me hard refresh kariye).
   - `meta.sheetSource: "apps-script"` → sheet se aa raha hai ✅
   - `meta.sheetSource: "csv"` → ⚠️ published CSV fallback; Google ise ~5 minute cache
     karta hai → Apps Script ka `/exec` URL set kariye (tabhi real-time milega).
   - `meta.sheetSource: null` + `meta.sheetLastError` → request Apps Script tak nahi
     pahunchi. Wajah usually: deployment **"Anyone"** nahi, purana/archived deployment
     URL, ya token mismatch. `/api/sheet-selftest?key=…` poora detail deta hai.
4. **Admin panel → Google Sheet** screen par wahi status insaani bhasha me dikhta hai
   (`sheet-live-read` notice): source, last read ms, value kitni purani, last error.
5. Sab sahi hai par browser me purana dikh raha → tab par wapas aate hi refresh hota hai,
   ya 15 second rukhein. CDN/browser cache nahi hai (`cache-control: no-store`).

> **R35 se pehle kya toota tha:** read timeout 900ms tha jabki Apps Script 1–4 second
> leta hai → read hamesha timeout → site chup-chaap **default UPI** dikha deti thi.
> Payment page to 350ms baad hi default par chala jaata tha. Teeno wajah ab fix hain
> (`tests/sheets/settings-realtime.test.ts` inhe naapta hai).

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
