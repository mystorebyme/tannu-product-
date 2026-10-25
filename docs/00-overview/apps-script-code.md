# Apps Script v3 — poora code (copy-paste)

> Ye file `scripts/google-apps-script/liksha-sheets.gs` se **automatic** bani hai
> (`node scripts/apps-script:export` → `node scripts/export-apps-script.mjs`).
> Yahan se copy kariye, code hamesha latest rahega.
>
> **Step-by-step guide:** [`apps-script-setup-steps.md`](./apps-script-setup-steps.md)
> (permission, deploy, Vercel env, troubleshooting — sab detail me)

**Kya karta hai:** website ke sab events Google Sheet me likhta hai (16 tabs) —

| Tab | Kya aata hai |
| --- | --- |
| **Settings** | phone, WhatsApp, email, UPI ID, UPI name, announcement, free shipping, GSTIN |
| **Dashboard** | aaj ke orders, revenue, pending payment, naye messages (script khud bharta hai) |
| **Orders** | har order + har status change (append-only timeline) |
| **OrderItems** | order ki har item alag row (size, colour, qty, price) |
| **Payments** | UTR submit, "payment hui hai" claim, verify, fail, reverse |
| **Invoices** | GST invoice (taxable value, CGST/SGST/IGST, total) |
| **Shipments** | courier, AWB, tracking URL, dispatch/delivery status |
| **Checkout** | funnel: checkout khula → review → order placed → order fail (reason ke saath) |
| **Messages** | contact form (+ replied status) |
| **Newsletter** | email subscribers (duplicate apne aap skip) |
| **Reviews** | customer reviews (rating, verified, approve/pending) |
| **Coupons** | coupon codes, uses, limit, active |
| **Inventory** | stock ka har change (kisne, kitna, kyun) |
| **Audit** | admin panel ki activity |
| **Errors** | website/script ki error (debug ke liye) |
| **Sync** | har sync call ka hisaab (kab, kya, kitni rows) |

---

## Steps (ek baar, ~4 minute)

1. Google Sheet kholein → **Extensions → Apps Script**.
2. `Code.gs` ka purana code **poora delete** kariye (Ctrl+A → Delete) →
   neeche wala **poora code** paste kariye.
3. Sabse upar `var TOKEN = 'CHANGE-ME-liksha-token';` me apna lamba random word daaliye
   (jaise `liksha-9f3k2m-2026`). **Yahi token Vercel me daalna hai** — dono jagah same.
4. **Ctrl+S** (save).
5. Editor me upar function dropdown → **`setup`** → **Run** → permission maange to
   **Review permissions → apna account → Advanced → Go to … (unsafe) → Allow**.
   → Sheet me 16 tab + headers + default settings ban jayenge.
6. **Deploy → New deployment → (cog) Web app**
   - Description: `liksha v3`
   - **Execute as: Me**
   - **Who has access: Anyone**   ⚠️ ("Anyone with a Google account" **nahi**)
   - **Deploy** → **Web app URL** copy kariye (`.../exec` par khatam hota hai).
7. Test: browser me
   `<Web app URL>?action=health&token=<TOKEN>`
   → `{"ok":true,"version":"r27-1","spreadsheet":"…","sheets":[…]}` aana chahiye.
   (version purana dikhe to Step 6 dobara — sirf Ctrl+S se code nahi chalta.)
8. **2 value Vercel me daaliye** (project `liksha-clothing` → Settings → Environment
   Variables → **Redeploy**):

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_SHEETS_WEBAPP_URL` | aapka `/exec` URL |
   | `GOOGLE_SHEETS_TOKEN` | aapka token |

9. Verify: website par test message + test order → Messages / Orders / OrderItems tabs me
   rows. Ya `node scripts/sheets-selfcheck.mjs "<URL>" "<TOKEN>"`.

**Optional:** function `installTriggers` → Run (roz 9 PM Dashboard + Sunday backup),
`testSelf` (poora check), `repairHeaders` (header repair), `backupNow` (Drive me copy).

---

## Code badalne par (yaad rakhiye)

Apps Script me code update karne ke baad **naya version deploy** karna padta hai:
**Deploy → Manage deployments → (pencil) Edit → Version: New version → Deploy**.
Warna purana code hi chalta rehta hai — owner ke saath yahi hua tha.

## Sheet ke rules

- **Header row (pehli row) na hataayein.** Script column ko **naam** se dhoondhta hai,
  isliye column ka order badalna theek hai; header ka naam badalna/hatana nahi.
- Naya column add karna theek hai (script khud bhi missing column add kar deta hai).
- `Who has access: Anyone` rakhein — website anonymous request bhejti hai. Data safe hai
  kyunki token ke bina script kuch read/write nahi karta.
- `/exec` URL aur TOKEN kisi ko na dein — inse sheet me row daali ja sakti hai.

---

## Poora code (1723 lines)

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LIKSHA / DESIGNER CLOTHING — Google Sheet ↔ website bridge   (Apps Script v3)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Ye ek **poora backend** hai jo website aur owner ki Google Sheet ke beech me
 * baithta hai. Website isse HTTP par baat karti hai, aur ye sheet me rows likhta
 * hai / sheet se settings padhta hai. Koi 3rd party service nahi, koi paid tool
 * nahi — sirf Google Apps Script (free).
 *
 * ── KAAM (16 tabs) ────────────────────────────────────────────────────────────
 *   Settings    → phone / WhatsApp / email / UPI / announcement / GSTIN (site 15s me padhti hai)
 *   Orders      → har order + har status change (append-only timeline)
 *   OrderItems  → order ki har item alag row me (size, colour, qty, price)
 *   Payments    → payment pending / UTR submitted / claimed / verified / failed
 *   Invoices    → GST invoice (taxable value, CGST/SGST/IGST, invoice number)
 *   Shipments   → courier, AWB, tracking URL, dispatch/delivery status
 *   Checkout    → funnel: checkout khula → review → order placed → order failed
 *   Messages    → contact form ke messages (+ replied status)
 *   Newsletter  → email subscribers (duplicate email apne aap skip)
 *   Reviews     → customer reviews (rating, verified, approve/pending)
 *   Coupons     → coupon codes, uses, limit, active
 *   Inventory   → stock ka har change (kisne, kitna, kyun)
 *   Audit       → admin panel ki har important activity
 *   Errors      → website/script ki error ka log (debug ke liye)
 *   Dashboard   → aaj ka summary (orders, revenue, pending, messages) — script khud bharta hai
 *   Sync        → har sync call ka hisaab (kab, kya, kitni rows)
 *
 * ── SETUP (ek baar, 4 minute) ─────────────────────────────────────────────────
 *  1. Google Sheet kholiye (wahi jisme data chahiye).
 *  2. Extensions → Apps Script.
 *  3. `Code.gs` ka poora purana code **delete** karke niche ka poora code paste kijiye.
 *  4. Neeche `TOKEN` me apna lamba random word daaliye (yahi Vercel ke
 *     `GOOGLE_SHEETS_TOKEN` me jaana chahiye).
 *  5. Save (Ctrl + S).
 *  6. Upar function dropdown me `setup` chuniye → **Run** → permission maange to
 *     apna hi account chuniye → "Advanced" → "Go to … (unsafe)" → **Allow**.
 *     (Ye "unsafe" warning har personal script par aata hai — normal hai.)
 *     → Sheet me saare 16 tabs + headers apne aap ban jayenge.
 *  7. **Deploy → New deployment → gear icon → Web app**
 *       Description     : liksha v3
 *       Execute as      : **Me**
 *       Who has access  : **Anyone**            ← "Anyone with Google account" NAHI
 *     → Deploy → **Web app URL** copy kariye (…/exec par khatam hota hai).
 *  8. Vercel → project `liksha-clothing` → Settings → Environment Variables:
 *       GOOGLE_SHEETS_WEBAPP_URL = <wahi /exec URL>
 *       GOOGLE_SHEETS_TOKEN      = <TOKEN jaisa hi>
 *     → Save → Deployments → latest → ⋯ → **Redeploy**.
 *  9. Test: browser me kholein (TOKEN apna):
 *       <webapp URL>?action=health&token=<TOKEN>
 *     Jawab: {"ok":true,"version":"r27-1","sheets":[…]}
 *     Phir website par ek test message bhejiye → Messages tab me row aa jayegi.
 *
 * ── ZAROORI BAATEIN ───────────────────────────────────────────────────────────
 *  • Code badalne ke baad **naya version** deploy karna padta hai:
 *    Deploy → Manage deployments → ✏️ (pencil) → Version: **New version** → Deploy.
 *    Sirf Ctrl+S karne se code save hota hai, **chalta purana hi rehta hai**.
 *    (Owner ke saath yahi galti hui thi — isliye `?action=health` me `version`
 *    dikhta hai; wahan purana version aaye to matlab naya deploy nahi hua.)
 *  • "Who has access: Anyone" hi rakhein — website anonymous request bhejti hai.
 *  • TOKEN kisi ko na dein. Isse aapki sheet me row daali ja sakti hai.
 *  • Sheet ka naam badalne par bhi kaam karta hai (gid + naam dono se dhoondhta hai).
 *  • Ye script sheet ke bahar kuch nahi bhejta — sirf aapki sheet likhta/padhta hai.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════ 1. CONFIG (yahi badalna hota hai) ═══════════════ */

/** Apna secret token — Vercel ke GOOGLE_SHEETS_TOKEN se bilkul same rakhein. */
var TOKEN = 'CHANGE-ME-liksha-token';

/** Code ka version — `?action=health` me dikhta hai. Code badle to isse badhaayein. */
var CODE_VERSION = 'r27-1';

/**
 * Sheet ka id (URL me `/d/<ID>/edit`).
 * Extensions → Apps Script se banaya ho to ye line zaroori nahi, par standalone
 * script me kaam aati hai. (Neeche fallback bhi hai — delete karne par crash nahi.)
 */
var SPREADSHEET_ID = '1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo';

/** Safety net — agar upar ki line galti se delete ho jaye. */
var SHEET_ID_FALLBACK = '1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo';

/** Sheet ke tab-id (URL me `#gid=…`) — optional, naam badalne par bhi kaam aate hain. */
var GIDS = {
  Settings: 1827766020,
  Orders: 19757621,
  Payments: 1008049319,
  Messages: 750680779,
  Newsletter: 1223926652,
  // ye tabs script khud banata hai (gid Google deta hai)
  OrderItems: null,
  Invoices: null,
  Shipments: null,
  Checkout: null,
  Reviews: null,
  Coupons: null,
  Inventory: null,
  Audit: null,
  Errors: null,
  Dashboard: null,
  Sync: null,
};

