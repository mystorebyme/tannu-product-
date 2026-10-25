# Apps Script — poora code (copy-paste)

> Ye file `scripts/google-apps-script/liksha-sheets.gs` se **automatic** bani hai
> (`node scripts/export-apps-script.mjs`). Yahan se copy kariye, code hamesha latest rahega.

**Kya karta hai:** website ke sab events Google Sheet me likhta hai —

| Tab | Kya aata hai |
| --- | --- |
| **Settings** | phone, WhatsApp, email, UPI ID, UPI name, announcement, free shipping, GSTIN |
| **Orders** | har order + har status change (append-only timeline) |
| **Payments** | UTR submit, "payment hui hai" claim, verify, fail, reverse |
| **Checkout** | funnel: checkout khula → review → order placed → order fail (reason ke saath) |
| **Messages** | contact form |
| **Newsletter** | email subscribers |
| **Audit** | self-check / manual entries |

---

## Steps (ek baar, ~5 minute)

1. Google Sheet kholein → **Extensions → Apps Script**.
2. `Code.gs` ka default code poora delete kariye → neeche wala **poora code** paste kariye.
3. Sabse upar `var TOKEN = 'CHANGE-ME-liksha-token';` me apna lamba random word daaliye
   (jaise `liksha-9f3k2m-r23`). **Yahi token Vercel me daalna hai** — yaad rakhein.
4. **Ctrl+S** (save).
5. Editor me upar function dropdown → **`setup`** → **Run** → permission maange to
   **Review permissions → apna account → Advanced → Go to … (unsafe) → Allow**.
   Sheet me 7 tab ban jayenge.
6. **Deploy → New deployment → (cog) Web app**
   - Description: `liksha v2`
   - **Execute as: Me**
   - **Who has access: Anyone**
   - **Deploy** → **Web app URL** copy kariye (`.../exec` par khatam hota hai).
7. Test: browser me
   `<Web app URL>?action=health&token=<TOKEN>`
   → `{"ok":true,"version":2,"spreadsheet":"…","sheets":[…]}` aana chahiye.
   Phir editor me function **`testAppend`** → **Run** → Orders + Checkout tab me test row.
