/**
 * Apps Script (liksha-sheets.gs) ka dry-run test.
 *
 * Owner ka complaint tha "sheet me koi data add nahi ho raha". Isliye script ko fake
 * Google Sheets par chalaya jaata hai — agar column mapping, header repair ya token
 * check tootega to yahin pakda jayega (owner ko debug karne ki zaroorat nahi).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  checkoutEventSheetRow,
  invoiceSheetRow,
  messageSheetRow,
  orderItemSheetRows,
  orderSheetRow,
  shipmentSheetRow,
  subscriberSheetRow,
} from "../../apps/web/src/lib/sheet-format";
import type { Order } from "@liksha/types";

type Cell = string | number | boolean | null;
type Grid = Cell[][];

function makeSheet(name: string, id: number, grid: Grid = []) {
  const sheet = {
    name,
    rows: grid,
    getSheetId: () => id,
    getName: () => name,
    getLastRow: () => sheet.rows.length,
    getLastColumn: () => sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
    appendRow: (row: Cell[]) => {
      sheet.rows.push([...row]);
    },
    setFrozenRows: () => {},
    getDataRange: () => range(1, 1, Math.max(1, sheet.rows.length), Math.max(1, sheet.getLastColumn())),
    getRange: (row: number, column: number, numRows = 1, numColumns = 1) => range(row, column, numRows, numColumns),
  };

  function range(row: number, column: number, numRows: number, numColumns: number) {
    const read = () => {
      const out: Cell[][] = [];
      for (let r = 0; r < numRows; r += 1) {
        const line: Cell[] = [];
        for (let c = 0; c < numColumns; c += 1) {
          line.push(sheet.rows[row - 1 + r]?.[column - 1 + c] ?? "");
        }
        out.push(line);
      }
      return out;
    };
    const api = {
      getValues: read,
      setValues: (values: Cell[][]) => {
        values.forEach((line, r) => {
          const target = row - 1 + r;
          sheet.rows[target] = sheet.rows[target] ?? [];
          line.forEach((value, c) => {
            sheet.rows[target][column - 1 + c] = value;
          });
        });
        return api;
      },
      setValue: (value: Cell) => {
        sheet.rows[row - 1] = sheet.rows[row - 1] ?? [];
        sheet.rows[row - 1][column - 1] = value;
        return api;
      },
      setFontWeight: () => api,
    };
    return api;
  }

  return sheet;
}

function loadScript(
  token = "test-token",
  options: { dropSpreadsheetId?: boolean; activeIsCopy?: boolean } = {},
) {
  const file = path.join(process.cwd(), "scripts/google-apps-script/liksha-sheets.gs");
  let source = fs.readFileSync(file, "utf8").replace(
    "var TOKEN = 'CHANGE-ME-liksha-token';",
    `var TOKEN = '${token}';`,
  );
  assert.ok(source.includes(`var TOKEN = '${token}';`), "token replace hua");

  /**
   * Owner ne paste karte waqt `SPREADSHEET_ID` line delete kar di thi — usi galti
   * ka test. Script crash nahi honi chahiye, fallback id se asli sheet pakdni chahiye.
   */
  if (options.dropSpreadsheetId) {
    source = source.replace(/^var SPREADSHEET_ID = '[^']*';\s*$/m, "");
    assert.ok(!/^var SPREADSHEET_ID/m.test(source), "SPREADSHEET_ID line hataayi gayi");
  }

  const sheets: ReturnType<typeof makeSheet>[] = [];
  const book = {
    getName: () => "Liksha Test Sheet",
    getId: () => "test-sheet-id",
    getUrl: () => "https://docs.google.com/spreadsheets/d/test-sheet-id/edit",
    getSheets: () => sheets,
    getSheetByName: (name: string) => sheets.find((sheet) => sheet.getName() === name) ?? null,
    insertSheet: (name: string) => {
      const sheet = makeSheet(name, 1000 + sheets.length);
      sheets.push(sheet);
      return sheet;
    },
    toast: () => {},
  };

  /**
   * "copy" book = jis sheet ke saath script bana hai (owner ke case me galat sheet).
   * `book` = asli sheet. Test pakadta hai ki writes **asli** sheet me jaate hain.
   */
  const copySheets: ReturnType<typeof makeSheet>[] = [];
  const copyBook = {
    getName: () => "Copy of Liksha (galat sheet)",
    getId: () => "copy-sheet-id",
    getUrl: () => "https://docs.google.com/spreadsheets/d/copy-sheet-id/edit",
    getSheets: () => copySheets,
    getSheetByName: (name: string) => copySheets.find((sheet) => sheet.getName() === name) ?? null,
    insertSheet: (name: string) => {
      const sheet = makeSheet(name, 2000 + copySheets.length);
      copySheets.push(sheet);
      return sheet;
    },
    toast: () => {},
  };

  const sandbox: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (options.activeIsCopy ? copyBook : book),
      openById: () => book,
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text: string) => ({
        text,
        mime: "",
        setMimeType(mime: string) {
          this.mime = mime;
          return this;
        },
        getContent: () => text,
        getJson: () => JSON.parse(text),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Logger: { log: () => {} },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox: sandbox as Record<string, any>, sheets, book, copySheets };
}