/** Timezone / paise ka format */
var TIMEZONE = 'Asia/Kolkata';
var MONEY_FORMAT = '₹#,##0.00';

/** Ek call me kitni rows (Vercel se batch aata hai; bahut badi call block na kare) */
var MAX_ROWS_PER_CALL = 300;
/** Ek cell me itne se zyada characters na jaayein */
var MAX_CELL_CHARS = 5000;
/** Sheet ka lock kitni der wait kare (do requests ek saath aayein to) */
var LOCK_WAIT_MS = 25000;
/** Errors tab me sirf itni hi purani rows rakhein (warna tab bhaari ho jata hai) */
var ERRORS_KEEP = 2000;

/* ═══════════════════════════ 2. TAB HEADERS ══════════════════════════════════ */

/**
 * Har tab ke columns.
 *   • Append **naam se** hota hai (position se nahi) — column ka order badle,
 *     beech me naya column aaye, tab bhi data sahi jagah jaata hai.
 *   • Purani sheet me koi column missing ho to script header khud repair karta hai.
 *   • Naya column yahan add karne par purani sheet me bhi apne aap jud jaata hai.
 */
var HEADERS = {
  Orders: [
    'Timestamp', 'Event', 'Order number', 'Order status', 'Payment status', 'Payment method',
    'Payment reference', 'UPI ID', 'Total', 'Subtotal', 'Discount', 'Coupon', 'Items',
    'Item details', 'Customer', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode',
    'Tracking courier', 'AWB', 'Tracking URL', 'Notes', 'Source', 'Device',
  ],
  Payments: [
    'Timestamp', 'Event', 'Order number', 'Order status', 'Payment status', 'Payment method',
    'Payment reference', 'UPI ID', 'Total', 'Subtotal', 'Discount', 'Coupon', 'Items',
    'Item details', 'Customer', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode',
    'Tracking courier', 'AWB', 'Tracking URL', 'Notes', 'Verified by', 'Verified at',
  ],
  OrderItems: [
    'Timestamp', 'Order number', 'Product', 'Handle', 'SKU', 'Size', 'Colour',
    'Quantity', 'Price', 'Line total', 'Category', 'Image URL', 'Status',
  ],
  Invoices: [
    'Timestamp', 'Invoice number', 'Order number', 'Type', 'Customer', 'Phone', 'Email',
    'GSTIN', 'Address', 'State', 'Taxable value', 'CGST', 'SGST', 'IGST',
    'Shipping', 'Discount', 'Total', 'Notes',
  ],
  Shipments: [
    'Timestamp', 'Order number', 'Courier', 'AWB', 'Tracking URL', 'Status',
    'Expected delivery', 'Note', 'Updated by',
  ],
  Checkout: [
    'Timestamp', 'Event', 'Step', 'Order number', 'Items', 'Subtotal', 'Reason', 'Phone',
    'Session', 'City', 'State', 'Pincode',
  ],
  Messages: [
    'Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Status',
    'Replied', 'Replied at', 'Source page', 'Message ID',
  ],
  Newsletter: ['Timestamp', 'Email', 'Source', 'Status'],
  Reviews: [
    'Timestamp', 'Product', 'Handle', 'Customer', 'Rating', 'Title', 'Review',
    'Verified', 'Status', 'Photo URL', 'Order number',
  ],
  Coupons: [
    'Timestamp', 'Code', 'Type', 'Value', 'Min order', 'Max uses', 'Used',
    'Active', 'Expires', 'Note',
  ],
  Inventory: [
    'Timestamp', 'Product', 'Handle', 'SKU', 'Size', 'Stock', 'Change', 'Reason',
    'Updated by', 'Low stock alert',
  ],
  Audit: ['Timestamp', 'Actor', 'Action', 'Target', 'Details', 'IP'],
  Errors: ['Timestamp', 'Context', 'Message', 'Payload', 'Version'],
  Dashboard: ['Timestamp', 'Metric', 'Value', 'Note'],
  Sync: ['Timestamp', 'Direction', 'Sheet', 'Rows', 'Status', 'Detail'],
};

/** Settings tab ke default rows (sirf tab khaali ho tab likhe jaate hain). */
var DEFAULT_SETTINGS = [
  ['support_phone', '8005900581'],
  ['whatsapp', '8005900581'],
  ['support_email', 'Info.likshaclothing@gmail.com'],
  ['upi_id', 'dhakadgourav@fam'],
  ['upi_name', 'Designer Clothing'],
  ['announcement', 'Diwali Sale — Flat 70% OFF · Final price ₹499 onwards'],
  ['gstin', ''],
  ['free_shipping', 'true'],
  ['admin_url', ''],
  ['store_name', 'Designer Clothing'],
  ['order_prefix', 'LK'],
  ['prepaid_only', 'true'],
  ['support_hours', 'Monday to Saturday, 10:00 AM – 8:00 PM IST'],
  ['return_window_days', '7'],
  ['instagram', 'https://www.instagram.com/designer_clothing_9'],
];

/** Dashboard me jo metrics har baar likhe jaate hain. */
var DASHBOARD_METRICS = [
  'Orders (total)', 'Orders (today)', 'Revenue (paid)', 'Pending payment',
  'Messages (new)', 'Newsletter subscribers', 'Reviews (pending)', 'Low stock SKUs',
];

/** Money columns — in par ₹ format lagta hai (sirf naye tab banne par). */
var MONEY_COLUMNS = {
  Orders: ['Total', 'Subtotal', 'Discount'],
  Payments: ['Total', 'Subtotal', 'Discount'],
  OrderItems: ['Price', 'Line total'],
  Invoices: ['Taxable value', 'CGST', 'SGST', 'IGST', 'Shipping', 'Discount', 'Total'],
  Inventory: ['Stock'],
};

/** Timestamp column — date format lagta hai. */
var TIMESTAMP_COLUMN = 'Timestamp';

/* ═══════════════════════════ 3. CHHOTE HELPERS ═══════════════════════════════ */

/** JSON response — Apps Script ka `ContentService` sirf text bhej sakta hai. */
function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** Abhi ka time (ISO string) */
function now_() {
  return new Date().toISOString();
}

/** Sheet me dikhne wala time — IST me, padhne me aasan. */
function istNow_() {
  try {
    return Utilities.formatDate(new Date(), TIMEZONE, 'dd-MMM-yyyy HH:mm:ss');
  } catch (error) {
    return now_();
  }
}