8. **Mujhe 2 value bhej dijiye:** Web app URL + TOKEN. Main Vercel
   (`liksha-clothing` → Settings → Environment Variables) me daal kar redeploy kar dunga:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_SHEETS_WEBAPP_URL` | aapka `/exec` URL |
   | `GOOGLE_SHEETS_TOKEN` | aapka token |
   | *(optional)* `GOOGLE_SHEETS_SETTINGS_CSV_URL` | Settings tab ka published CSV link |

9. Verify (main ya aap): `node scripts/sheets-selfcheck.mjs "<URL>" "<TOKEN>"`

---

## Code badalne par (yaad rakhiye)

Apps Script me code update karne ke baad **naya version deploy** karna padta hai:
**Deploy → Manage deployments → (pencil) Edit → Version: New version → Deploy**.
Warna purana code hi chalta rehta hai.

## Sheet ke rules

- **Header row (pehli row) na hataayein.** Script column ko **naam** se dhoondhta hai,
  isliye column ka order badalna theek hai; header ka naam badalna/hatana nahi.
- Naya column add karna theek hai (script khud bhi missing column add kar deta hai).
- `Who has access: Anyone` rakhein — website anonymous request bhejti hai. Data safe hai
  kyunki token ke bina script kuch read/write nahi karta.

---

## Poora code (412 lines)

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIKSHA / DESIGNER CLOTHING — Google Sheet ↔ website bridge  (Apps Script v2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Owner ne sheet account badal diya — ye script **naye sheet** ke liye hai aur
 * purane sheet ke tab-id (gid) bhi samajhta hai, isliye tab ka naam badla ho to
 * bhi data sahi jagah jaata hai.
 *
 * KAAM:
 *   Settings   → phone / WhatsApp / email / UPI ID / announcement (site 15s me padh leti hai)
 *   Orders     → har order + status change (append-only timeline)
 *   Payments   → payment pending / UTR submitted / claimed / verified / failed
 *   Checkout   → funnel: checkout khula → review → order placed → order failed
 *   Messages   → contact form
 *   Newsletter → email subscribers
 *
 * ── SETUP (ek baar, 3 minute) ─────────────────────────────────────────────
 *  1. Naya Google Sheet kholiye → Extensions → Apps Script.
 *  2. Jo code neeche hai, poora paste kijiye (`Code.gs` me).
 *  3. Neeche TOKEN me apna lamba random word daaliye, e.g. `liksha-9f3k2m-r23`.
 *  4. Save (Ctrl+S) → Run → function `setup` → permission maange to Allow.
 *     → Sheet me Settings/Orders/Payments/Checkout/Messages/Newsletter tabs ban jayenge.
 *  5. Deploy → New deployment → type: **Web app**
 *       Description : liksha v2
 *       Execute as  : **Me**
 *       Who has access : **Anyone**
 *     → Deploy → **Web app URL** copy kariye (`.../exec` par khatam hota hai).
 *  6. Vercel → project `liksha-clothing` → Settings → Environment Variables:
 *       GOOGLE_SHEETS_WEBAPP_URL = <wahi /exec URL>
 *       GOOGLE_SHEETS_TOKEN      = <TOKEN jaisa hi>
 *     (optional, sirf padhne ke liye)
 *       GOOGLE_SHEETS_SETTINGS_CSV_URL = <Settings tab ka published CSV link>
 *     → Save → Redeploy (ya main redeploy kar dunga).
 *  7. Test: browser me kholein
 *       <webapp URL>?action=health&token=<TOKEN>
 *     Jawab me `{"ok":true,"sheets":[...rows...]}` aana chahiye.
 *     Phir website par ek test order kar ke Orders tab me row dekh lein.
 *
 * ── ZAROORI ──────────────────────────────────────────────────────────────
 *  • Code badalne par **naya version deploy** karna hota hai:
 *    Deploy → Manage deployments → Edit (pencil) → Version: **New version** → Deploy.
 *    Warna purana code hi chalta rehta hai.
 *  • "Who has access: Anyone" hi rakhein (website anonymous request bhejti hai);
 *    TOKEN galat ho to kuch bhi read/write nahi hota.
 *  • Published CSV (Publish to web) **read-only** hoti hai — usme website kabhi
 *    likh nahi sakti. Likhne ke liye sirf yahi Apps Script Web App kaam karta hai.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Apna secret token (Vercel ke GOOGLE_SHEETS_TOKEN se bilkul same) */
var TOKEN = 'CHANGE-ME-liksha-token';

/**
 * Sheet ke tab-id (URL me `#gid=...`) — **optional**.
 *
 * Ye naye sheet ("Designer Clothing — Store", account: prakashgothwal370@gmail.com)
 * ke asli id hain. Faayda: tab ka naam badalne par bhi script sahi tab pakadta hai.
 * Jo gid yahan nahi mila / galat hai to script tab ka **naam** se dhoondhta hai
 * (aur na mile to naya tab bana deta hai) — isliye ye khaali `null` bhi chhod sakte hain.
 */
var GIDS = {
  Settings: 1827766020,
  Orders: 19757621,
  Payments: 1008049319,
  Messages: 750680779,
  Newsletter: 1223926652,
  // ye do tab script khud banata hai (gid Google deta hai)
  Checkout: null,
  Audit: null,
};

/**
 * Sheet ka id (URL me `/d/<ID>/edit`).
 *
 * Agar script sheet ke andar se khula hai (Extensions → Apps Script) to ye
 * zaroori nahi. Par agar aap **script.google.com** par naya project banate hain
 * (standalone), to ye line kaam aati hai — isliye dono tarah se chalta hai.
 */
var SPREADSHEET_ID = '1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo';

