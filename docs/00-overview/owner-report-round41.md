# Owner Report — Round 41 (27 Oct 2026)

Aapke shabd: **"ye direct mt baya kro ki kya problem hai server problem ok sabhi jgha ok fix
kro"** · **"abhi bi sheet mai nhai aa rha hai fix kro yrr"** · UPI ID sheet me fix kiya par
**site par purana/dusra dikhna** · **messages/newsletter/checkout events sheet me na aana**.

Charo ka ilaaj **ek hi batch** me (ek PR, ek merge, ek deploy — "bar bar merge mt kro" rule).

---

## 1. Sach: orders sheet me kyun nahi aa rahe the

Pichle round (R40) me site ko orders ke liye script ka **r40+ version chahiye tha** — kyunki
order ka poora JSON snapshot (`Order JSON` column) sirf r40-1 script samajhta hai. Aap r40-1
**paste nahi kar paye**, isliye aapki sheet par abhi bhi **r38-1** script chal rahi hai. R40 ki
site imandari se mana kar rahi thi: "script purana hai" → order place hi nahi hota tha (503),
aur customer ko technical error dikhta tha.

**R41 ka rule badla: site ab LIVE script ke saath chalti hai** — r40+ upgrade hai, majboori
nahi:

| Script | Mode | Kya hota hai |
| --- | --- | --- |
| r38-1 / r39-1 (aapki sheet par abhi) | **compat** | Orders waise hi sheet me save hote hain — `Orders`/`OrderItems`/`Payments` rows. Padhne me site rows se order **dobara jodti** hai (customer, phone, total, items, status — sab columns se). Sirf `Order JSON` snapshot column nahi banta (purana script us column ko jaanta hi nahi) |
| r40-1 (jab paste kar dein) | **full** | Poora snapshot + history — jo R40 me design hua tha. Compat ke sab kaam isme bhi chalte hain |

Yaani **abhi, bina paste kiye**, order → sheet row likhi jayegi. Deploy ke baad
`/api/sheet-health` par `sheetOrders.mode: "compat"` dikhega — ye confirmation hai.

## 2. Customer ko ab sirf friendly message — "server problem" kahin nahi

Aapke rule ke mutabik **har customer touchpoint** par technical wording hata di:

- Order fail ho (sheet slow/down, kuch bhi) → customer ko: **"Order abhi complete nahi hua.
  Thodi der me dobara try kariye, ya WhatsApp par order bhej dijiye — team turant confirm
  karegi."**
- Koi bhi API 500 de, reply padha na jaye, ya galat reply aaye → friendly Hinglish message
  (checkout banner, order API, payment context — sab jagah same tone).
- "Server", "sheet store", "503" jaise shabd customer ab **kabhi nahi** dekhega.

Technical detail ab sirf **aapki** jagah: `/api/sheet-health` (mode, version, idMatch, script
probe, last write) aur server logs. Wahan se humein pata chalta rahega ki andar kya hua —
customer ko sirf seedhi baat.

## 3. UPI ID: sheet ki value hi jeetti hai — par check karein script kaun si sheet padh raha hai

Site UPI ID **sirf sheet se** padhti hai (Settings tab ki `upi_id` row; koi hardcoded fallback
nahi — R38 se hi `dhakadgourav@fam` code se bahar hai). Agar sheet me fix karne ke baad bhi
site par purana dikh raha ho, to 2 hi wajah ho sakti hain:

1. **Script koi doosri sheet padh raha hai** (props me SHEET_ID badla hua) — 3 minute me check:
   browser me kholein **`<exec URL>?action=settings`** (wahi Apps Script URL jo Vercel me
   `GOOGLE_SHEETS_WEBAPP_URL` hai). Jo `upi_id` wahan dikhe, wahi site par aayega. Wahan purana
   dikh raha hai? → script galat sheet pakde hue hai:
   - script **r40+** ho to site **khud theek kar deti hai** (R41: `idMatch:false` milte hi
     `SHEET_EXPECTED_ID` se `sheet_set` auto-heal, 10-min rate limit);
   - r38-1 par auto-heal nahi hota — `/exec` panel me sheet URL daal kar set karein, ya r40-1
     paste karein (phir auto-heal kaam karega).