/** Aaj ki date `YYYY-MM-DD` (IST) — "aaj ke orders" ginne ke liye. */
function todayKey_() {
  try {
    return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  } catch (error) {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Kisi bhi value ko number me (paise/rupees dono handle). */
function num_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  var cleaned = String(value === null || value === undefined ? '' : value).replace(/[^0-9.\-]/g, '');
  var parsed = Number(cleaned);
  return isFinite(parsed) ? parsed : 0;
}

/** Text ko saaf karo — extra spaces hatao, lambai cap karo. */
function text_(value) {
  if (value === null || value === undefined) return '';
  var clean = String(value).replace(/\s+/g, ' ').trim();
  return clean.length > MAX_CELL_CHARS ? clean.slice(0, MAX_CELL_CHARS) : clean;
}

/** Chhota stable hash (dedupe ke liye) */
function hash_(value) {
  var text = String(value === null || value === undefined ? '' : value);
  var hash = 0;
  for (var i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + Math.abs(hash).toString(36);
}

/** `true/1/yes/haan` → true */
function truthy_(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  return /^(true|yes|y|1|on|haan|ha)$/i.test(String(value).trim());
}

/** Array ko chhote tukdon me baanto (bahut badi call ko todne ke liye) */
function chunk_(list, size) {
  var out = [];
  for (var i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ═══════════════════════════ 4. SHEET ACCESS ════════════════════════════════ */

/**
 * Kaun si sheet? — pehle `SPREADSHEET_ID`, phir Script Property `SHEET_ID`,
 * phir (last me) jis sheet ke saath script bana hai.
 *
 * Order jaan-boojhkar aisa hai: agar script kisi "copy" sheet ke saath bound ho
 * gaya ho to `getActiveSpreadsheet()` galat jagah likh deta tha (owner ke saath
 * yahi hua tha — asli sheet khaali dikh rahi thi).
 *
 * `typeof` ka use: agar `SPREADSHEET_ID` line delete ho jaye to crash na ho.
 */
function book_() {
  var id = (typeof SPREADSHEET_ID === 'string' && SPREADSHEET_ID) || SHEET_ID_FALLBACK;
  var props = null;
  try {
    props = PropertiesService.getScriptProperties();
    if (props && props.getProperty('SHEET_ID')) id = props.getProperty('SHEET_ID');
  } catch (error) {
    props = null;
  }
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (error) {
      // is account ko is sheet par access nahi — neeche apni sheet bana lenge
      Logger.log('book_: "' + id + '" khul nahi rahi (' + error.message + ')');
    }
  }

  var active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (ignored) {}
  if (active) return active;

  /**
   * Kuch bhi nahi khula → **apni sheet khud bana lo** (jo account script chala raha
   * hai usi ke Drive me). Owner ke saath yahi problem thi: sheet doosre account ki
   * thi aur "You do not have permission to access the requested document" aata tha.
   * Ab script apni sheet bana kar usme likhti hai — koi sharing ki zaroorat nahi.
   */
  var created = SpreadsheetApp.create('Designer Clothing — Store (website data)');
  if (props) {
    try {
      props.setProperty('SHEET_ID', created.getId());
    } catch (ignored) {}
  }
  Logger.log('book_: nayi sheet ban gayi → ' + created.getUrl());
  return created;
}

/**
 * `createOwnSheet` — owner ke liye: **isi Google account me nayi sheet** banao aur
 * wahi website ke liye use karo (purani sheet kisi doosre account ki ho to).
 *
 * Kya karta hai:
 *   1. nayi spreadsheet banti hai ("Designer Clothing — Store"),
 *   2. uska id Script Properties me save hota hai (aage yahi use hogi),
 *   3. saare 16 tabs + headers + formatting + default settings ban jaate hain,
 *   4. **URL** log me + toast me milta hai.
 *
 * Purani sheet ko chheda nahi jaata (data safe rehta hai).
 */
function createOwnSheet() {
  return guard_('createOwnSheet', function () {
    var created = SpreadsheetApp.create('Designer Clothing — Store (website data)');
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', created.getId());
    var created2 = setup_();
    Logger.log('✅ Nayi sheet: ' + created.getUrl());
    Logger.log('   (id: ' + created.getId() + ') — ab yahi sheet website ke liye use hogi.');
    Logger.log('   Tabs bane: ' + (created2.join(', ') || 'sab pehle se the'));
    try {
      created.toast('Sheet ready ✔ URL: ' + created.getUrl(), 'createOwnSheet', 20);
    } catch (ignored) {}
    return { url: created.getUrl(), id: created.getId(), tabs: created2 };
  });
}

/**
 * Kis Google account se script chal rahi hai?
 *
 * Ye sabse zaroori sawaal hai jab "You do not have permission to access the
 * requested document" aata hai — sheet kisi **doosre** account ki hoti hai aur
 * is account ko us par Editor access nahi hota.
 */
function executingEmail_() {
  try {
    if (typeof Session !== 'undefined' && Session.getEffectiveUser) {
      var effective = Session.getEffectiveUser().getEmail();
      if (effective) return effective;
    }
  } catch (ignored) {}
  try {
    if (typeof Session !== 'undefined' && Session.getActiveUser) return Session.getActiveUser().getEmail() || '';
  } catch (ignored) {}
  return '';
}

/**
 * `whoAmI` — function dropdown se Run kariye, **Execution log** me dikhega:
 * kaun sa account chal raha hai, aur us account ko sheet mil rahi hai ya nahi.
 * Permission wali error me sabse pehle yahi chalaiye.
 */
function whoAmI() {
  var id = (typeof SPREADSHEET_ID === 'string' && SPREADSHEET_ID) || SHEET_ID_FALLBACK;
  var info = { version: CODE_VERSION, effectiveUser: executingEmail_(), sheetId: id, sheetAccess: false, sheetName: '', error: '' };
  try {
    var book = SpreadsheetApp.openById(id);
    info.sheetAccess = true;
    info.sheetName = book.getName();
  } catch (error) {
    info.error = String(error && error.message ? error.message : error);
  }
  Logger.log(JSON.stringify(info, null, 2));
  try {
    book_().toast(
      info.sheetAccess ? 'Sheet mil gayi ✔ (' + info.sheetName + ')' : 'Sheet access nahi — Share → Editor kariye',
      'whoAmI',
      8,
    );
  } catch (ignored) {}
  return info;
}

/**
 * `doctor` — poora health check ek jagah (log me padhne layak):
 * account, sheet access, tabs, settings, token length, version.
 * Kuch bhi fail ho to yahin pata chal jayega — pehle isi ko chalaiye.
 */
function doctor() {
  var report = {
    version: CODE_VERSION,
    time: istNow_(),
    account: executingEmail_(),
    tokenSet: Boolean(TOKEN) && TOKEN !== 'CHANGE-ME-liksha-token',
    tokenLength: String(TOKEN || '').length,
    sheetId: (typeof SPREADSHEET_ID === 'string' && SPREADSHEET_ID) || SHEET_ID_FALLBACK,
    sheetAccess: false,
    sheetName: '',
    tabs: [],
    settingsKeys: 0,
    problems: [],
  };
  try {
    var book = SpreadsheetApp.openById(report.sheetId);
    report.sheetAccess = true;
    report.sheetName = book.getName();
  } catch (error) {
    report.problems.push(
      'Configured sheet khul nahi rahi (' + (error && error.message ? error.message : error) + ') — ' +
      'koi baat nahi: script apni nayi sheet bana kar usme likh legi. ' +
      'Apni sheet abhi banani ho to function `createOwnSheet` chalaiye (isi account me ban jayegi). ' +
      'Purani sheet me hi likhna ho to Sheet → Share → ' + (report.account || 'script ka account') + ' → Editor.',
    );
  }
  if (report.sheetAccess) {
    try {
      report.tabs = sheetCounts_().map(function (row) {
        return row.name + '(' + row.rows + ')';
      });
      report.settingsKeys = Object.keys(readSettings_()).length;
    } catch (error) {
      report.problems.push('Tabs/settings padhne me dikkat: ' + (error && error.message ? error.message : error) + ' → `setup` chalaiye');
    }
  }
  if (!report.tokenSet) report.problems.push('TOKEN default par hai — apna lamba token daal kar Vercel me bhi wahi daaliye');
  if (!report.problems.length) report.problems.push('koi problem nahi mili ✔');
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * Owner-facing functions ko saaf error ke saath chalane wala wrapper.
 *
 * Kyun: "You do not have permission to access the requested document" jaisi
 * Google ki error samajhna mushkil hoti hai. Ye wrapper usko seedha FIX me
 * badal deta hai — Apps Script ke **Execution log** me padhne layak.
 */
function guard_(name, fn) {
  try {
    return fn();
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    var fix = /permission|access|document/i.test(message)
      ? 'FIX: Sheet kholein → Share → ' + (executingEmail_() || 'jo account script chala raha hai') +
        ' → Editor → Send. (Script isi account se chal rahi hai, sheet doosre account ki hai.)'
      : 'Detail ke liye function `doctor` chalaiye (log me poora report aayega).';
    Logger.log('❌ ' + name + ' fail hua: ' + message);
    Logger.log('👉 ' + fix);
    try {
      book_().toast(name + ' fail: ' + fix, name, 10);
    } catch (ignored) {}
    throw new Error(name + ' fail: ' + message + ' — ' + fix);
  }
}

/**
 * Owner-facing functions ko saaf error ke saath chalane wala wrapper.
 *
 * Kyun: "You do not have permission to access the requested document" jaisi
 * Google ki error samajhna mushkil hoti hai. Ye wrapper usko seedha FIX me
 * badal deta hai — Apps Script ke **Execution log** me padhne layak.
 */
function guard_(name, fn) {
  try {
    return fn();
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    var fix = /permission|access|document/i.test(message)
      ? 'FIX: Sheet kholein → Share → ' + (executingEmail_() || 'jo account script chala raha hai') +
        ' → Editor → Send. (Script isi account se chal rahi hai, sheet doosre account ki hai.)'
      : 'Detail ke liye function `doctor` chalaiye (log me poora report aayega).';
    Logger.log('❌ ' + name + ' fail hua: ' + message);
    Logger.log('👉 ' + fix);
    try {
      book_().toast(name + ' fail: ' + fix, name, 10);
    } catch (ignored) {}
    throw new Error(name + ' fail: ' + message + ' — ' + fix);
  }
}

/** Naam ya gid se tab dhoondho; na mile to (khaali naam ke liye) bana do. */
function findSheet_(book, name) {
  var gid = GIDS[name];
  if (gid !== null && gid !== undefined && gid !== '') {
    var sheets = book.getSheets();
    for (var i = 0; i < sheets.length; i += 1) {
      if (sheets[i].getSheetId() === Number(gid)) return sheets[i];
    }
  }
  return book.getSheetByName(name);
}

/** Tab lo — na ho to headers ke saath bana do. */
function sheet_(name) {
  var book = book_();
  var sheet = findSheet_(book, name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    if (HEADERS[name]) {
      sheet.appendRow(HEADERS[name]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
      applyFormatting_(sheet, name);
    }
  }
  ensureHeaders_(sheet, name);
  return sheet;
}

/**
 * Header row ko sahi karo: purani sheet me kam columns hain to missing column
 * jod diye jaate hain — warna naye fields (jaise `Reason`) chup-chaap drop ho
 * jaate the aur owner ko "data nahi aaya" dikhta tha.
 */
function ensureHeaders_(sheet, name) {
  var headers = HEADERS[name];
  if (!headers) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    applyFormatting_(sheet, name);
    return;
  }
  var width = Math.max(1, sheet.getLastColumn());
  var current = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) {
    return String(value || '').trim();
  });
  var missing = headers.filter(function (header) {
    return current.indexOf(header) === -1;
  });
  if (missing.length) {
    sheet.getRange(1, width + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    applyFormatting_(sheet, name);
  }
}

/**
 * Column widths — owner ne kaha "columns fix kar do taaki manually kaam karne me
 * dikkat na ho". Har column ki fixed width (pixels) hai; lambe text wale columns
 * (Item details, Message, Review, Address) me wrap lagta hai, isliye kuch bhi
 * kata hua nahi dikhta.
 */
var COLUMN_WIDTHS = {
  Timestamp: 130, Event: 150, 'Order number': 120, 'Order status': 100,
  'Payment status': 105, 'Payment method': 95, 'Payment reference': 140,
  'UPI ID': 150, Total: 90, Subtotal: 90, Discount: 85, Coupon: 90,
  Items: 70, 'Item details': 260, Customer: 120, Phone: 105, Email: 165,
  Address: 230, City: 95, State: 100, Pincode: 80, 'Tracking courier': 110,
  AWB: 120, 'Tracking URL': 170, Notes: 200, Source: 90, Device: 90,
  'Verified by': 100, 'Verified at': 120, Product: 190, Handle: 140, SKU: 130,
  Size: 70, Colour: 90, Quantity: 70, Price: 90, 'Line total': 95,
  Category: 110, 'Image URL': 170, Status: 95, 'Invoice number': 120, Type: 70,
  GSTIN: 130, 'Taxable value': 105, CGST: 80, SGST: 80, IGST: 80, Shipping: 85,
  Courier: 110, 'Expected delivery': 110, 'Updated by': 100, Step: 90,
  Reason: 150, Session: 120, Name: 120, Subject: 130, Message: 320, Replied: 80,
  'Replied at': 120, 'Source page': 110, 'Message ID': 130, Rating: 65,
  Title: 150, Review: 300, Verified: 75, 'Photo URL': 150, Code: 100, Value: 70,
  'Min order': 85, 'Max uses': 75, Used: 60, Active: 60, Expires: 90,
  Note: 160, Stock: 65, Change: 65, 'Low stock alert': 95, Actor: 110,
  Action: 150, Target: 120, Details: 260, IP: 110, Context: 130,
  Payload: 260, Version: 70, Metric: 150, Direction: 110, Rows: 60,
  Detail: 180, Total: 90,
};

/**
 * Text columns — in par `@` (plain text) format lagta hai, warna phone/pincode
 * number ban jaate hain (aage ka 0 gayab, `303325` me se sort me gadbad) aur
 * owner ko manually dikkat hoti hai.
 */
var TEXT_COLUMNS = ['Phone', 'Pincode', 'AWB', 'Order number', 'Invoice number', 'SKU', 'Code', 'Message ID', 'GSTIN', 'UPI ID', 'Payment reference'];

/** Wrap wale columns (lambe text) */
var WRAP_COLUMNS = ['Item details', 'Notes', 'Message', 'Review', 'Address', 'Details', 'Payload', 'Note', 'Title'];

/** Money columns — in par ₹ format lagta hai (sirf naye tab banne par). */
var MONEY_COLUMNS = {
  Orders: ['Total', 'Subtotal', 'Discount'],
  Payments: ['Total', 'Subtotal', 'Discount'],
  OrderItems: ['Price', 'Line total'],
  Invoices: ['Taxable value', 'CGST', 'SGST', 'IGST', 'Shipping', 'Discount', 'Total'],
  Inventory: ['Stock'],
};

/**
 * Tab ki formatting — header bold + freeze, column widths fixed, wrap, ₹ format,
 * aur filter (dropdown) taaki owner manually sort/filter kar sake.
 */
function applyFormatting_(sheet, name) {
  try {
    var headers = HEADERS[name];
    if (!headers) return;
    // header row: bold + grey + freeze
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f1ece4');
    headerRange.setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
    if (sheet.getMaxColumns() > headers.length) {
      sheet.deleteColumns(headers.length + 1, sheet.getMaxColumns() - headers.length);
    }

    headers.forEach(function (column, index) {
      var width = COLUMN_WIDTHS[column] || 110;
      try {
        sheet.setColumnWidth(index + 1, width);
      } catch (ignored) {}
    });

    // filter (dropdown) — sirf ek hi baar
    try {
      if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(2, sheet.getLastRow()), headers.length).createFilter();
    } catch (ignored) {}

    // money + date formats (poori column)
    var rows = Math.max(2, sheet.getMaxRows());
    (MONEY_COLUMNS[name] || []).forEach(function (column) {
      var index = headers.indexOf(column);
      if (index >= 0) sheet.getRange(2, index + 1, rows - 1, 1).setNumberFormat(MONEY_FORMAT);
    });
    var stamp = headers.indexOf(TIMESTAMP_COLUMN);
    if (stamp >= 0) sheet.getRange(2, stamp + 1, rows - 1, 1).setNumberFormat('dd-MMM-yyyy HH:mm');

    // phone / pincode / AWB / order number — plain text (leading 0 aur bade number safe)
    TEXT_COLUMNS.forEach(function (column) {
      var index = headers.indexOf(column);
      if (index >= 0) sheet.getRange(2, index + 1, rows - 1, 1).setNumberFormat('@');
    });

    // lambe text wrap + top align (poori sheet ek hi call me — fast)
    var wrapRange = sheet.getRange(2, 1, rows - 1, headers.length);
    wrapRange.setWrapStrategy(SpreadsheetApp.WrapStrategy ? SpreadsheetApp.WrapStrategy.CLIP : 'clip');
    wrapRange.setVerticalAlignment('top');
    WRAP_COLUMNS.forEach(function (column) {
      var index = headers.indexOf(column);
      if (index >= 0) {
        sheet
          .getRange(2, index + 1, rows - 1, 1)
          .setWrapStrategy(SpreadsheetApp.WrapStrategy ? SpreadsheetApp.WrapStrategy.WRAP : 'wrap');
      }
    });
  } catch (error) {
    // formatting fail ho to data likhna nahi rukna chahiye
  }
}

/** Sabhi tabs par formatting dobara lagao (owner ka manual trigger `formatAll`) */
function formatAll() {
  return guard_('formatAll', function () {
    ['Settings'].concat(Object.keys(HEADERS)).forEach(function (name) {
      if (name === 'Settings') return;
      applyFormatting_(sheet_(name), name);
    });
    book_().toast('Columns ki width/format set ho gayi ✔', 'formatAll', 6);
    return true;
  });
}

/** Tab ke headers (trimmed) */
function headersOf_(sheet) {
  var width = Math.max(1, sheet.getLastColumn());
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) {
    return String(value || '').trim();
  });
}