var HEADERS = {
  Orders: [
    'Timestamp', 'Event', 'Order number', 'Order status', 'Payment status', 'Payment method',
    'Payment reference', 'UPI ID', 'Total', 'Subtotal', 'Discount', 'Coupon', 'Items',
    'Item details', 'Customer', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode',
    'Tracking courier', 'AWB', 'Tracking URL', 'Notes',
  ],
  Payments: [
    'Timestamp', 'Event', 'Order number', 'Order status', 'Payment status', 'Payment method',
    'Payment reference', 'UPI ID', 'Total', 'Subtotal', 'Discount', 'Coupon', 'Items',
    'Item details', 'Customer', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode',
    'Tracking courier', 'AWB', 'Tracking URL', 'Notes',
  ],
  Messages: ['Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Status'],
  // checkout funnel — kaun checkout tak pahuncha / order kiya / fail hua
  Checkout: ['Timestamp', 'Event', 'Step', 'Order number', 'Items', 'Subtotal', 'Reason', 'Phone'],
  Newsletter: ['Timestamp', 'Email'],
  Audit: ['Timestamp', 'Actor', 'Action', 'Target', 'Details'],
};

/** Settings tab ke default rows (sirf tab khaali ho tab likhe jaate hain) */
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
];

/* ───────────────────────────── helpers ───────────────────────────── */

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Kaun si sheet? — **SPREADSHEET_ID pehle**, phir active sheet, phir Script Property.
 *
 * Kyun order badla (25 Oct 2026): owner ka Apps Script `prkigothwal@gmail.com` se
 * chal raha hai aur wo kisi **doosri (copy) sheet** ke saath bind tha. Isliye
 * `getActiveSpreadsheet()` pehle chalne se data copy me ja raha tha — asli sheet
 * (`prakashgothwal370@gmail.com`) khaali dikh rahi thi. Ab explicit id jeetta hai.
 */
function book_() {
  var props = PropertiesService.getScriptProperties();
  var id = SPREADSHEET_ID || props.getProperty('SHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (error) {
      throw new Error(
        'Sheet "' + id + '" khul nahi rahi: ' + error.message +
        ' — is Google account ko us sheet par Editor access dijiye (Share → Editor).'
      );
    }
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('SPREADSHEET_ID set kariye (ya sheet ke andar se script kholein).');
}

/** Naam ya gid se sheet dhoondho; na mile to (khaali naam ke liye) bana do. */
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

function sheet_(name) {
  var book = book_();
  var sheet = findSheet_(book, name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    if (HEADERS[name]) {
      sheet.appendRow(HEADERS[name]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
    }
  }
  ensureHeaders_(sheet, name);
  return sheet;
}

/**
 * Header row ko sahi karo: agar sheet me purane/kam columns hain to missing
 * column jod diye jaate hain — warna naye fields (jaise `Reason`) chup-chaap
 * drop ho jaate the.
 */
function ensureHeaders_(sheet, name) {
  var headers = HEADERS[name];
  if (!headers) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
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
  }
}

/** Settings sheet: key/value rows → object */
function readSettings_() {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 0; i < values.length; i += 1) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    var value = String(values[i][1] === null || values[i][1] === undefined ? '' : values[i][1]).trim();
    if (!key || !value) continue;
    if (key === 'key' || key === 'store' || key === 'admin' || key === 'preview') continue;
    out[key] = value;
  }
  return out;
}

/* ───────────────────────────── one-time setup ───────────────────────────── */

/** Ek baar chalaiye — sab tabs + headers + default settings bana deta hai. */
function setup() {
  Object.keys(HEADERS).forEach(function (name) {
    sheet_(name);
  });

  var settings = sheet_('Settings');
  if (settings.getLastRow() === 0) settings.appendRow(['key', 'value']);
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
  settings.setFrozenRows(1);
  settings.getRange(1, 1, 1, 2).setFontWeight('bold');

  book_().toast('Liksha sheets ready ✔ (Orders / Payments / Checkout / Messages / Newsletter)', 'Setup', 6);
}

/** Extensions → Apps Script me chalaiye — append kaam kar raha hai ya nahi. */
function testAppend() {
  var stamp = new Date().toISOString();
  var written = appendRows_([
    {
      sheet: 'Orders',
      row: {
        Timestamp: stamp,
        Event: 'test.from_apps_script',
        'Order number': 'LK-TEST-' + Math.floor(Math.random() * 9000 + 1000),
        'Order status': 'placed',
        'Payment status': 'pending',
        Customer: 'Apps Script test',
        Total: 499,
      },
    },
    {
      sheet: 'Checkout',
      row: { Timestamp: stamp, Event: 'checkout.test', Step: 'test', Items: 1, Subtotal: 499 },
    },
  ]);
  Logger.log('rows written: ' + written);
  book_().toast('Test rows likh diye (' + written + ')', 'testAppend', 6);
  return written;
}