test("setup() sab tabs + headers + default settings banata hai", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();

  const names = sheets.map((sheet) => sheet.getName());
  for (const expected of ["Settings", "Orders", "Payments", "Checkout", "Messages", "Newsletter"]) {
    assert.ok(names.includes(expected), `${expected} tab missing`);
  }
  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  assert.equal(orders.rows[0]?.[1], "Event");
  assert.ok(orders.rows[0]?.includes("Order number"));

  const settings = sheets.find((sheet) => sheet.getName() === "Settings")!;
  const flat = settings.rows.map((row) => String(row[0]));
  assert.ok(flat.includes("support_phone"));
  assert.ok(flat.includes("upi_id"));
});

test("naye column add hone par header repair hota hai (data drop nahi)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const checkout = sheets.find((sheet) => sheet.getName() === "Checkout")!;
  // purani sheet jaisa: Reason column gayab
  checkout.rows[0] = ["Timestamp", "Event", "Step", "Order number", "Items", "Subtotal", "Phone"];

  const written = sandbox.appendRows_([
    { sheet: "Checkout", row: { Timestamp: "t1", Event: "checkout.review", Reason: "pincode fail", Phone: "9876500011" } },
  ]);
  assert.equal(written, 1);
  assert.ok(checkout.rows[0].includes("Reason"), "Reason header wapas add hona chahiye");
  const reasonIndex = checkout.rows[0].indexOf("Reason");
  assert.equal(checkout.rows[1][reasonIndex], "pincode fail");
});

test("appendJSON posts se order row sahi columns me jaati hai", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const response = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "append",
        rows: [
          {
            sheet: "Orders",
            row: {
              Timestamp: "2026-10-25T10:00:00.000Z",
              Event: "order.placed",
              "Order number": "LK-ABC123",
              "Payment status": "pending",
              Customer: "Tannu",
              Total: 549,
            },
          },
          { sheet: "Payments", row: { Timestamp: "2026-10-25T10:01:00.000Z", Event: "payment.claimed", "Order number": "LK-ABC123" } },
        ],
      }),
    },
  });
  assert.equal(response.getJson().ok, true, JSON.stringify(response.getJson()));

  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  const header = orders.rows[0];
  const row = orders.rows[1];
  assert.equal(row[header.indexOf("Order number")], "LK-ABC123");
  assert.equal(row[header.indexOf("Customer")], "Tannu");
  assert.equal(row[header.indexOf("Total")], 549);

  const payments = sheets.find((sheet) => sheet.getName() === "Payments")!;
  assert.equal(payments.rows[1][payments.rows[0].indexOf("Event")], "payment.claimed");
});

test("galat token par kuch bhi write nahi hota", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const response = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "wrong",
        action: "append",
        rows: [{ sheet: "Orders", row: { Event: "order.placed", "Order number": "LK-HACK" } }],
      }),
    },
  });
  assert.equal(response.getJson().ok, false);
  assert.equal(sheets.find((sheet) => sheet.getName() === "Orders")!.rows.length, 1);
});