/** Sheet ki saari values (header ke saath) */
function allValues_(sheet) {
  var last = sheet.getLastRow();
  if (last === 0) return [];
  var width = Math.max(1, sheet.getLastColumn());
  return sheet.getRange(1, 1, last, width).getValues();
}

/* ═══════════════════════════ 5. LOGGING / ERRORS ════════════════════════════ */

/** Error ko `Errors` tab me likho — debug ke liye (khud fail ho to chup raho). */
function logError_(context, error, payload) {
  try {
    var sheet = sheet_('Errors');
    var message = error && error.message ? error.message : String(error);
    sheet.appendRow([
      istNow_(),
      text_(context),
      text_(message).slice(0, 900),
      text_(payload ? JSON.stringify(payload) : '').slice(0, 900),
      CODE_VERSION,
    ]);
    trimTab_(sheet, ERRORS_KEEP);
  } catch (ignored) {
    Logger.log('logError_ failed: ' + context + ' — ' + error);
  }
}

/** Bahut badi tab ko limit tak kaato (purani rows delete). */
function trimTab_(sheet, keep) {
  try {
    var last = sheet.getLastRow();
    if (last <= keep) return;
    sheet.deleteRows(2, last - keep);
  } catch (ignored) {}
}

/** `Sync` tab me ek line — kya aaya, kitni rows likhi gayi. */
function noteSync_(direction, sheetName, rows, status, detail) {
  try {
    sheet_('Sync').appendRow([istNow_(), direction, sheetName || '-', rows || 0, status || 'ok', text_(detail)]);
  } catch (ignored) {}
}

