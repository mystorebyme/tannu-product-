# Google Sheet — store kaise chalti hai (owner guide)

> R53 (owner): *"document jinki help leni ho ki kise sheet work krti hai ye sb to hona hi chiye"*
> Ye doc batata hai ki aapki Google Sheet hi is store ka **database** hai — products, orders,
> payments, reviews, coupons aur settings sab wahin se chalte hain. Koi Supabase/MySQL nahi (R40).

---

## 1. Big picture (ek nazar me)

```
Customer site (designerclothing.fashion)
        │  HTTPS
        ▼
Apps Script Web App  (scripts/google-apps-script/liksha-sheets.gs, sheet ke andar rehta hai)
        │  read / append
        ▼
Aapki Google Sheet (17 tabs) — owner: prkigothwal@gmail.com
```

- **Site → sheet:** order, payment, message, review, newsletter — sab rows append hoti hain.
- **Sheet → site:** Products tab = catalog, Settings tab = WhatsApp/UPI/announcement,
  Coupons/Reviews = live features. Aap sheet me badlo → site par apne aap dikhega (deploy ki zaroorat nahi).
- Site sheet se direct CSV bhi padh leti hai (fast reads); likhna hamesha Apps Script se hota hai.

## 2. Tabs (17) — kaunsa tab kis kaam ka

| Tab | Kaam |
| --- | --- |
| **Settings** | `key,value` rows: `whatsapp`, `support_phone`, `upi_id`, `upi_name`, `announcement`, `store_name`, `gstin`, `free_shipping`, `order_prefix`, `prepaid_only`… Site ~15 second me padh leti hai. |
| **Products** | **Catalog ka DB (R43).** Row add/delete, price/image/title badlo → site par live. Khaali tab ko site khud seed kar deti hai. Editing sirf sheet se (site ke code me products hardcode nahi). |
| **Orders** | Har order + har status change (append-only timeline) + `Order JSON` snapshot. |
| **OrderItems** | Order ki har item alag row (size, colour, qty, price). |
| **Payments** | pending / UTR submitted / claimed / verified / failed (status columns me dropdown). |
| **Invoices** | GST invoice (taxable value, CGST/SGST/IGST, invoice number). |
| **Shipments** | Courier, AWB, tracking URL, dispatch/delivery status. |
| **Checkout** | Funnel events: checkout khula → review → order placed → order failed. |
| **Messages** | Contact form ke messages (+ replied status). |
| **Newsletter** | Email subscribers (duplicate email apne aap skip). |
| **Reviews** | Customer reviews — **pending → approve → live** (R44). Delete karo → site se gaya. |
| **Coupons** | Coupon codes, discount, uses, limit, active flag. |
| **Inventory** | Stock ka har change (kisne, kitna, kyun). |
| **Audit** | Admin panel ki har important activity ka log. |
| **Errors** | Website/script errors ka log (debug ke liye). |
| **Dashboard** | Aaj ka summary (orders, revenue, pending, messages) — script khud bharta hai. |
| **Sync** | Har sync call ka hisaab (kab, kya, kitni rows). |

## 3. Roz ke kaam (bina deploy, sheet se hi)

- **WhatsApp number badalna (R53 — sabse important):** Settings tab → `whatsapp` row me naya
  number → save. ~15 second me **poori site** par naya number — header, footer, mobile menu,
  PDP, checkout, policies, contact page. Number **kahin hardcode nahi** hai; policies ke text me
  `{{WHATSAPP}}` placeholder hai jo live number se bharta hai. Row khaali kar do → number site
  se hat jata hai (R45).
- **Product add/edit:** Products tab me row add karo ya existing row badlo (title, price,
  images, sizes…). Site apne aap update — build/deploy nahi chahiye.
- **Order status:** Orders tab me naya status row — `Confirmed` ka matlab owner ne payment
  confirm kar diya (R43).
- **Review approve:** Reviews tab me row ka approve/pending flag → pending review site par
  nahi dikhta, approve karte hi live.
- **Coupon:** Coupons tab me code, discount, limit, active. (Dev/preview demo: DEMO50, DIWALI10.)
- **UPI:** Settings tab `upi_id` — payment page **sirf sheet** se UPI padhta hai.
- **Announcement banner:** Settings tab `announcement`.

