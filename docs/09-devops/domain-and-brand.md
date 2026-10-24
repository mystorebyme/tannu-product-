# Domain, brand aur links

## 1. Apna domain lagana (recommended: ek hi domain, sab jagah)

| Kahan | Kya set karna hai | Kyun |
| --- | --- | --- |
| Render → storefront | `NEXT_PUBLIC_SITE_URL=https://designerclothes.in` | WhatsApp message, invoice, canonical/OG links isi se bante hain |
| Render → storefront | `ADMIN_PANEL_URL=https://admin.designerclothes.in` | Admin panel ka link (sheet ke `admin_url` se bhi aata hai) |
| GitHub → Settings → Variables → Actions | `STORE_API_URL=https://designerclothes.in` | GitHub Pages preview se order/payment API par jaata hai |
| DNS | `A`/`CNAME` Render ke diye hue target par | `www` + apex dono |
| Render → Custom Domain | `designerclothes.in`, `www.designerclothes.in` | Auto SSL |

**Rule:** WhatsApp par bheja gaya product/order link **isi site ka** hota hai
(`window.location.origin`), purani/cloned store ka nahi. Static preview par base path
(`/tannu-product-`) bhi jud jaata hai.

## 2. Brand

- Naam: `Designer Clothing` (`apps/web/src/config/site.ts` → `siteConfig.name`).
- Logo (owner ka final, koi redraw nahi) — device ke hisaab se alag file:
  - `apps/web/public/images/brand/logo-mobile.png` — header, <768px
  - `apps/web/public/images/brand/logo-tablet.png` — header, 768–1023px
  - `apps/web/public/images/brand/logo-desktop.png` — header + invoice masthead, ≥1024px
  - `apps/web/public/images/brand/logo-fluid.png` — stacked, footer / invoice / any size
  - `apps/web/public/images/brand/logo-mark-{128,192,512}.png` — favicon, Apple touch icon, PWA, invoice PDF, admin
  - `apps/web/public/images/og-image.jpg` — social share card (1200×630, wide hero se)
  - Ek hi component: `apps/web/src/components/brand-lockup.tsx` (header, mobile menu, footer)
  - Admin: `apps/admin/public/invoice-logo.png` (horizontal lockup) + `/brand-mark.png` (sidebar/login)
  - Pipeline + breakpoints: `scripts/brand/build-responsive-assets.mjs`, `docs/05-design/responsive-assets.md`
- Phone / WhatsApp: `8005900581` (Settings sheet se override ho sakta hai:
  `support_phone`, `whatsapp`).
- UPI: `dhakadgourav@fam` (`upi_id`, `upi_name` sheet se).
- Instagram (abhi sirf URL text, link nahi): `https://www.instagram.com/designer_clothing_9`
  (`siteConfig.socials.instagram`). WhatsApp hi working social link hai.

## 3. Domain se pehle: poora env checklist (ek jagah)

Domain kharidne se pehle sirf **ek** value badalni chahiye — `NEXT_PUBLIC_SITE_URL`.
Canonical, OG, sitemap, robots, product JSON-LD, WhatsApp message links, invoice/UPI
callback — sab isi se bante hain (`apps/web/src/config/site.ts`).

### 3.1 Render → storefront (`apps/web`)

| Variable | Domain ke saath | Kya control karta hai |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://designerclothes.in` | canonical + `metadataBase`, `sitemap.xml`, `robots.txt` host, product/offer JSON-LD URL, UPI callback URL, WhatsApp order link fallback |
| `NEXT_PUBLIC_LIVE_STORE_URL` | `https://designerclothes.in` | "Buy on live store" type fallback links |
| `ADMIN_PANEL_URL` | `https://admin.designerclothes.in` | admin button/link (sheet ki `admin_url` row isko override karti hai) |
| `STORE_UPI_ID` / `STORE_UPI_NAME` | `dhakadgourav@fam` / `Designer Clothing` | UPI QR (sheet `upi_id`/`upi_name` override karte hain) |
| `ADMIN_API_TOKEN` | 32+ char random | admin → storefront API auth |
| `GOOGLE_SHEETS_WEBAPP_URL` / `GOOGLE_SHEETS_TOKEN` | Apps Script `/exec` | owner settings + order/payment log |
| `CONTACT_EMAIL` | `Info.likshaclothing@gmail.com` | contact form delivery |