/** Audit tab me admin/website ki activity */
function noteAudit_(actor, action, target, details) {
  try {
    sheet_('Audit').appendRow([istNow_(), text_(actor), text_(action), text_(target), text_(details), '']);
  } catch (ignored) {}
}

/* ═══════════════════════════ 6. ONE-TIME SETUP ══════════════════════════════ */

/**
 * Ek baar chalaiye — saare tabs, headers, formatting aur default settings bana
 * deta hai. Dobara chalane par purana data **nahi** mitta (sirf missing cheezein
 * add hoti hain).
 */
function setup() {
  return guard_('setup', setup_);
}

function setup_() {
  var created = [];
  Object.keys(HEADERS).forEach(function (name) {
    var before = findSheet_(book_(), name);
    sheet_(name);
    if (!before) created.push(name);
  });

  // Settings tab (key/value)
  var settings = sheet_('Settings');
  if (settings.getLastRow() === 0) {
    settings.appendRow(['key', 'value']);
    settings.setFrozenRows(1);
    settings.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  var existing = {};
  if (settings.getLastRow() > 1) {
    settings
      .getRange(2, 1, settings.getLastRow() - 1, 2)
      .getValues()
      .forEach(function (row) {
        existing[String(row[0]).trim().toLowerCase()] = true;
      });
  }
  DEFAULT_SETTINGS.forEach(function (entry) {
    if (!existing[entry[0]]) settings.appendRow(entry);
  });

  refreshDashboard_();
  noteSync_('script', 'setup', created.length, 'ok', 'tabs: ' + created.join(', '));
  try {
    book_().toast('Liksha sheets ready ✔ (' + Object.keys(HEADERS).length + ' tabs)', 'setup', 6);
  } catch (ignored) {}
  Logger.log('setup done. naye tabs: ' + (created.join(', ') || 'koi nahi'));
  Logger.log('ab: Deploy → Manage deployments → ✏️ → New version → Deploy');
  return created;
}

/** Owner ke liye — kabhi header toot jaye to dobara theek kar deta hai. */
function repairHeaders() {
  return guard_('repairHeaders', repairHeaders_);
}

function repairHeaders_() {
  var fixed = [];
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = sheet_(name);
    var before = headersOf_(sheet).join('|');
    ensureHeaders_(sheet, name);
    if (headersOf_(sheet).join('|') !== before) fixed.push(name);
  });
  book_().toast('Headers check ho gaye ✔ (' + (fixed.length ? fixed.join(', ') : 'sab sahi') + ')', 'repair', 6);
  return fixed;
}

/**
 * Migrate — purane/naye sab tabs ka header sahi karta hai, Settings ki missing
 * keys add karta hai, aur Dashboard bhar deta hai. `setup()` ise khud call karta
 * hai, isliye alag chalane ki zaroorat nahi.
 */
function migrate() {
  return guard_('migrate', function () {
    return { headers: repairHeaders_(), dashboard: refreshDashboard_() };
  });
}

/* ═══════════════════════════ 7. SETTINGS ════════════════════════════════════ */

/** Settings tab: key/value rows → object (website isse padhti hai). */
function readSettings_() {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 0; i < values.length; i += 1) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    var raw = values[i][1];
    var value = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!key || !value) continue;
    if (key === 'key' || key === 'store' || key === 'admin' || key === 'preview') continue;
    out[key] = value;
  }
  // website in dono naam se bhi padh sakti hai
  if (out.whatsapp && !out.whatsapp_number) out.whatsapp_number = out.whatsapp;
  if (out.support_phone && !out.phone) out.phone = out.support_phone;
  return out;
}

/** Settings tab me values likho (purani key update, nayi key add). */
function writeSettings_(settings) {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 0; i < values.length; i += 1) {
    index[String(values[i][0] || '').trim().toLowerCase()] = i + 1;
  }
  var written = 0;
  Object.keys(settings || {}).forEach(function (key) {
    var cleanKey = String(key).trim().toLowerCase();
    if (!cleanKey || cleanKey === 'key') return;
    var value = settings[key];
    if (value === undefined || value === null) return;
    var cell = typeof value === 'boolean' ? (value ? 'true' : 'false') : text_(value);
    if (index[cleanKey]) sheet.getRange(index[cleanKey], 2).setValue(cell);
    else sheet.appendRow([cleanKey, cell]);
    written += 1;
  });
  return written;
}

/* ═══════════════════════════ 8. READ HELPERS ════════════════════════════════ */

/** Last N rows, header ke naam par object bana kar (latest pehle). */
function recentRows_(name, limit) {
  if (!HEADERS[name]) return [];
  var sheet = sheet_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var headers = headersOf_(sheet);
  var start = Math.max(2, last - limit + 1);
  var values = sheet.getRange(start, 1, last - start + 1, headers.length).getValues();
  return values.reverse().map(function (row) {
    var object = {};
    for (var i = 0; i < headers.length; i += 1) {
      object[headers[i]] = row[i] === null || row[i] === undefined ? '' : row[i];
    }
    return object;
  });
}

/** Kisi ek column me value dhoondho (order number, email, coupon code…) */
function findRows_(name, column, value, limit) {
  if (!HEADERS[name]) return [];
  var sheet = sheet_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var headers = headersOf_(sheet);
  var index = headers.indexOf(column);
  if (index < 0) return [];
  var from = Math.max(2, last - 4000 + 1); // bahut badi sheet me poori scan na kare
  var values = sheet.getRange(from, 1, last - from + 1, headers.length).getValues();
  var needle = String(value).trim().toLowerCase();
  var out = [];
  for (var i = values.length - 1; i >= 0 && out.length < (limit || 50); i -= 1) {
    if (String(values[i][index]).trim().toLowerCase() === needle) {
      var object = {};
      for (var c = 0; c < headers.length; c += 1) {
        object[headers[c]] = values[i][c] === null || values[i][c] === undefined ? '' : values[i][c];
      }
      out.push(object);
    }
  }
  return out;
}

/** Ek order ki poori kahani — Orders + Items + Payments + Shipments + Invoices. */
function orderStory_(orderNumber) {
  var wanted = String(orderNumber || '').trim();
  if (!wanted) return null;
  var sheets = ['Orders', 'OrderItems', 'Payments', 'Shipments', 'Invoices'];
  var story = { orderNumber: wanted, rows: {} };
  var found = false;
  sheets.forEach(function (name) {
    var rows = findRows_(name, 'Order number', wanted, 40);
    story.rows[name] = rows;
    if (rows.length) found = true;
  });
  return found ? story : null;
}

/** Har tab kitni rows — health/stats me (Settings sabse pehle). */
function sheetCounts_() {
  var names = ['Settings'].concat(Object.keys(HEADERS));
  return names.map(function (name) {
    var sheet = sheet_(name);
    return { name: name, tab: sheet.getName(), rows: Math.max(0, sheet.getLastRow() - 1) };
  });
}

/** Aaj kitne orders/events aaye (Orders tab ke Timestamp se) */
function todaysCount_(rows) {
  var today = todayKey_();
  var count = 0;
  (rows || []).forEach(function (row) {
    var stamp = String(row.Timestamp || '');
    if (stamp.indexOf(today) === 0 || stamp.indexOf(today.slice(8, 10) + '-' + today.slice(5, 7)) === 0) count += 1;
  });
  return count;
}

/* ═══════════════════════════ 9. STATS / DASHBOARD ═══════════════════════════ */

/**
 * Poora business snapshot — website ke `/api/sheet-selftest` aur admin panel
 * dono ise use karte hain. Har value sheet se **live** aati hai.
 */
