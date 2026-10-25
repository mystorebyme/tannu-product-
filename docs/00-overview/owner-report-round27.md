# Round 27 — Owner report (logo center, Google verification, traffic, sheet)

Date: 2026-10-25 · Commit: `f6a985a` (is line ke baad ka code live hoga)
Site: https://liksha-clothing.vercel.app · Admin: https://liksha-admin.vercel.app

---

## 1. Logo header + footer me center ✅ (ho gaya)

- **Header (laptop/desktop):** 3 column — beech me logo (exact center), left me menu,
  right me search/wishlist/cart. Mobile/tablet par pehle jaisa hi center.
- **Footer:** logo lockup poora center me (text ke saath).
- Logo **same to same** hai — koi redraw/change nahi.

File: `apps/web/src/components/site-header.tsx`, `apps/web/src/components/site-footer.tsx`

## 2. Google Search Console verification ✅ (code me lag gaya)

Do tareeke dono laga diye, Google ko dono chalte hain:

1. **Meta tag** — `<meta name="google-site-verification" content="hFaqyp-9LdUXSKPA9RF011TkO2m_-7AUMasXqm_0dGI" />`
   (file: `apps/web/src/app/layout.tsx`)
2. **HTML file** — aapki di hui `googleb3b0e3defc1daa17.html`
   → live: https://liksha-clothing.vercel.app/googleb3b0e3defc1daa17.html

**Aapko karna hai:** Search Console → Add property → **URL prefix**
`https://liksha-clothing.vercel.app/` → Verify. Ho jaane ke baad property par
**"Domain"** wala option baad me `likshaclothing.com` par bhi laga sakte hain (jab domain aapke paas ho).

## 3. "Pure traffic ka pata chalna chahiye" ✅ (tracking laga di)

Naya file: `apps/web/src/components/analytics.tsx`

- **Vercel Web Analytics** — kis page par kitne log, kahan se aaye, kitne ne cart/checkout
  kiya. `/_vercel/insights/script.js` automatically chalta hai.
- **Vercel Speed Insights** — page kitni jaldi khulti hai (real users par).
- **Google Analytics 4 (optional)** — jis din chahein, Vercel → Settings → Environment
  Variables me `NEXT_PUBLIC_GA_ID` = `G-XXXXXXXXXX` daal dein, GA4 turant on ho jayega.

**Aapko karna hai (1 minute):** Vercel → project **liksha-clothing** → **Analytics** tab →
**Enable** (aur **Speed Insights** → Enable). Ye na karne par script 404 deti hai.
Iske baad 24 ghante me dashboard par data dikhna shuru ho jaata hai.

## 4. Contact form submit ke baad update ✅

- Submit hote hi: form clear + green "Message mil gaya" + **"Send another"** button.
- Message turant **admin → Messages → New** me aa jaata hai (page bhi khud 15 sec me
  refresh hota hai — manuallly reload karne ki zaroorat nahi).
- Message ka **naam click** kariye → us customer ki poori detail (orders, total spend).
- Poori baat padhne ke liye message par click → khul jaati hai.

## 5. Sheet — asli problem mil gayi (ye aapke 1 click ka kaam hai)

Aaj test kiya: **order/message database me 100% save ho raha hai**
(`rowInDb:true`, DB me 5 messages), par **Google Sheet me copy nahi ho raha**.
Wajah hamare code me nahi hai — **Apps Script deployment** me hai:

Test ka jawab aaya:
```
message:  { ok: true, id: "bd1fdf30-…", rowInDb: true, dbCount: 5, sheetMirror: false }
read:     HTTP 200 par body = Google ka login page (JSON nahi)
urlDeployment: "AKfycbwIJ1ge…"
```

Iska matlab: Vercel me jo `/exec` URL pada hai (`AKfycbwIJ1ge…`) wo
**Google login page** de raha hai — yaani us deployment ka access **"Anyone" nahi**
hai, ya wo deployment purana/dead hai. Aapne naya deploy kiya, par uska URL Vercel
me nahi gaya (Vercel me abhi bhi purana URL pada hai).