### 3.2 GitHub → Settings → Variables (`STORE_API_URL`)

| Variable | Value | Kyun |
| --- | --- | --- |
| `STORE_API_URL` | `https://designerclothes.in` | Pages preview ka checkout/payment/track-order seedha Render API par jaata hai (`pages.yml` ise `NEXT_PUBLIC_API_BASE_URL` banata hai) |

Variable (secret nahi) rakhein — workflow `vars.STORE_API_URL` padhta hai. Set karne ya badalne par
Pages workflow dobara chalao (Actions → Pages → Re-run) — static build me value inject hoti hai.

**CORS (zaroori):** Pages static site se order/payment call **cross-origin** jaati hai, isliye
Render API par allowlist wala CORS hai (`apps/web/src/lib/cors.ts`): apni site
(`NEXT_PUBLIC_SITE_URL`), `https://mystorebyme.github.io`, localhost aur apne
`*.onrender.com` hosts. Koi `*` nahi. Aur domain add karna ho to Render env me
`CORS_ALLOWED_ORIGINS=https://a.com,https://b.com` daal dein. In routes par OPTIONS preflight
bhi handle hota hai: `/api/orders`, `/api/payments/manual`, `/api/payments/failed`, `/api/settings`.

Iske bina Pages par "Order place nahi hua" (browser CORS block) dikhta hai — `STORE_API_URL`
set karte hi order seedha Render par banta hai, UPI payment ke baad wahi order page khulta hai.

### 3.3 Custom domain + SSL

1. Render → storefront → **Settings → Custom Domains** → `designerclothes.in` + `www.designerclothes.in` add.
2. DNS (registrar): apex `A` → Render ka IP; `www` `CNAME` → `<service>.onrender.com`.
3. Render SSL auto (Let's Encrypt) — 10–30 min.
4. `www` → apex **Redirect** (ya ulta) — dono par site khule, canonical ek hi ho.
5. Admin alag subdomain par ho to `admin.designerclothes.in` bhi add karein (admin app alag service hai).

### 3.4 Domain ke baad verify (copy-paste)

```bash
SITE=https://designerclothes.in

# canonical + OG absolute URL
curl -s $SITE | grep -o '<link rel="canonical"[^>]*>' | head -1
curl -s $SITE | grep -o '<meta property="og:url"[^>]*>' | head -1

# sitemap/robots apne domain par
curl -s $SITE/robots.txt | grep -i sitemap
curl -s $SITE/sitemap.xml | head -c 200

# product JSON-LD offer url
curl -s "$SITE/products/$(curl -s $SITE/sitemap.xml | grep -o 'products/[a-z0-9-]*' | head -1 | cut -d/ -f2)" \
  | grep -o '"url":"[^"]*products[^"]*"' | head -2

# settings live (sheet connected?)
curl -s $SITE/api/settings | head -c 400
```

Sab URLs `designerclothes.in` ke hone chahiye — kahin `onrender.com` ya
`likshaclothing.com` nahi dikhna chahiye. `www` + non-`www` dono test karein.

> Note: `NEXT_PUBLIC_*` values **build time** par bake hoti hain. Render par env badalne ke
> baad **Manual Deploy → Clear build cache & deploy** karein, warna purana URL HTML me reh jaata hai.

## 4. Sheet kabhi public nahi

- `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` sirf server env me hain.
- `/api/settings` sirf public values deta hai (UPI, phone, email, announcement) — sheet ka URL/token nahi.
- `/api/admin/sheet` token ke bina 401 deta hai; admin page sirf “Connected” status dikhata hai.
- Admin link (`admin_url`) sirf admin panel me dikhta hai, frontend par kabhi nahi.