function stats_() {
  var orders = recentRows_('Orders', 500);
  var paid = 0;
  var pending = 0;
  var revenue = 0;
  var todayOrders = 0;
  var today = todayKey_();
  var seenOrders = {};

  orders.forEach(function (row) {
    var number = String(row['Order number'] || '').trim();
    var isToday = String(row.Timestamp || '').indexOf(today) === 0 ||
      String(row.Timestamp || '').indexOf(today.slice(8, 10) + '-' + today.slice(5, 7)) === 0;
    if (isToday && String(row.Event || '').indexOf('order.') === 0) todayOrders += 1;
    if (!number) return;
    // har order ki latest row hi final status maani jaati hai (timeline append-only hai)
    if (seenOrders[number]) return;
    seenOrders[number] = true;
    var status = String(row['Payment status'] || '').toLowerCase();
    if (status === 'paid' || status === 'verified' || status === 'success') {
      paid += 1;
      revenue += num_(row.Total);
    } else {
      pending += 1;
    }
  });

  var messages = recentRows_('Messages', 200);
  var newMessages = messages.filter(function (row) {
    var status = String(row.Status || '').toLowerCase();
    return !status || status === 'new' || status === 'unread';
  }).length;

  var newsletter = sheet_('Newsletter');
  var reviews = recentRows_('Reviews', 200);
  var pendingReviews = reviews.filter(function (row) {
    return String(row.Status || '').toLowerCase() === 'pending';
  }).length;

  return {
    time: now_(),
    today: today,
    orders: { totalEvents: orders.length, today: todayOrders, paid: paid, pending: pending, revenue: revenue },
    messages: { total: messages.length, new: newMessages },
    newsletter: { total: Math.max(0, newsletter.getLastRow() - 1) },
    reviews: { total: reviews.length, pending: pendingReviews },
    sheets: sheetCounts_(),
  };
}

/** Dashboard tab ko refresh karo (8 metrics, latest snapshot). */
function refreshDashboard_() {
  try {
    var stats = stats_();
    var sheet = sheet_('Dashboard');
    var rows = [
      ['Orders (total)', stats.orders.paid + stats.orders.pending, 'paid + pending orders'],
      ['Orders (today)', stats.orders.today, 'IST ' + stats.today],
      ['Revenue (paid)', stats.orders.revenue, '₹ (paid orders ka total)'],
      ['Pending payment', stats.orders.pending, 'payment pending orders'],
      ['Messages (new)', stats.messages.new, 'contact form'],
      ['Newsletter subscribers', stats.newsletter.total, 'footer signup'],
      ['Reviews (pending)', stats.reviews.pending, 'approve karna baaki'],
      ['Low stock SKUs', lowStock_(), 'inventory tab se'],
    ];
    if (typeof sheet.clearContents === 'function') sheet.clearContents();
    ensureHeaders_(sheet, 'Dashboard');
    var values = rows.map(function (row) {
      return [istNow_(), row[0], row[1], row[2]];
    });
    sheet.getRange(2, 1, values.length, 4).setValues(values);
    return rows.length;
  } catch (error) {
    logError_('refreshDashboard_', error, null);
    return null;
  }
}

/** Inventory tab se low stock kitne hain (latest row per SKU) */
function lowStock_() {
  try {
    var rows = recentRows_('Inventory', 500);
    var latest = {};
    rows.forEach(function (row) {
      var key = String(row.SKU || row.Handle || '') + '|' + String(row.Size || '');
      if (key !== '|' && latest[key] === undefined) latest[key] = num_(row.Stock);
    });
    var low = 0;
    Object.keys(latest).forEach(function (key) {
      if (latest[key] <= 3) low += 1;
    });
    return low;
  } catch (error) {
    return 0;
  }
}

/* ═══════════════════════════ 10. WRITE HELPERS ══════════════════════════════ */

/** Ek cell ki value ready karo — undefined/null khaali, text saaf, number number. */
function cell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value instanceof Date) return value;
  return text_(value);
}

/**
 * Rows append — header **naam** se column dhoondha jaata hai, isliye column ka
 * order badalne ya beech me naya column jodne se data galat jagah nahi jaata.
 *
 * Speed: ek sheet ki saari rows ek hi `setValues` call me likhi jaati hain
 * (`appendRow` ek-ek karke likhta hai — 20 rows me ~10x slow).
 */
function appendRows_(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  var written = 0;
  var skipped = 0;
  try {
    var bySheet = {};
    var order = [];
    (rows || []).forEach(function (entry) {
      var name = String((entry && entry.sheet) || 'Orders');
      if (!HEADERS[name]) {
        skipped += 1;
        return;
      }
      if (!bySheet[name]) {
        bySheet[name] = [];
        order.push(name);
      }
      bySheet[name].push((entry && entry.row) || {});
    });

    order.forEach(function (name) {
      var sheet = sheet_(name);
      var headers = headersOf_(sheet);
      var values = bySheet[name].map(function (row) {
        return headers.map(function (column) {
          return cell_(row[column]);
        });
      });
      if (!values.length) return;
      var start = Math.max(2, sheet.getLastRow() + 1);
      sheet.getRange(start, 1, values.length, headers.length).setValues(values);
      written += values.length;
    });
  } catch (error) {
    logError_('appendRows_', error, { count: (rows || []).length });
    throw error;
  } finally {
    lock.releaseLock();
  }
  if (skipped) Logger.log('appendRows_: ' + skipped + ' rows ka sheet naam anjaan tha');
  return written;
}

/** Ek column me value update karo (pehli matching row) — messages/coupons ke liye. */
function updateWhere_(sheetName, keyColumn, keyValue, updates) {
  var sheet = sheet_(sheetName);
  var headers = headersOf_(sheet);
  var keyIndex = headers.indexOf(keyColumn);
  if (keyIndex < 0) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  var needle = String(keyValue).trim().toLowerCase();
  var updated = 0;
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][keyIndex]).trim().toLowerCase() !== needle) continue;
    Object.keys(updates).forEach(function (column) {
      var index = headers.indexOf(column);
      if (index >= 0) sheet.getRange(i + 2, index + 1).setValue(cell_(updates[column]));
    });
    updated += 1;
    break; // pehli matching row kaafi hai
  }
  return updated;
}

/** Newsletter — duplicate email skip */
function subscribe_(email, source) {
  var clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.indexOf('@') < 0) return { ok: false, error: 'invalid email' };
  var existing = findRows_('Newsletter', 'Email', clean, 1);
  if (existing.length) return { ok: true, duplicate: true, written: 0 };
  var written = appendRows_([
    { sheet: 'Newsletter', row: { Timestamp: istNow_(), Email: clean, Source: source || 'website', Status: 'subscribed' } },
  ]);
  return { ok: true, duplicate: false, written: written };
}

/** Review — same product + same customer + same text dobara na aaye */
function addReview_(body) {
  var product = text_(body.product || body.handle || '');
  var customer = text_(body.customer || body.name || '');
  var review = text_(body.review || body.message || '');
  var key = hash_(product + '|' + customer + '|' + review);
  var sheet = sheet_('Reviews');
  var headers = headersOf_(sheet);
  var last = sheet.getLastRow();
  if (last > 1) {
    // last 500 rows me hi check (bahut badi sheet me slow na ho)
    var from = Math.max(2, last - 500 + 1);
    var values = sheet.getRange(from, 1, last - from + 1, headers.length).getValues();
    var productIndex = headers.indexOf('Product');
    var customerIndex = headers.indexOf('Customer');
    var reviewIndex = headers.indexOf('Review');
    for (var i = values.length - 1; i >= 0; i -= 1) {
      var existingKey = hash_(
        String(values[i][productIndex]) + '|' + String(values[i][customerIndex]) + '|' + String(values[i][reviewIndex]),
      );
      if (existingKey === key) return { ok: true, duplicate: true, written: 0 };
    }
  }
  var written = appendRows_([
    {
      sheet: 'Reviews',
      row: {
        Timestamp: istNow_(),
        Product: product,
        Handle: text_(body.handle || ''),
        Customer: customer,
        Rating: num_(body.rating),
        Title: text_(body.title || ''),
        Review: review,
        Verified: truthy_(body.verified) ? 'yes' : 'no',
        Status: text_(body.status || 'pending'),
        'Photo URL': text_(body.photo || ''),
        'Order number': text_(body.orderNumber || ''),
      },
    },
  ]);
  return { ok: true, duplicate: false, written: written };
}

/** Coupon — naya ho to add, purana ho to update (code unique) */
function upsertCoupon_(body) {
  var code = String(body.code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'code chahiye' };
  var row = {
    Timestamp: istNow_(),
    Code: code,
    Type: text_(body.type || 'percent'),
    Value: num_(body.value),
    'Min order': num_(body.minOrder),
    'Max uses': num_(body.maxUses),
    Used: num_(body.used),
    Active: truthy_(body.active === undefined ? true : body.active) ? 'yes' : 'no',
    Expires: text_(body.expires || ''),
    Note: text_(body.note || ''),
  };
  var existing = findRows_('Coupons', 'Code', code, 1);
  if (existing.length) {
    updateWhere_('Coupons', 'Code', code, row);
    return { ok: true, updated: true, written: 0 };
  }
  return { ok: true, updated: false, written: appendRows_([{ sheet: 'Coupons', row: row }]) };
}