test("settings_save sirf di gayi keys update karta hai", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const response = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "settings_save",
        settings: { support_phone: "8005900581", announcement: "Diwali Sale" },
      }),
    },
  });
  const payload = response.getJson();
  assert.equal(payload.ok, true);
  assert.equal(payload.settings.support_phone, "8005900581");
  assert.equal(payload.settings.announcement, "Diwali Sale");
  // pehle se maujood upi_id delete nahi hui
  assert.equal(payload.settings.upi_id, "dhakadgourav@fam");
  assert.ok(sheets.find((sheet) => sheet.getName() === "Settings")!.rows.length >= 3);
});

test("doGet health/settings/recent — token ke bina kuch nahi", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  assert.equal(sandbox.doGet({ parameter: {} }).getJson().ok, false);
  const health = sandbox.doGet({ parameter: { action: "health", token: "test-token" } }).getJson();
  assert.equal(health.ok, true);
  assert.ok(health.sheets.some((sheet: { name: string }) => sheet.name === "Checkout"));
  const settings = sandbox.doGet({ parameter: { action: "settings", token: "test-token" } }).getJson();
  assert.equal(settings.settings.upi_id, "dhakadgourav@fam");
});

test("script me UPI brand naam ya secret hardcode nahi hai", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/google-apps-script/liksha-sheets.gs"), "utf8");
  assert.ok(!/Google Pay|PhonePe|Paytm|BHIM/i.test(source), "UPI brand naam nahi hone chahiye");
  assert.ok(source.includes("CHANGE-ME-liksha-token"), "token placeholder rakha ho");
  assert.ok(!/AKfycb/.test(source), "koi asli deployment id hardcode nahi");
});

/**
 * App ↔ script contract: website jo column bhejti hai, wo sheet ke HEADERS me
 * hone chahiye. Warna row chup-chaap aadhi bhar jaati hai (owner ko "data nahi
 * aa raha" hi dikhta hai).
 */
function headersOf(sandbox: Record<string, any>, name: string): string[] {
  const headers = sandbox.HEADERS[name] as string[];
  assert.ok(Array.isArray(headers) && headers.length > 0, `${name} headers missing`);
  return headers;
}

const sampleOrder = {
  id: "o1",
  orderNumber: "LK-ABC123",
  customerName: "Tannu",
  email: "t@example.com",
  phone: "9876500011",
  address: "12 Test Street",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
  items: [{ title: "Anarkali", handle: "anarkali", size: "M", quantity: 1, price: 49900, image: "x.jpg" }],
  subtotal: 49900,
  discount: 0,
  shipping: 0,
  total: 49900,
  status: "placed",
  paymentStatus: "pending",
  paymentMethod: "prepaid",
  createdAt: "2026-10-25T10:00:00.000Z",
  updatedAt: "2026-10-25T10:00:00.000Z",
  audit: [],
  tracking: { courier: "Delhivery", awb: "AWB1", url: "https://x" },
} as unknown as Order;

test("website jo column bhejti hai wo sab sheet HEADERS me maujood hain", () => {
  const { sandbox } = loadScript();

  const ordersKeys = Object.keys(orderSheetRow(sampleOrder, "order.placed", { "UPI ID": "dhakadgourav@fam" }));
  for (const key of ordersKeys) {
    assert.ok(headersOf(sandbox, "Orders").includes(key), `Orders me column nahi: ${key}`);
    assert.ok(headersOf(sandbox, "Payments").includes(key), `Payments me column nahi: ${key}`);
  }

  const checkoutKeys = Object.keys(
    checkoutEventSheetRow({
      createdAt: "2026-10-25T10:00:00.000Z",
      event: "checkout.review",
      step: "review",
      orderNumber: null,
      itemsCount: 2,
      subtotal: 99800,
      reason: "state_mismatch",
      phone: "9876500011",
    }),
  );
  for (const key of checkoutKeys) {
    assert.ok(headersOf(sandbox, "Checkout").includes(key), `Checkout me column nahi: ${key}`);
  }

  const messageKeys = Object.keys(
    messageSheetRow({ createdAt: "t", name: "A", email: "a@b.c", message: "hi", phone: "9876500011" }),
  );
  for (const key of messageKeys) {
    assert.ok(headersOf(sandbox, "Messages").includes(key), `Messages me column nahi: ${key}`);
  }

  const newsletterKeys = Object.keys(subscriberSheetRow("a@b.c", "t"));
  for (const key of newsletterKeys) {
    assert.ok(headersOf(sandbox, "Newsletter").includes(key), `Newsletter me column nahi: ${key}`);
  }
});

