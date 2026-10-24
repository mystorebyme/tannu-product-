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

- Naam: `Designer Clothes` (`apps/web/src/config/site.ts` → `siteConfig.name`).
- Logo: wahi live store ka asset (`logoUrl`, `logoMark`) — same to same, kabhi change nahi.
- Phone / WhatsApp: `8005900581` (Settings sheet se override ho sakta hai:
  `support_phone`, `whatsapp`).
- UPI: `dhakadgourav@fam` (`upi_id`, `upi_name` sheet se).

## 3. Sheet kabhi public nahi

- `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` sirf server env me hain.
- `/api/settings` sirf public values deta hai (UPI, phone, email, announcement) — sheet ka URL/token nahi.
- `/api/admin/sheet` token ke bina 401 deta hai; admin page sirf “Connected” status dikhata hai.
- Admin link (`admin_url`) sirf admin panel me dikhta hai, frontend par kabhi nahi.