2. **Settings tab me key ka naam galat** — column A me exactly `upi_id` likha ho (chhote
   akshar, underscore), value column B me. `UPI ID`/`upiid` jaisa naam script nahi padhta.

Site side confirm: `/api/sheet-health` → `sheet.idMatch: true` aur `upiLoaded: true` hona
chahiye. Settings ~2 second cache me rehti hai — sheet edit ke baad page refresh karein.

## 4. Messages, newsletter, checkout events — sheet me wapas

Ye teeno **kabhi version-gate ke peeche nahi the** — ye `append`/`subscribe` actions se likhte
hain jo r38-1 me bhi hain. R41 me do asli rukawatein hatayi:

- Orders ka gate ("r40+ chahiye") poore sheet-pipeline ko confuse kar raha tha — ab orders
  compat se chalte hain to mirrors ke saath poora pipeline ek hi mode me hai.
- Purana `Messages` tab (7 columns — `Message ID` column nahi) admin list tod deta tha → ab
  site synthetic id bana leti hai (`row:<Timestamp>|<Email>`), list chalti rehti hai.
  (Replied-mark purane tab par degrade karta hai — r40-1 paste ke baad poora kaam karega.)

Deploy ke baad ek contact form khud bhar kar check karein: `Messages` tab me row ~2-4 second me
aani chahiye. Newsletter aur checkout-events (`Checkout` tab) bhi isi raaste se jaate hain.

## 5. Aapke 3 self-check (deploy ke baad, 5 minute)

1. **`/api/sheet-health` kholein** (designerclothing.fashion/api/sheet-health):
   `sheetOrders: { ready: true, mode: "compat" }` ✓, `sheet.script.idMatch: true` ✓,
   `upiLoaded: true` ✓. `warnings` me "compat mode" line dikhegi — normal hai (r40-1 paste
   ke baad hat jayegi).
2. **`<exec URL>?action=settings`** — script ki apni nazar se settings. `upi_id` wahi ho jo
   aapne sheet me likha ✓.
3. **Ek test order** khud place karein → sheet ke `Orders` tab me row + order page par status.
   Customer wale kisi bhi error me ab sirf friendly WhatsApp wala message dikhega.

## 6. Full mode kab chahiye?

Compat me sab kuch chalta hai; farq sirf itna: r40-1 par order ka **poora JSON snapshot** bhi
sheet me banta hai (read fast + history exact), `Message ID` se replied-mark pakka chalta hai,
aur `sheet_set`/auto-heal jaise naye tools milte hain. Jab 5 minute milein: `docs/00-overview/
apps-script-code.md` ka **r40-1** code → Apps Script editor me paste → New version → Deploy
(URL wahi rahega). Site **khud** full mode par switch ho jayegi — koi redeploy nahi.

---

### Is round me kya-kya badla (technical, ek nazar me)

- `orders-sheet.ts`: `SheetOrdersMode` (full/compat/none) + compat read paths (`action=order`
  rows **reverse** — r38 ka `findRows_` bottom-up hota hai, aur `action=recent` grouping).
- `sheet-merge.ts`: `groupOrdersFromRecentRows` (naya) + `orderFromSheetRows` ab har column
  **last-non-empty** scan se (sparse onEdit rows se data gayab nahi hota).
- `orders.ts`, `http-json.ts`, `checkout-form.tsx`: friendly copy (customer side); technical
  detail sirf owner-side endpoints/logs me.
- `google-sheets.ts` + `/api/sheet-health`: payload me `sheetOrders.mode`; major<40 → warnings;
  r40+ par `idMatch:false` → auto `sheet_set` heal; `!ready` → env-fix help.
- `messages.ts`: synthetic id fallback (7-col Messages tab).
- Tests: unit **303/303** (9 naye R41 + r38 compat contract harness), test:all **362**;
  parity smoke (Next + workerd): **111/0** dono; payments 61/0; typecheck 0; lint 0 errors.
- **Koi sheet id/URL/token hardcode nahi** — sab props/env se hi (R40 rule barkarar).