/** Order status / tracking change — timeline + shipments dono me */
function orderUpdate_(body) {
  var number = String(body.orderNumber || '').trim();
  if (!number) return { ok: false, error: 'orderNumber chahiye' };
  var event = text_(body.event || 'order.updated');
  var rows = [
    {
      sheet: 'Orders',
      row: {
        Timestamp: istNow_(),
        Event: event,
        'Order number': number,
        'Order status': text_(body.status || ''),
        'Payment status': text_(body.paymentStatus || ''),
        'Tracking courier': text_(body.courier || ''),
        AWB: text_(body.awb || ''),
        'Tracking URL': text_(body.trackingUrl || ''),
        Notes: text_(body.note || ''),
        Source: 'admin',
      },
    },
  ];
  if (body.courier || body.awb || body.trackingUrl) {
    rows.push({
      sheet: 'Shipments',
      row: {
        Timestamp: istNow_(),
        'Order number': number,
        Courier: text_(body.courier || ''),
        AWB: text_(body.awb || ''),
        'Tracking URL': text_(body.trackingUrl || ''),
        Status: text_(body.status || 'shipped'),
        'Expected delivery': text_(body.expected || ''),
        Note: text_(body.note || ''),
        'Updated by': text_(body.actor || 'admin'),
      },
    });
  }
  if (body.paymentStatus) {
    rows.push({
      sheet: 'Payments',
      row: {
        Timestamp: istNow_(),
        Event: event,
        'Order number': number,
        'Payment status': text_(body.paymentStatus),
        'Payment reference': text_(body.reference || ''),
        'Verified by': text_(body.actor || 'admin'),
        'Verified at': istNow_(),
      },
    });
  }
  return { ok: true, written: appendRows_(rows) };
}

/** GST invoice row */
function saveInvoice_(body) {
  var number = String(body.invoiceNumber || body.number || '').trim();
  if (!number) return { ok: false, error: 'invoiceNumber chahiye' };
  var written = appendRows_([
    {
      sheet: 'Invoices',
      row: {
        Timestamp: istNow_(),
        'Invoice number': number,
        'Order number': text_(body.orderNumber || ''),
        Type: text_(body.type || 'gst'),
        Customer: text_(body.customer || body.name || ''),
        Phone: text_(body.phone || ''),
        Email: text_(body.email || ''),
        GSTIN: text_(body.gstin || ''),
        Address: text_(body.address || ''),
        State: text_(body.state || ''),
        'Taxable value': num_(body.taxable),
        CGST: num_(body.cgst),
        SGST: num_(body.sgst),
        IGST: num_(body.igst),
        Shipping: num_(body.shipping),
        Discount: num_(body.discount),
        Total: num_(body.total),
        Notes: text_(body.notes || ''),
      },
    },
  ]);
  return { ok: true, written: written };
}

/** Inventory change (stock +1 / -2, reason ke saath) */
function stockUpdate_(body) {
  var handle = text_(body.handle || body.sku || '');
  if (!handle) return { ok: false, error: 'handle/sku chahiye' };
  var stock = num_(body.stock);
  var written = appendRows_([
    {
      sheet: 'Inventory',
      row: {
        Timestamp: istNow_(),
        Product: text_(body.product || ''),
        Handle: handle,
        SKU: text_(body.sku || ''),
        Size: text_(body.size || ''),
        Stock: stock,
        Change: num_(body.change),
        Reason: text_(body.reason || 'manual update'),
        'Updated by': text_(body.actor || 'admin'),
        'Low stock alert': stock <= 3 ? 'yes' : 'no',
      },
    },
  ]);
  return { ok: true, written: written };
}

/* ═══════════════════════════ 11. SELF-TEST (owner ke liye) ══════════════════ */

/**
 * Extensions → Apps Script → function `testAppend` → Run.
 * Do test rows likhta hai (Orders + Checkout) taaki owner ko turant dikhe ki
 * likhna kaam kar raha hai. Baad me in rows ko delete kar sakte hain.
 */
function testAppend() {
  return guard_('testAppend', testAppend_);
}

function testAppend_() {
  var stamp = istNow_();
  var written = appendRows_([
    {
      sheet: 'Orders',
      row: {
        Timestamp: stamp,
        Event: 'test.from_apps_script',
        'Order number': 'LK-TEST-' + Math.floor(Math.random() * 9000 + 1000),
        'Order status': 'test',
        'Payment status': 'pending',
        Customer: 'Apps Script test',
        Total: 499,
        Notes: 'test row — delete kar sakte hain',
        Source: 'apps-script',
      },
    },
    {
      sheet: 'Checkout',
      row: {
        Timestamp: stamp,
        Event: 'checkout.test',
        Step: 'test',
        Items: 1,
        Subtotal: 499,
        Reason: 'apps-script self test',
      },
    },
  ]);
  Logger.log('rows written: ' + written);
  book_().toast('Test rows likh diye (' + written + ') ✔', 'testAppend', 6);
  return written;
}

/**
 * `testSelf` — poora check: kaun si sheet khul rahi hai, kitne tabs/rows, settings
 * padhi ja rahi hain ya nahi, aur write chal raha hai ya nahi. Log me dikhta hai.
 */
function testSelf() {
  return guard_('testSelf', testSelf_);
}

function testSelf_() {
  var report = { version: CODE_VERSION, time: now_(), checks: [] };
  function check(name, fn) {
    try {
      var value = fn();
      report.checks.push({ name: name, ok: true, value: value });
    } catch (error) {
      report.checks.push({ name: name, ok: false, error: String(error && error.message ? error.message : error) });
    }
  }

  check('sheet khul rahi hai', function () {
    return { name: book_().getName(), id: book_().getId() };
  });
  check('tabs', function () {
    return sheetCounts_().map(function (row) {
      return row.name + ':' + row.rows;
    });
  });
  check('settings padhi ja rahi hain', function () {
    var settings = readSettings_();
    return { keys: Object.keys(settings).length, whatsapp: settings.whatsapp || '', upi_id: settings.upi_id || '' };
  });
  check('write chal raha hai', function () {
    return appendRows_([
      { sheet: 'Audit', row: { Timestamp: istNow_(), Actor: 'testSelf', Action: 'self_test', Target: CODE_VERSION, Details: 'ok' } },
    ]);
  });

  Logger.log(JSON.stringify(report, null, 2));
  book_().toast('Self test: ' + report.checks.filter(function (c) { return c.ok; }).length + '/' + report.checks.length + ' pass', 'testSelf', 6);
  return report;
}

/**
 * Sheet ki backup (Drive me copy). Trigger se hafte me ek baar chalti hai.
 * Folder na mile to Drive ke root me copy banti hai.
 */
function backupNow() {
  return guard_('backupNow', backupNow_);
}

function backupNow_() {
  try {
    var book = book_();
    var name = 'Liksha backup ' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HHmm');
    var file = DriveApp.getFileById(book.getId());
    var copy = file.makeCopy(name);
    Logger.log('backup ban gaya: ' + copy.getUrl());
    noteSync_('script', 'backup', 1, 'ok', name);
    return copy.getUrl();
  } catch (error) {
    logError_('backupNow', error, null);
    return 'backup fail: ' + (error && error.message ? error.message : error);
  }
}

/** Daily dashboard refresh + weekly backup ke triggers laga do (ek hi baar). */
function installTriggers() {
  return guard_('installTriggers', installTriggers_);
}

function installTriggers_() {
  var existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'dailyRefresh' || handler === 'weeklyBackup') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('dailyRefresh').timeBased().atHour(21).everyDays(1).create();
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
  book_().toast('Daily 9 PM dashboard + Sunday 2 AM backup triggers lag gaye ✔', 'installTriggers', 6);
  return true;
}

/** Trigger se chalta hai — Dashboard refresh + Sync note */
function dailyRefresh() {
  return guard_('dailyRefresh', function () {
    var rows = refreshDashboard_();
    noteSync_('script', 'Dashboard', rows || 0, 'ok', 'daily refresh');
    return rows;
  });
}

/** Trigger se chalta hai — hafte me ek backup */
function weeklyBackup() {
  return backupNow();
}

/** Zaroorat pade to triggers hata do */
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'dailyRefresh' || handler === 'weeklyBackup') ScriptApp.deleteTrigger(trigger);
  });
  return true;
}

/* ═══════════════════════════ 12. HTTP API — doGet ═══════════════════════════ */

