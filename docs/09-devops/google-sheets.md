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

Sheet **append-only log** hai — purani row kabhi overwrite nahi hoti, isliye owner ko
poora timeline milta hai (kab order aaya, kab payment aaya, kab ship hua).

Database (Postgres / JSON) **primary** hai: order, payment verification, invoice, tracking
sab wahin rehta hai. Sheet uski live copy + owner ke settings ka source hai. Sheet down ho
jaye to site chalti rehti hai (sirf owner edits ruk jaate hain) — koi order fail nahi hota.

## 1. Sheet + Apps Script setup (ek baar, ~5 minute)

1. [sheets.new](https://sheets.new) par nayi sheet banao, naam do `Liksha Store`.
2. **Extensions → Apps Script** kholo.
3. Repo ki file `scripts/google-apps-script/liksha-sheets.gs` ka poora code paste karo.
4. Sabse upar `var TOKEN = 'CHANGE-ME-liksha-token';` me apna lamba random token daalo
   (jaise `liksha-9f3k2m-2026`). Isi token ko website env me bhi daalna hai.
5. **Save → Run → `setup`** — permission maange to *Review permissions → Allow*.
   Isse `Settings`, `Orders`, `Payments`, `Messages`, `Newsletter` tabs + headers ban jaate hain.
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
| `support_phone` | `9909790455` | footer, contact page, header |
| `whatsapp` | `9909790455` | WhatsApp buttons (91 lagakar) |
| `support_email` | `Info.likshaclothing@gmail.com` | footer, contact page, mailto |
| `upi_id` | `dhakadgourav@fam` | checkout + order page QR |
| `upi_name` | `Liksha Clothing` | UPI app me payee name |
| `announcement` | `Dussehra Sale — Flat 70% OFF` | top announcement bar |
| `gstin` | `27AAAAA0000A1Z5` | invoice |
| `free_shipping` | `true` / `false` | shipping text |

Khaali cell = website apni default value use karti hai (kuch tootta nahi).

## 3. Verification (curl)

```bash
# settings (browser me bhi khul jaata hai)
curl -s "$SHEET_URL?action=settings&token=$TOKEN" | head -c 400

# health — har sheet me kitni rows hain
curl -s "$SHEET_URL?action=health&token=$TOKEN"

# test row (Apps Script editor me `testAppend` bhi chala sakte hain)
curl -s -X POST "$SHEET_URL" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"token":"'"$TOKEN"'","action":"append","rows":[{"sheet":"Orders","row":{"Order number":"LK-TEST01","Event":"test","Total":499}}]}'
```

## 4. Website side (code)

| File | Kaam |
| --- | --- |
| `apps/web/src/lib/google-sheets.ts` | settings read (15s cache) + rows append (6s timeout, best-effort) |
| `apps/web/src/lib/sheet-format.ts` | pure row/format helpers (unit tested) |
| `apps/web/src/lib/store-settings.ts` | DB/file settings + sheet merge (sheet jeetti hai) |
| `apps/web/src/lib/orders.ts` | `order.placed`, `order.status.*`, `payment.paid`, `payment.reference_submitted`, `order.tracking_updated` par append |
| `apps/web/src/lib/messages.ts` | contact message + newsletter subscriber append |
| `apps/web/src/app/api/settings/route.ts` | public settings (UPI, phone, email, announcement) no-store |

## 5. Security

- Apps Script URL + token dono **server-side env** me hain, browser bundle me nahi.
- Sheet me customer ka poora data hai (phone, address) — sheet ko sirf owner ke Google
  account ke saath share karo, "Anyone with link" **nahi**.
- Token leak ho jaye to Apps Script me `TOKEN` badal ke naya version deploy karo aur env update karo.
- Payment yahan **verify** nahi hota — UTR sheet me aata hai, admin panel se verify hota hai.
