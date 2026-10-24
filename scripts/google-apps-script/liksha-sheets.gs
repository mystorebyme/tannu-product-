/**
 * LIKSHA CLOTHING — Google Sheet ↔ website bridge (Apps Script)
 * ------------------------------------------------------------
 * Yeh script ek hi Google Sheet ke saath kaam karta hai:
 *
 *   Settings   → owner yahan phone / email / UPI ID / announcement badalta hai.
 *                Website har 15 second me padh leti hai (redeploy ki zaroorat nahi).
 *   Orders     → har order + status change ki nayi row (append-only timeline).
 *   Payments   → payment reference submit / verified rows.
 *   Checkout   → checkout funnel (started / review / order placed / failed).
 *   Messages   → contact form ("Send us a message") ke messages.
 *   Newsletter → email subscribers.
 *
 * SETUP (ek baar, 5 minute):
 *   1. Google Sheet kholiye → Extensions → Apps Script.
 *   2. Is file ka poora code paste kijiye.
 *   3. Neeche TOKEN me koi lamba random word daaliye (jaise 'liksha-9f3k2m').
 *   4. Save → Run → `setup` (permission maange to Allow).
 *   5. Deploy → New deployment → type "Web app"
 *        Execute as: Me
 *        Who has access: Anyone
 *      → Deploy → Web app URL copy kariye (…/exec par khatam hota hai).
 *   6. Website ke env me daaliye:
 *        GOOGLE_SHEETS_WEBAPP_URL = <wahi /exec URL>
 *        GOOGLE_SHEETS_TOKEN      = <TOKEN jaisa hi>
 *      (Render/Vercel → Environment → redeploy)
 *
 * NOTE: "Anyone" access zaroori hai — website anonymous request bhejti hai.
 * Token ke bina koi data nahi milta / likha nahi jaata.
 */

/** Apna secret token yahan daaliye (website ke GOOGLE_SHEETS_TOKEN se same) */
var TOKEN = 'CHANGE-ME-liksha-token';

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
};

/** Settings sheet ke keys — website inhe padhti hai */
var DEFAULT_SETTINGS = [
  ['support_phone', '8005900581'],
  ['whatsapp', '8005900581'],
  ['support_email', 'Info.likshaclothing@gmail.com'],
  ['upi_id', 'dhakadgourav@fam'],
  ['upi_name', 'Designer Clothing'],
  ['announcement', 'Diwali Sale — Flat 70% OFF · Final price ₹499 onwards'],
  ['gstin', ''],
  ['free_shipping', 'true'],
  // admin panel ka link — sirf owner ke liye (frontend par kabhi nahi dikhta)
  ['admin_url', ''],
];

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function sheet_(name) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    if (HEADERS[name]) sheet.appendRow(HEADERS[name]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
  }
  return sheet;
}

/** Ek baar chalaiye — sab sheets + headers + default settings bana deta hai */
function setup() {
  Object.keys(HEADERS).forEach(sheet_);

  var settings = sheet_('Settings');
  if (settings.getLastRow() === 0) settings.appendRow(['key', 'value']);
  var existing = {};
  if (settings.getLastRow() > 1) {
    settings.getRange(2, 1, settings.getLastRow() - 1, 2).getValues().forEach(function (row) {
      existing[String(row[0]).trim().toLowerCase()] = true;
    });
  }
  DEFAULT_SETTINGS.forEach(function (entry) {
    if (!existing[entry[0]]) settings.appendRow(entry);
  });
  settings.setFrozenRows(1);
  settings.getRange(1, 1, 1, 2).setFontWeight('bold');

  SpreadsheetApp.getActiveSpreadsheet().toast('Liksha sheets ready ✔', 'Setup', 5);
}

function readSettings_() {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < values.length; i += 1) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    var value = String(values[i][1] === null ? '' : values[i][1]).trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (TOKEN && String(params.token || '') !== TOKEN) {
    return json_({ ok: false, error: 'unauthorized' });
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
  if (action === 'health') {
    var names = Object.keys(HEADERS);
    return json_({
      ok: true,
      time: new Date().toISOString(),
      sheets: names.map(function (name) {
        return { name: name, rows: Math.max(0, sheet_(name).getLastRow() - 1) };
      }),
    });
  }
  return json_({ ok: false, error: 'unknown action' });
}

/** Last N rows (sheet ke headers ke saath object bana kar) — admin panel ise dikhata hai */
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

/** Settings sheet me owner/admin ki values likho (key/value rows update/insert) */
function writeSettings_(settings) {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < values.length; i += 1) {
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

function appendRows_(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var written = 0;
  try {
    rows.forEach(function (entry) {
      var name = String(entry.sheet || 'Orders');
      if (!HEADERS[name]) return;
      var sheet = sheet_(name);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var row = [];
      for (var i = 0; i < headers.length; i += 1) {
        var key = String(headers[i]);
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
    return json_({ ok: false, error: 'unauthorized' });
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
    return json_({ ok: false, error: 'unknown action' });
  }
  var rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return json_({ ok: false, error: 'no rows' });
  try {
    var written = appendRows_(rows);
    return json_({ ok: true, written: written, time: new Date().toISOString() });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

/** Test: Apps Script editor me chalaiye — do row append karke result dikhata hai */
function testAppend() {
  var result = appendRows_([
    {
      sheet: 'Orders',
      row: {
        Timestamp: new Date().toISOString(),
        Event: 'test',
        'Order number': 'LK-TEST01',
        Customer: 'Test Customer',
        Total: 499,
      },
    },
  ]);
  Logger.log('written: ' + result);
}