test("row ke saare values asli sheet me land karte hain (order.placed)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const row = orderSheetRow(sampleOrder, "order.placed", { "UPI ID": "dhakadgourav@fam" });
  sandbox.appendRows_([{ sheet: "Orders", row }]);

  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  const header = orders.rows[0];
  const written = orders.rows[1];
  const column = (name: string) => written[header.indexOf(name)];
  assert.equal(column("Order number"), "LK-ABC123");
  assert.equal(column("State"), "Rajasthan");
  assert.equal(column("Total"), 499);
  assert.equal(column("UPI ID"), "dhakadgourav@fam");
  assert.equal(column("Tracking courier"), "Delhivery");
  assert.equal(column("Item details"), "Anarkali (M) x1");
  // koi value drop nahi hui
  const dropped = header
    .map((name, index) => {
      const value = row[name as string];
      const expected = value === undefined || value === null || value === "" ? "" : String(value);
      if (!expected) return null; // khaali field jaan-boojh kar khaali hai
      return String(written[index]) === expected ? null : name;
    })
    .filter(Boolean);
  assert.deepEqual(dropped, []);
});

test("owner doc (apps-script-code.md) script ke saath sync hai", () => {
  const gs = fs.readFileSync(path.join(process.cwd(), "scripts/google-apps-script/liksha-sheets.gs"), "utf8").trimEnd();
  const doc = fs.readFileSync(path.join(process.cwd(), "docs/00-overview/apps-script-code.md"), "utf8");
  assert.ok(doc.includes(gs), "doc purani hai — `npm run apps-script:export` chalaiye");
});

test("SPREADSHEET_ID line delete ho jaye to bhi asli sheet me likhta hai (ReferenceError-proof)", () => {
  // Owner ne paste karte waqt ye line delete kar di thi → live script crash ho rahi thi.
  const { sandbox, sheets, copySheets } = loadScript("test-token", {
    dropSpreadsheetId: true,
    activeIsCopy: true,
  });
  sandbox.setup();

  const response = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "append",
        rows: [{ sheet: "Audit", row: { Actor: "test", Action: "fallback", Target: "sheet", Details: "ok" } }],
      }),
    },
  });
  assert.equal(response.getJson().ok, true, "append ok hona chahiye");

  const audit = sheets.find((sheet) => sheet.getName() === "Audit");
  assert.ok(audit, "asli sheet me Audit tab bana");
  assert.equal(audit!.rows.length, 2, "header + 1 data row");
  assert.ok(
    copySheets.every((sheet) => sheet.rows.length <= 1),
    "copy sheet me koi data row nahi gayi",
  );
});

test("health response code version deta hai (pata chale naya code chal raha hai)", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const body = sandbox.doGet({ parameter: { token: "test-token", action: "health" } }).getJson();
  assert.equal(body.ok, true);
  assert.match(String(body.codeVersion), /^r\d+/);
  assert.equal(body.spreadsheetId, "test-sheet-id");
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R27 v3 script — naye tabs (OrderItems / Shipments / Invoices / Reviews /
 * Coupons / Inventory / Errors / Dashboard / Sync) aur naye endpoints.
 * Owner ne kaha: "jo jo new db add ho vo bhi kaam kare".
 * ═══════════════════════════════════════════════════════════════════════════ */

test("v3: setup saare naye tabs banata hai", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const names = sheets.map((sheet) => sheet.getName());
  for (const expected of [
    "Settings", "Orders", "OrderItems", "Payments", "Invoices", "Shipments",
    "Checkout", "Messages", "Newsletter", "Reviews", "Coupons", "Inventory",
    "Audit", "Errors", "Dashboard", "Sync",
  ]) {
    assert.ok(names.includes(expected), `${expected} tab missing`);
  }
  assert.equal(String(sandbox.CODE_VERSION).startsWith("r"), true);
});