/* ───────────────────────────── HTTP API ───────────────────────────── */

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (TOKEN && String(params.token || '') !== TOKEN) {
    return json_({ ok: false, error: 'unauthorized — token match nahi hua' });
  }
  var action = params.action || 'settings';

  if (action === 'settings') {
    return json_({ ok: true, settings: readSettings_(), time: new Date().toISOString() });
  }

  if (action === 'recent') {
    var name = String(params.sheet || 'Orders');
    var limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    return json_({ ok: true, sheet: name, rows: recentRows_(name, limit) });
  }

  if (action === 'health' || action === 'ping') {
    var names = Object.keys(HEADERS);
    return json_({
      ok: true,
      version: 2,
      time: new Date().toISOString(),
      spreadsheet: book_().getName(),
      spreadsheetId: book_().getId(),
      spreadsheetUrl: book_().getUrl(),
      sheets: names.map(function (sheetName) {
        var sheet = sheet_(sheetName);
        return { name: sheetName, tab: sheet.getName(), rows: Math.max(0, sheet.getLastRow() - 1) };
      }),
    });
  }

  return json_({ ok: false, error: 'unknown action: ' + action });
}

/** Last N rows (headers ke saath object) — admin panel ise dikhata hai */
function recentRows_(name, limit) {
  if (!HEADERS[name]) return [];
  var sheet = sheet_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var width = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var start = Math.max(2, last - limit + 1);
  var values = sheet.getRange(start, 1, last - start + 1, width).getValues();
  return values.reverse().map(function (row) {
    var object = {};
    for (var i = 0; i < headers.length; i += 1) {
      object[String(headers[i])] = row[i] === null ? '' : row[i];
    }
    return object;
  });
}

/** Settings tab me admin ki values likho (key/value update ya naya row) */
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
    if (!cleanKey) return;
    var value = settings[key];
    if (value === undefined || value === null) return;
    if (index[cleanKey]) sheet.getRange(index[cleanKey], 2).setValue(value);
    else sheet.appendRow([cleanKey, value]);
    written += 1;
  });
  return written;
}

/**
 * Rows append — header **naam** se column dhoondha jaata hai, isliye column ka
 * order badalne ya beech me naya column jodne se data galat jagah nahi jaata.
 */
function appendRows_(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var written = 0;
  try {
    (rows || []).forEach(function (entry) {
      var name = String((entry && entry.sheet) || 'Orders');
      if (!HEADERS[name]) return;
      var sheet = sheet_(name);
      var width = Math.max(1, sheet.getLastColumn());
      var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
      var row = [];
      for (var i = 0; i < headers.length; i += 1) {
        var key = String(headers[i]).trim();
        var value = entry.row ? entry.row[key] : '';
        row.push(value === undefined || value === null ? '' : value);
      }
      sheet.appendRow(row);
      written += 1;
    });
  } finally {
    lock.releaseLock();
  }
  return written;
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return json_({ ok: false, error: 'invalid json' });
  }
  if (TOKEN && String(body.token || '') !== TOKEN) {
    return json_({ ok: false, error: 'unauthorized — token match nahi hua' });
  }

  if (body.action === 'settings_save') {
    try {
      var count = writeSettings_(body.settings || {});
      return json_({ ok: true, written: count, settings: readSettings_() });
    } catch (error) {
      return json_({ ok: false, error: String(error) });
    }
  }

  if (body.action !== 'append') {
    return json_({ ok: false, error: 'unknown action: ' + body.action });
  }

  // ek call me ek ya kai rows ({sheet, row} objects)
  var rows = Array.isArray(body.rows) ? body.rows : body.row ? [body] : [];
  if (!rows.length) return json_({ ok: false, error: 'no rows' });
  try {
    var written = appendRows_(rows);
    return json_({ ok: true, written: written, time: new Date().toISOString() });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}
```