/**
 * GET endpoints (sab token ke saath):
 *   ?action=health      → version, sheet ka naam, har tab kitni rows
 *   ?action=ping        → halka jawab (uptime check)
 *   ?action=version     → sirf code version
 *   ?action=settings    → Settings tab ka key/value (default action)
 *   ?action=recent&sheet=Orders&limit=20
 *   ?action=rows&sheet=Messages&limit=50
 *   ?action=search&sheet=Orders&column=Order+number&value=LK-1234
 *   ?action=order&orderNumber=LK-1234   → poora order (items+payments+shipments+invoices)
 *   ?action=stats       → aaj ke orders, revenue, pending, messages
 *   ?action=dashboard   → stats + Dashboard tab refresh
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  if (TOKEN && String(params.token || '') !== TOKEN) {
    return json_({ ok: false, version: CODE_VERSION, error: 'unauthorized — token match nahi hua' });
  }
  var action = params.action || 'settings';

  try {
    if (action === 'settings') {
      return json_({ ok: true, version: CODE_VERSION, settings: readSettings_(), time: now_() });
    }

    if (action === 'version') {
      return json_({ ok: true, version: CODE_VERSION, time: now_() });
    }

    if (action === 'ping') {
      return json_({ ok: true, pong: true, version: CODE_VERSION, time: now_() });
    }

    if (action === 'recent' || action === 'rows' || action === 'sheet') {
      var name = String(params.sheet || 'Orders');
      var limit = Math.min(200, Math.max(1, Number(params.limit || 20)));
      if (!HEADERS[name]) return json_({ ok: false, error: 'unknown sheet: ' + name });
      return json_({ ok: true, sheet: name, rows: recentRows_(name, limit), time: now_() });
    }

    if (action === 'search') {
      var searchSheet = String(params.sheet || 'Orders');
      var column = String(params.column || 'Order number');
      var value = String(params.value || params.q || '');
      if (!HEADERS[searchSheet]) return json_({ ok: false, error: 'unknown sheet: ' + searchSheet });
      if (!value) return json_({ ok: false, error: 'value chahiye' });
      return json_({
        ok: true,
        sheet: searchSheet,
        column: column,
        rows: findRows_(searchSheet, column, value, Math.min(100, Number(params.limit || 20))),
      });
    }

    if (action === 'order') {
      var story = orderStory_(params.orderNumber || params.order || '');
      if (!story) return json_({ ok: false, error: 'order nahi mila' });
      return json_({ ok: true, order: story });
    }

    if (action === 'stats') {
      return json_({ ok: true, stats: stats_() });
    }

    if (action === 'dashboard') {
      var rows = refreshDashboard_();
      return json_({ ok: true, dashboardRows: rows, stats: stats_() });
    }

    if (action === 'health') {
      var book = book_();
      return json_({
        ok: true,
        version: CODE_VERSION,
        codeVersion: CODE_VERSION,
        time: now_(),
        timezone: TIMEZONE,
        spreadsheet: book.getName(),
        spreadsheetId: book.getId(),
        spreadsheetUrl: book.getUrl(),
        sheets: sheetCounts_(),
        settingsKeys: Object.keys(readSettings_()).length,
      });
    }

    return json_({ ok: false, error: 'unknown action: ' + action });
  } catch (error) {
    logError_('doGet/' + action, error, params);
    var getMessage = String(error && error.message ? error.message : error);
    return json_({
      ok: false,
      version: CODE_VERSION,
      error: getMessage,
      hint: /permission|access/i.test(getMessage)
        ? 'Sheet → Share → ' + (executingEmail_() || 'script ka account') + ' → Editor. Phir `setup` Run kariye.'
        : undefined,
    });
  }
}

/* ═══════════════════════════ 13. HTTP API — doPost ══════════════════════════ */

/**
 * POST body (JSON, token har call me):
 *   { token, action: "append",  rows: [{ sheet, row }] }        ← website ka main raasta
 *   { token, action: "settings_save", settings: {…} }           ← admin panel
 *   { token, action: "order_update", orderNumber, status, courier, awb, trackingUrl, note }
 *   { token, action: "invoice_save", invoiceNumber, orderNumber, taxable, cgst, sgst, igst, total }
 *   { token, action: "stock_update", handle, size, stock, change, reason }
 *   { token, action: "coupon_save", code, type, value, minOrder, maxUses, active }
 *   { token, action: "review_add", product, handle, customer, rating, review, verified }
 *   { token, action: "subscribe", email }
 *   { token, action: "message_status", id, status: "replied" | "handled" }
 *   { token, action: "dashboard" }   { token, action: "setup" }   { token, action: "repair" }
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return json_({ ok: false, version: CODE_VERSION, error: 'invalid json' });
  }
  if (TOKEN && String(body.token || '') !== TOKEN) {
    return json_({ ok: false, version: CODE_VERSION, error: 'unauthorized — token match nahi hua' });
  }

  var action = String(body.action || '');
  try {
    if (action === 'append' || action === 'appendMany') {
      var rows = Array.isArray(body.rows) ? body.rows : body.row ? [{ sheet: body.sheet, row: body.row }] : [];
      if (!rows.length) return json_({ ok: false, error: 'no rows' });
      if (rows.length > MAX_ROWS_PER_CALL) rows = rows.slice(0, MAX_ROWS_PER_CALL);
      var written = appendRows_(rows);
      var sheetNames = {};
      rows.forEach(function (row) {
        sheetNames[row.sheet || 'Orders'] = true;
      });
      noteSync_('website→sheet', Object.keys(sheetNames).join(','), written, 'ok', '');
      return json_({ ok: true, written: written, time: now_() });
    }

    if (action === 'settings_save') {
      var count = writeSettings_(body.settings || {});
      noteAudit_(body.actor || 'admin', 'settings_save', 'Settings', String(count) + ' keys');
      return json_({ ok: true, written: count, settings: readSettings_() });
    }

    if (action === 'order_update') {
      var result = orderUpdate_(body);
      if (result.ok) noteAudit_(body.actor || 'admin', 'order_update', body.orderNumber || '', body.event || '');
      return json_(result);
    }

    if (action === 'invoice_save') {
      var invoice = saveInvoice_(body);
      if (invoice.ok) noteAudit_(body.actor || 'admin', 'invoice_save', body.invoiceNumber || '', body.orderNumber || '');
      return json_(invoice);
    }

    if (action === 'stock_update') {
      var stock = stockUpdate_(body);
      if (stock.ok) refreshDashboard_();
      return json_(stock);
    }

    if (action === 'coupon_save') {
      return json_(upsertCoupon_(body));
    }

    if (action === 'review_add') {
      var review = addReview_(body);
      if (review.ok) refreshDashboard_();
      return json_(review);
    }

    if (action === 'subscribe') {
      return json_(subscribe_(body.email, body.source));
    }

    if (action === 'message_status') {
      var id = String(body.id || '').trim();
      if (!id) return json_({ ok: false, error: 'id chahiye' });
      var status = String(body.status || 'replied').toLowerCase();
      var updated = updateWhere_('Messages', 'Message ID', id, {
        Status: status,
        Replied: status === 'replied' ? 'yes' : 'no',
        'Replied at': status === 'replied' ? istNow_() : '',
      });
      return json_({ ok: updated > 0, updated: updated });
    }

    if (action === 'dashboard') {
      var dashboardRows = refreshDashboard_();
      return json_({ ok: true, dashboardRows: dashboardRows, stats: stats_() });
    }

    if (action === 'setup') {
      var created = setup();
      return json_({ ok: true, version: CODE_VERSION, created: created });
    }

    if (action === 'repair') {
      return json_({ ok: true, fixed: repairHeaders() });
    }

    if (action === 'test') {
      return json_({ ok: true, written: testAppend() });
    }

    return json_({ ok: false, error: 'unknown action: ' + action });
  } catch (error) {
    logError_('doPost/' + action, error, { action: action });
    var postMessage = String(error && error.message ? error.message : error);
    return json_({
      ok: false,
      version: CODE_VERSION,
      error: postMessage,
      hint: /permission|access/i.test(postMessage)
        ? 'Sheet → Share → ' + (executingEmail_() || 'script ka account') + ' → Editor. Phir `setup` Run kariye.'
        : undefined,
    });
  }
}

/* ═══════════════════════════ 14. OWNER CHEAT-SHEET ══════════════════════════
 *
 * Sheet me kabhi kuch toot jaye to:
 *   • `createOwnSheet` → isi account me **nayi sheet** banao aur website wahi use kare
 *   • `formatAll`    → columns ki width/format dobara set karo (manually kaam karne me aasan)
 *   • `whoAmI`       → kaun sa Google account chal raha hai + sheet mil rahi hai?
 *   • `doctor`       → poora health check (permission error me sabse pehle yahi)
 *   • `testSelf`     → poora check, log me jawab
 *   • `setup`        → missing tabs/headers/settings add
 *   • `repairHeaders`→ sirf header repair
 *   • `testAppend`   → 2 test rows
 *   • `refreshDashboard` ke liye `dailyRefresh` ya `?action=dashboard`
 *   • `backupNow`    → Drive me copy
 *   • `installTriggers` → daily 9 PM dashboard + Sunday backup
 *
 * Websity se check: <webapp URL>?action=health&token=<TOKEN>
 * Kuch bhi "purana" lag raha ho to: Deploy → Manage deployments → ✏️ →
 * Version: **New version** → Deploy. (Sirf Ctrl+S kaafi nahi hota.)
 * ═════════════════════════════════════════════════════════════════════════════ */
```