### Fix — step by step (5 minute, ek hi baar)

1. Sheet kholein → **Extensions → Apps Script**.
2. Sabse **pehli line** ye rakhein (aur save):
   ```js
   var SPREADSHEET_ID = '1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo';
   ```
   (poora code: `docs/00-overview/apps-script-code.md` — copy-paste kaafi hai)
3. `Ctrl + S` (save).
4. **Deploy → Manage deployments** → jo deployment chalu hai uske aage **✏️ (edit)** →
   **Version: New version** → **Who has access: Anyone** (⚠️ "Anyone with a Google
   account" **nahi** — wahi login page deta hai) → **Deploy**.
5. Wo **naya `/exec` URL** copy karein (browser me kholein — JSON aana chahiye
   `{"ok":true,...}`, Google login page nahi).
6. Vercel → liksha-clothing → Settings → Environment Variables →
   `GOOGLE_SHEETS_WEBAPP_URL` → **Edit** → naya `/exec` URL paste → Save →
   **Deployments → latest → ⋯ → Redeploy** (env change ke baad redeploy zaroori hai).
7. Fir ye link kholein (30 second me sach):
   ```
   https://liksha-clothing.vercel.app/api/sheet-selftest?key=lk-st-9f3k2m-7hq4rt-2026&v=fix1
   ```
   - `read.status 200` + `ok:true` = ho gaya ✅
   - `scriptHint` line padh lijiye — wo seedha batata hai kya karna hai.

**Yaad rakhein:** `/exec` URL kisi ko WhatsApp par na bhejein — wo password jaisa hai
(us se aapki sheet me row daali ja sakti hai). Sirf Vercel me daalein.

## 6. Extra (is round me saath me)

- **Payment page ab aur tez** — sheet slow ho to bhi step 3 par intezaar nahi
  (settings 350ms budget + 900ms sheet read timeout).
- **Cold start khatam** — `.github/workflows/keep-warm.yml` har 5 minute me site ko
  halka ping karta hai, isliye pehla order/page load slow nahi hoga (GitHub par free).
- **Admin auto-refresh** — Messages page 15 second me khud update (R27).

## Test result (is commit par)

- TypeScript: web ✅ clean, admin ✅ clean
- Unit tests: **121 pass / 0 fail**
- Web build: ✅ pass
- Deploy: `dpl_3jred8TXRqepKCrXurMe5jjAxHK5` (web), `dpl_3HB9ckjtTLfVjifvMvnoF6F5q5CX` (admin)

## 7. Traffic ka apna counter (dashboard toggle ke bina) — naya

Vercel ka analytics script sirf tab chalta hai jab dashboard me "Enable" ho. Aaj test
kiya: `/_vercel/insights/script.js` = **404** (enable nahi hua). Isliye ek **apna**
counter bhi laga diya:

- website ke har page view par chhoti si POST `/api/track` (koi cookie nahi, IP ka
  sirf hash) → Postgres me `traffic_daily` + `traffic_visitors`
- **admin → Traffic** page: aaj/kal ke views, 7 din ka graph, top pages, aur traffic
  kahan se aaya (Google / Instagram / WhatsApp / Direct)
- bots + preview traffic count nahi hota

File: `apps/web/src/lib/traffic.ts`, `app/api/track/route.ts`,
`components/page-view-tracker.tsx`, `apps/admin/src/app/(admin)/traffic/page.tsx`

Iske saath hi Vercel Analytics/GA4 bhi code me lage hain — jab aap dashboard me
"Enable" karenge, dono jagah data milega.

## 8. Aaj ke test (live, GitHub Actions se)

`Live site audit` chalaya — **saare steps pass**:
storefront smoke (order → pay → invoice → track → contact), internal links (0 404),
Round 16, Round 23 (pincode/speed/WhatsApp), Round 27 (logo center · GSC meta +
file · analytics tags · contact submit + DB save).

Unit tests: **129 pass / 0 fail**.