## 4. Apps Script setup (ek baar, ~4 minute)

1. Apni Google Sheet kholiye → **Extensions → Apps Script**.
2. `Code.gs` ka poora purana code delete karke repo ki
   `scripts/google-apps-script/liksha-sheets.gs` ka **poora code paste** kijiye → Save (Ctrl+S).
   (`TOKEN` line ko default `'CHANGE-ME-liksha-token'` par hi rehne dijiye — asli token
   Script Properties me rehta hai, paste se nahi mitt-ta.)
3. **Deploy → New deployment → Web app** → Execute as **Me (prkigothwal@gmail.com)** →
   Who has access **Anyone** → Deploy → `/exec` URL copy kijiye.
4. Browser me `/exec` URL kholiye → panel me **apni sheet ka URL** daal kar "Sheet set karo"
   (sheet ka id Script Properties me save hota hai). Permission maange → apna account →
   "Advanced" → "Go to … (unsafe)" → **Allow** (personal script par ye warning normal hai).
   Chaaho to `setup` Run karke saare tabs/headers ek saath bana lijiye — warna pehla order
   apne aap tabs bana dega (self-heal).
5. Token set (ek hi baar): `<webapp URL>?action=set_token&token=<Vercel ke GOOGLE_SHEETS_TOKEN ki value>`
   → jawab `{"ok":true,…}` aana chahiye.
6. Vercel env (production): `GOOGLE_SHEETS_WEBAPP_URL` = `/exec` URL, `GOOGLE_SHEETS_TOKEN` = wahi token.
   (`STORE_WHATSAPP` production me **kabhi mat set karna** — number sirf sheet se aana chahiye.)

### Code update karne ka sahi tareeka (galti yahi hoti hai!)

Code paste karne ke baad sirf Ctrl+S se kuch nahi hota — **naya version deploy** karna padta hai:

> Deploy → Manage deployments → ✏️ (pencil) → Version: **New version** → Deploy.

Current version code me `CODE_VERSION` par likha hota hai (abhi **r46-1**, line ~90).
Check: `<webapp URL>?action=health` → `version` field me wahi aana chahiye. Purana version
dikhe = naya deploy nahi hua.

## 5. Health checks (kabhi bhi, browser se)

| URL | Kya batata hai |
| --- | --- |
| `<webapp URL>?action=health` | Script side: version, sheet access, tabs, settings keys, `"problems":["sab green ✔"]` |
| `https://designerclothing.fashion/api/sheet-health` | Website side ka sheet check |
| `https://designerclothing.fashion/api/health` | Live commit, catalog source (`sheet`), products count, orders store |

## 6. Self-healing (site khud theek karti hai)

- Missing tab/headers → site/script pehle write par khud bana deti hai (`setup`/heal).
- Status dropdowns → `?action=dropdowns` (ya heal) 10-min rate limit ke saath dobara laga deta hai.
- Sheet URL/id badal gaya → heal retry (`SHEET_EXPECTED_ID` se verify).
- Script down ho → site **last good** values par chalti rehti hai (koi hardcoded fallback number
  nahi dikhta — R41/R45).

## 7. Security (zaroori)

- **TOKEN kisi ko na dein** — isse aapki sheet me rows daali ja sakti hain. Token Script
  Properties me rehta hai; public repo me sirf placeholder hai.
- "Who has access: **Anyone**" zaroori hai (site anonymous request bhejti hai) — par bina
  token ke sirf public-safe settings keys hi milti hain (admin/private keys nahi).
- Script sheet ke bahar kahin data nahi bhejta.
- Sheet ka naam badalne par bhi kaam chalta hai (gid + naam dono se dhoondhta hai).

## 8. Troubleshooting

| Problem | Check |
| --- | --- |
| Site par purana number/price | Settings/Products row save hui? ~15s TTL wait; `/api/health` me `catalog source: sheet`? |
| Orders sheet me nahi aa rahe | `?action=health` → sheet access; token set hai? Vercel env sahi? |
| "sab green" nahi aaya | health ke `problems` me likha step kijiye; `setup` Run karke tabs/headers repair |
| Naya script code kaam nahi kar raha | **New version deploy** kiya? (section 4) `version` field check |
| Sheet delete/replace kar di | Naye `/exec` panel me nayi sheet ka URL set kijiye; Vercel env same rahega |
