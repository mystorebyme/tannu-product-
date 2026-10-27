# Owner Report — Round 40 (27 Oct 2026)

Owner ke shabd: **"supabase pr nhai chiye… sheet mai hi chiye — only sheet"** (aur
Supabase project aapne khud delete kar diya tha) · **"google sheet ka koi bi chij
hardcoded nhai honi chiye… koi bi nhai means koi bi nhai"** (change turant dikhna
chahiye) · **"bar bar merge mt kro"** (sab ek saath) · aur repeat checkout par **purana
cached order** dikhne ka bug.

---

## 1. Order kyun fail ho rahe the — sach (root cause)

Aapne Supabase (database) ka project **khud band kar diya**. Site abhi bhi order save
karne ke liye usi database (`DATABASE_URL`) ko dhundhti thi → connection fail → har naya
order **"Order server par save nahi hua"** (500). Site chalti thi (products, settings,
payment page sab sheet se hain) — sirf **order save** tuta tha, kyunki order ka ghar
Supabase tha.

Ek aur purani bimari isi ki den thi: database na hone par Vercel ka fallback order ko
**apne instance ki temporary file** me rakh deta tha — ye file har server-instance alag
hoti hai aur restart par gayab. Isi se **"naya order karne par purana (cached) order
dikhna"** wala symptom banta tha. Ye fallback **store nahi hai** — isliye R40 me is par
bharosa karna band.

## 2. Ab sheet HI database hai — "only sheet" ✅

Aapke rule ke mutabik order ka poora ghar ab **aapki Google Sheet** hai:

| Kya | Ab kaise |
| --- | --- |
| Naya order | Site sheet me **turant row likhti hai aur likhne ka intezaar karti hai** (`Orders` row + `Order JSON` snapshot + `OrderItems` + `Payments`). Row likhi gayi = hi customer ko "order placed" dikhta hai |
| Sheet likh na paye | **Jhoothi success nahi** — saaf error: "Order sheet me save nahi hua" + WhatsApp par order karne ka raasta. Aapko pata chalega ki kuch gadbad hai |
| Order padhna | Site sheet se padhti hai (`order_state`) — order page, tracking, invoice, admin list — sab sheet se |
| Aapka sheet edit | Status/`Admin Note`/courier/AWB seedha sheet me edit kariye — **~2 second** me site par (redeploy kuch nahi). Paisa (`payment status`) site ka truth rehta hai — sheet se paisa override nahi hota |
| Messages + manual invoices | Contact messages `Messages` tab me (`Message ID`/`Replied` ke saath), manual invoices `Invoices` tab me (`Invoice JSON`) |
| Database (`DATABASE_URL`) | **Vercel se delete** + Cloudflare Worker config se bhi nikla. Postgres ka code sirf dev ke liye bacha hai (production me kabhi use nahi hoga) |

**Zaroori:** script ka version **r40-1** chahiye (neeche §5). Jab tak purana script hai,
site order place karne par **imandari se 503** degi ("sheet store ready nahi") — chup-chaap
galat jagah save nahi karegi.

## 3. Sheet ka kuch bhi hardcoded nahi — "koi bi nhai" ✅

Pehle sheet ka id code me **3 jagah** likha tha (script constant, site constant, selfcheck).
Ab **zero**:

| Kahan | Kya |
| --- | --- |
| Script | Sheet ka id sirf **Script Properties** (`SHEET_ID`) me. Naya script paste karo → props khaali → `/exec` browser me kholte hi **"Sheet URL set karein" form** — sheet ka link daaliye, bas. Script kabhi galat sheet par nahi jaata, na copy me likhta hai |
| Site | Id sirf **Vercel env** (`SHEET_EXPECTED_ID`) me — wo bhi sirf **auto-heal** ke liye: script ki props khaali mile to site **khud** `sheet_set` chala kar aapki final sheet jod deti hai (aapko kuch nahi karna) |
| Sheet badalni ho | `/exec` panel form se ya env update se — **code change nahi, redeploy nahi**; agle order se turant lagu |
| Tests | Guard tests pin karte hain: purani/koi bhi sheet id code me dikhi → **test fail**. Dobara hardcode hona namumkin |

## 4. Purana cached order wala bug ✅

**Wajah:** payment app se wapas aane par checkout page URL ke `?order=LK-…` ko "abhi-abhi
order place hua hai" samajh leta tha. Agar aap uske baad **naya** order bharte (cart me
nayi items), to purana order number page par chipka rehta — purana order hi dikhta/place
hota, naya nahi.

**Fix:** ab checkout pehchanta hai ki "resume wala order **purana** hai" (cart me nayi
lines hain) → purana `?order=` param **ignore**, URL ek baar saaf, form step 1 se. Payment
se **sahi** wapsi (jiska order abhi place hua, cart khali) pehle jaisi hi kaam karti hai —
koi tuta nahi.

## 5. Aapke kadam (bas 1 paste — r39-1 bhi isi me hai)

Live script abhi **r38-1** par hai (r39-1 paste hona baaki tha). R40 ka **r40-1** dono ko
cover karta hai — ek hi paste:

1. script.google.com → apna sheet-script project → poora code select-delete →
   `docs/00-overview/apps-script-code.md` ka **r40-1** code paste → Save.
2. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
3. **Token dobara set NAHI karna** (Script Properties me safe — R38 ka paste-proof design).
4. `/exec` browser me kholiye:
   - Panel me **"SHEET_ID set nahi"** dikhe to wahi form me apni sheet ka link daal kar
     set kar dijiye (ya kuch na kariye — site ka auto-heal khud jod dega).
   - Panel green dikhe (version r40-1, sheet found, token ok) → ho gaya.
5. Verify: `designerclothing.fashion/api/sheet-health` → `"ok": true`,
   `ordersStore: "sheet"`, `idMatch: true`. Phir ek chhota test order kariye — Orders tab
   me row + `Order JSON` bhara dikhega.

## 6. "Bar bar merge mt kro" — ek hi baar ✅

Poora R40 (script + site + tests + docs + deploy + Vercel se `DATABASE_URL` delete)
**ek hi PR, ek hi merge, ek hi production deploy** me gaya — beech me kuch alag se
merge/deploy nahi hua.

## 7. Purane orders ka kya?

Supabase band hone se pehle jo orders the, unki **mirror rows aapki sheet me pehle se
hain** (R37 se har order sheet me bhi likha jaata tha) — sheet me jo dikhta hai wo safe
hai. R40 ke baad har naya order **poore detail (`Order JSON`) ke saath** sheet me aayega,
isliye aage se sheet hi poora record hai.

## 8. Quality (is round ke gates)

typecheck 0 errors · unit **294/294** (15 naye R40 tests — order_state roundtrip, panel
bootstrap, guards) · test:all **353/353** · lint web 0 errors/34 warnings · next +
Workers build ✅ · Next-production parity: smoke **111/0**, payments 61/0, links 40/0,
round16 35/0, responsive 44/0, breakpoints 48/0 · workerd (Cloudflare) parity **111/0**
(`DATABASE_URL` ki zaroorat worker se bhi gayab).

Deploy: ek PR → merge → `main` → Vercel production + `DATABASE_URL` delete → verify
(details PROGRESS.md Round 40 me).