test("v3: web ke naye sheet rows ke saare columns HEADERS me hain", () => {
  const { sandbox } = loadScript();
  const items = orderItemSheetRows(sampleOrder);
  assert.ok(items.length > 0);
  for (const key of Object.keys(items[0]!)) {
    assert.ok(headersOf(sandbox, "OrderItems").includes(key), `OrderItems me column nahi: ${key}`);
  }
  for (const key of Object.keys(shipmentSheetRow(sampleOrder))) {
    assert.ok(headersOf(sandbox, "Shipments").includes(key), `Shipments me column nahi: ${key}`);
  }
  const invoice = invoiceSheetRow(
    {
      number: "INV-1",
      issuedAt: "2026-10-25T10:00:00.000Z",
      buyer: { name: "Tannu", phone: "9876500011" },
      totals: { taxable: 49900, cgst: 0, sgst: 0, igst: 0 },
    },
    sampleOrder,
  );
  for (const key of Object.keys(invoice)) {
    assert.ok(headersOf(sandbox, "Invoices").includes(key), `Invoices me column nahi: ${key}`);
  }
});

test("v3: order_update timeline + Shipments + Payments likhta hai", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const response = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "order_update",
        orderNumber: "LK-ABC123",
        event: "order.tracking_updated",
        status: "shipped",
        paymentStatus: "paid",
        courier: "Delhivery",
        awb: "AWB9",
        trackingUrl: "https://track/9",
        note: "pickup ho gaya",
      }),
    },
  });
  const payload = response.getJson();
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.written, 3, "Orders + Shipments + Payments");

  const shipments = sheets.find((sheet) => sheet.getName() === "Shipments")!;
  const header = shipments.rows[0];
  const row = shipments.rows[1];
  assert.equal(row[header.indexOf("AWB")], "AWB9");
  assert.equal(row[header.indexOf("Courier")], "Delhivery");

  const payments = sheets.find((sheet) => sheet.getName() === "Payments")!;
  assert.equal(payments.rows[1][payments.rows[0].indexOf("Payment status")], "paid");
});

test("v3: invoice_save aur stock_update apne tab me likhte hain", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const invoice = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "invoice_save",
        invoiceNumber: "INV-77",
        orderNumber: "LK-ABC123",
        taxable: 423,
        cgst: 38,
        sgst: 38,
        total: 499,
        customer: "Tannu",
      }),
    },
  }).getJson();
  assert.equal(invoice.ok, true);

  const stock = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "stock_update",
        handle: "anarkali",
        size: "M",
        stock: 2,
        change: -1,
        reason: "order LK-ABC123",
      }),
    },
  }).getJson();
  assert.equal(stock.ok, true);

  const invoices = sheets.find((sheet) => sheet.getName() === "Invoices")!;
  assert.equal(invoices.rows[1][invoices.rows[0].indexOf("Invoice number")], "INV-77");
  const inventory = sheets.find((sheet) => sheet.getName() === "Inventory")!;
  assert.equal(inventory.rows[1][inventory.rows[0].indexOf("Stock")], 2);
  assert.equal(inventory.rows[1][inventory.rows[0].indexOf("Low stock alert")], "yes");
});

test("v3: newsletter duplicate email skip, review duplicate skip, coupon update", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();

  const first = sandbox.doPost({ postData: { contents: JSON.stringify({ token: "test-token", action: "subscribe", email: "A@B.com" }) } }).getJson();
  const second = sandbox.doPost({ postData: { contents: JSON.stringify({ token: "test-token", action: "subscribe", email: "a@b.com" }) } }).getJson();
  assert.equal(first.ok, true);
  assert.equal(first.written, 1);
  assert.equal(second.duplicate, true);
  assert.equal(second.written, 0);
  const newsletter = sheets.find((sheet) => sheet.getName() === "Newsletter")!;
  assert.equal(newsletter.rows.length, 2, "header + 1 row hi honi chahiye");

  const reviewBody = { token: "test-token", action: "review_add", product: "Anarkali", customer: "Tannu", rating: 5, review: "Bahut accha", verified: true };
  const r1 = sandbox.doPost({ postData: { contents: JSON.stringify(reviewBody) } }).getJson();
  const r2 = sandbox.doPost({ postData: { contents: JSON.stringify(reviewBody) } }).getJson();
  assert.equal(r1.written, 1);
  assert.equal(r2.duplicate, true);
  const reviews = sheets.find((sheet) => sheet.getName() === "Reviews")!;
  assert.equal(reviews.rows[1][reviews.rows[0].indexOf("Verified")], "yes");

  const add = sandbox.doPost({ postData: { contents: JSON.stringify({ token: "test-token", action: "coupon_save", code: "DIWALI10", value: 10 }) } }).getJson();
  assert.equal(add.updated, false);
  const update = sandbox.doPost({ postData: { contents: JSON.stringify({ token: "test-token", action: "coupon_save", code: "diwali10", value: 15 }) } }).getJson();
  assert.equal(update.updated, true);
  const coupons = sheets.find((sheet) => sheet.getName() === "Coupons")!;
  assert.equal(coupons.rows.length, 2, "ek hi coupon row");
  assert.equal(coupons.rows[1][coupons.rows[0].indexOf("Value")], 15);
});

test("v3: message_status reply mark karta hai", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  sandbox.appendRows_([
    { sheet: "Messages", row: { Timestamp: "t", Name: "A", Email: "a@b.c", Message: "hi", "Message ID": "msg-1" } },
  ]);
  const response = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "message_status", id: "msg-1", status: "replied" }) },
  }).getJson();
  assert.equal(response.ok, true);
  assert.equal(response.updated, 1);
  const messages = sheets.find((sheet) => sheet.getName() === "Messages")!;
  const header = messages.rows[0];
  assert.equal(messages.rows[1][header.indexOf("Status")], "replied");
  assert.equal(messages.rows[1][header.indexOf("Replied")], "yes");
});

test("v3: doGet — stats, search aur poora order", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  sandbox.appendRows_([
    {
      sheet: "Orders",
      row: {
        Timestamp: new Date().toISOString(),
        Event: "order.placed",
        "Order number": "LK-XYZ1",
        "Payment status": "paid",
        Total: 499,
      },
    },
    { sheet: "OrderItems", row: { Timestamp: "t", "Order number": "LK-XYZ1", Product: "Anarkali", Quantity: 1 } },
  ]);

  const stats = sandbox.doGet({ parameter: { token: "test-token", action: "stats" } }).getJson();
  assert.equal(stats.ok, true);
  assert.equal(stats.stats.orders.paid, 1);
  assert.equal(stats.stats.orders.revenue, 499);

  const search = sandbox.doGet({
    parameter: { token: "test-token", action: "search", sheet: "Orders", column: "Order number", value: "LK-XYZ1" },
  }).getJson();
  assert.equal(search.rows.length, 1);

  const story = sandbox.doGet({ parameter: { token: "test-token", action: "order", orderNumber: "LK-XYZ1" } }).getJson();
  assert.equal(story.ok, true);
  assert.equal(story.order.rows.Orders.length, 1);
  assert.equal(story.order.rows.OrderItems.length, 1);

  const health = sandbox.doGet({ parameter: { token: "test-token", action: "health" } }).getJson();
  assert.ok(health.sheets.some((sheet: { name: string }) => sheet.name === "Invoices"));
  assert.equal(health.version, sandbox.CODE_VERSION);
});

test("v3: galat token par naye endpoints bhi block hain", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const response = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "galat", action: "invoice_save", invoiceNumber: "HACK" }) },
  }).getJson();
  assert.equal(response.ok, false);
  const invoices = sheets.find((sheet) => sheet.getName() === "Invoices")!;
  assert.equal(invoices.rows.length, 1, "sirf header");
});
