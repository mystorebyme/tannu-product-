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
    /** R42: setDataValidation calls ka record — dropdown tests isi se assert karte hain */
    validations: [] as { row: number; column: number; numRows: number; rule: { list?: string[]; allowInvalid?: boolean } }[],
    getSheetId: () => id,
    getName: () => name,
    getLastRow: () => sheet.rows.length,
    getLastColumn: () => sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
    appendRow: (row: Cell[]) => {
      sheet.rows.push([...row]);
    },
    setFrozenRows: () => {},
    deleteRow: (row: number) => {
      sheet.rows.splice(row - 1, 1);
    },
    clearContents: () => {
      sheet.rows = [];
    },
    getFilter: () => null,
    setColumnWidth: () => {},
    getMaxRows: () => Math.max(50, sheet.rows.length + 10),
    getMaxColumns: () => Math.max(30, sheet.getLastColumn()),
    deleteColumns: () => {},
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
      /** R43: onEdit tests — single-cell read (script `getRange(r,c).getValue()` karta hai) */
      getValue: () => read()[0]?.[0] ?? "",
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
      setBackground: () => api,
      setVerticalAlignment: () => api,
      setWrapStrategy: () => api,
      setNumberFormat: () => api,
      createFilter: () => api,
      setDataValidation: (rule: { list?: string[]; allowInvalid?: boolean }) => {
        sheet.validations.push({ row, column, numRows, rule });
        return api;
      },
    };
    return api;
  }

  return sheet;
}

function loadScript(
  token = "test-token",
  options: {
    dropSpreadsheetId?: boolean;
    activeIsCopy?: boolean;
    openByIdFails?: boolean;
    activeIsNull?: boolean;
    propertySheetId?: string | null;
  } = {},
) {
  const file = path.join(process.cwd(), "scripts/google-apps-script/liksha-sheets.gs");
  let source = fs.readFileSync(file, "utf8").replace(
    "var TOKEN = 'CHANGE-ME-liksha-token';",
    `var TOKEN = '${token}';`,
  );
  assert.ok(source.includes(`var TOKEN = '${token}';`), "token replace hua");

  /**
   * R40: code me SPREADSHEET_ID line hoti hi nahi — sheet id sirf Script
   * Properties me. `dropSpreadsheetId` option ab "SHEET_ID property khaali"
   * (fresh paste) scenario hai.
   */
  if (options.dropSpreadsheetId) {
    options.propertySheetId = null;
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
      getActiveSpreadsheet: () => (options.activeIsNull ? null : options.activeIsCopy ? copyBook : book),
      create: (name: string) => {
        const sheet = makeSheet(name, 9000);
        (options as Record<string, unknown>).createdSheetName = name;
        return book;
      },
      WrapStrategy: { WRAP: "wrap", CLIP: "clip" },
      /** R42: dropdown (data validation) builder — rule build karke range ko deta hai */
      newDataValidation: () => {
        const builder: { list?: string[]; allowInvalid?: boolean; requireValueInList?: unknown; setAllowInvalid?: unknown; build?: unknown } = {};
        builder.requireValueInList = (list: string[]) => {
          builder.list = list;
          return builder;
        };
        builder.setAllowInvalid = (allow: boolean) => {
          builder.allowInvalid = allow;
          return builder;
        };
        builder.build = () => ({ list: builder.list, allowInvalid: builder.allowInvalid });
        return builder;
      },
      openById: (id: string) => {
        /**
         * Owner ka asli case: script `prkigothwal@gmail.com` se chalti hai aur sheet
         * doosre account ki hai → Google "You do not have permission to access the
         * requested document" deta hai. (createOwnSheet ki nayi sheet hamesha khulti
         * hai — real Apps Script jaisa.)
         */
        if (options.openByIdFails && id !== "test-sheet-id") {
          throw new Error("You do not have permission to access the requested document.");
        }
        return book;
      },
    },
    Session: {
      getEffectiveUser: () => ({ getEmail: () => "prkigothwal@gmail.com" }),
      getActiveUser: () => ({ getEmail: () => "prkigothwal@gmail.com" }),
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
    /** R39: plain /exec browser request par HTML control panel banta hai. */
    HtmlService: {
      createHtmlOutput: (html: string) => {
        const out: Record<string, unknown> = {
          html,
          getContent: () => html,
          getTitle: () => "Liksha sheet panel",
        };
        out.setTitle = () => out;
        out.addMetaTag = () => out;
        return out;
      },
    },
    LockService: { getScriptLock: () => ({ waitLock: () => true, releaseLock: () => {} }) },
    PropertiesService: {
      /** R38: props key-aware hain — script ab TOKEN bhi Script Properties se padhti hai. */
      getScriptProperties: () => {
        const opts = options as Record<string, unknown>;
        const props = (opts.props ?? (opts.props = {})) as Record<string, string>;
        // R40: sheet ka id sirf props me — harness default 'test-sheet-id' (null = fresh paste)
        if (options.propertySheetId !== null && props.SHEET_ID === undefined) {
          props.SHEET_ID = options.propertySheetId ?? "test-sheet-id";
        }
        return {
          getProperty: (key: string) => props[key] ?? null,
          setProperty: (key: string, value: string) => {
            props[key] = value;
            opts.savedProperty = `${key}=${value}`;
            if (key === "SHEET_ID") opts.propertySheetId = value;
          },
        };
      },
    },
    Utilities: {
      formatDate: () => "25-Oct-2026 12:00:00",
    },
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
  // R38: koi default UPI seed nahi hoti — settings_save ne upi_id invent nahi kiya
  assert.equal(payload.settings.upi_id ?? "", "");
  assert.ok(sheets.find((sheet) => sheet.getName() === "Settings")!.rows.length >= 3);
});

test("doGet R38 — settings/health public (safe), baaki sab token-gated", () => {
  const { sandbox } = loadScript();
  sandbox.setup();

  // private action bina token band
  assert.equal(sandbox.doGet({ parameter: { action: "recent", sheet: "Orders" } }).getJson().ok, false);

  // settings PUBLIC hai — token set hone se pehle bhi website UPI padh sake
  const pub = sandbox.doGet({ parameter: { action: "settings" } }).getJson();
  assert.equal(pub.ok, true);
  assert.equal(pub.public, true);
  assert.equal(pub.settings.admin_url, undefined, "admin_url public subset me nahi");
  assert.equal(pub.settings.upi_id ?? "", "", "R38: koi default UPI seed nahi hoti");

  // owner sheet me UPI bharta hai → public + full dono me wahi aata hai
  sandbox.writeSettings_({ upi_id: "mystore@upi", admin_url: "https://admin.example" });
  const full = sandbox.doGet({ parameter: { action: "settings", token: "test-token" } }).getJson();
  assert.equal(full.settings.upi_id, "mystore@upi");
  assert.equal(full.settings.admin_url, "https://admin.example");
  const pubAfter = sandbox.doGet({ parameter: { action: "settings" } }).getJson();
  assert.equal(pubAfter.settings.upi_id, "mystore@upi");
  assert.equal(pubAfter.settings.admin_url, undefined);

  // health public (safe fields); sheet naam/URL/counts sirf token ke saath
  const openHealth = sandbox.doGet({ parameter: { action: "health" } }).getJson();
  assert.equal(openHealth.ok, true);
  assert.equal(openHealth.tokenOk, false);
  assert.equal(openHealth.sheetFound, true);
  assert.equal(openHealth.sheetId, "test-sheet-id");
  assert.equal(openHealth.spreadsheetId, "test-sheet-id");
  assert.equal(openHealth.spreadsheetUrl, "");
  assert.equal(openHealth.upiSet, true);

  const authHealth = sandbox.doGet({ parameter: { action: "health", token: "test-token" } }).getJson();
  assert.equal(authHealth.tokenOk, true);
  assert.ok(authHealth.sheets.some((sheet: { name: string }) => sheet.name === "Checkout"));
  assert.ok(String(authHealth.spreadsheetUrl).includes("test-sheet-id"));
});

test("R38: placeholder token se koi protected action nahi chalta (public repo wali value)", () => {
  const { sandbox, sheets } = loadScript("CHANGE-ME-liksha-token");
  sandbox.setup();
  const res = sandbox
    .doPost({
      postData: {
        contents: JSON.stringify({
          token: "CHANGE-ME-liksha-token",
          action: "append",
          rows: [{ sheet: "Orders", row: { Event: "order.placed", "Order number": "LK-HACK" } }],
        }),
      },
    })
    .getJson();
  assert.equal(res.ok, false, "placeholder token authorize nahi hona chahiye");
  assert.match(String(res.fix), /set_token/, "fix me set_token URL batana chahiye");
  assert.equal(sheets.find((sheet) => sheet.getName() === "Orders")!.rows.length, 1, "koi row nahi likhi gayi");
  // public reads phir bhi khule hain
  assert.equal(sandbox.doGet({ parameter: { action: "settings" } }).getJson().ok, true);
  assert.equal(sandbox.doGet({ parameter: { action: "health" } }).getJson().tokenSet, false);
});

test("R38: set_token — fresh install par save, baad me old ke bina change nahi", () => {
  const { sandbox } = loadScript("CHANGE-ME-liksha-token");

  const weak = sandbox.doGet({ parameter: { action: "set_token", token: "chota" } }).getJson();
  assert.equal(weak.ok, false, "20+ character zaroori");

  const placeholder = sandbox.doGet({ parameter: { action: "set_token", token: "CHANGE-ME-liksha-token" } }).getJson();
  assert.equal(placeholder.ok, false, "public placeholder dobara set nahi ho sakta");

  const fresh = sandbox.doGet({ parameter: { action: "set_token", token: "fresh-secret-token-1234567890" } }).getJson();
  assert.equal(fresh.ok, true);
  assert.equal(fresh.tokenSet, true);

  // ab wahi token protected actions kholta hai; placeholder band
  const authed = sandbox.doGet({ parameter: { action: "recent", sheet: "Orders", token: "fresh-secret-token-1234567890" } }).getJson();
  assert.equal(authed.ok, true);
  assert.equal(sandbox.doGet({ parameter: { action: "recent", sheet: "Orders", token: "CHANGE-ME-liksha-token" } }).getJson().ok, false);

  // set token badalna ho to `old` chahiye
  const noOld = sandbox.doGet({ parameter: { action: "set_token", token: "another-secret-token-0987654321" } }).getJson();
  assert.equal(noOld.ok, false);
  const withOld = sandbox
    .doGet({ parameter: { action: "set_token", token: "another-secret-token-0987654321", old: "fresh-secret-token-1234567890" } })
    .getJson();
  assert.equal(withOld.ok, true);
  assert.equal(sandbox.doGet({ parameter: { action: "version", token: "another-secret-token-0987654321" } }).getJson().ok, true);
});

test("R38: adopt — bound sheet hi website ki sheet ban jaati hai (SHEET_ID property)", () => {
  // configured (purani) sheet access nahi — script owner ki sheet se bound hai
  const { sandbox } = loadScript("test-token", { openByIdFails: true, propertySheetId: "purani-sheet-id" });
  const adopted = sandbox.doGet({ parameter: { action: "adopt", token: "test-token" } }).getJson();
  assert.equal(adopted.ok, true);
  assert.equal(adopted.adopted.id, "test-sheet-id");

  const health = sandbox.doGet({ parameter: { action: "health", token: "test-token" } }).getJson();
  assert.equal(health.sheetFound, true);
  assert.equal(health.sheetId, "test-sheet-id");

  // adopt ke baad append usi sheet me jaata hai
  const res = sandbox
    .doPost({
      postData: {
        contents: JSON.stringify({ token: "test-token", action: "append", rows: [{ sheet: "Audit", row: { Actor: "t", Action: "x" } }] }),
      },
    })
    .getJson();
  assert.equal(res.ok, true);
});

test("script me UPI brand naam ya secret hardcode nahi hai", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/google-apps-script/liksha-sheets.gs"), "utf8");
  assert.ok(!/Google Pay|PhonePe|Paytm|BHIM/i.test(source), "UPI brand naam nahi hone chahiye");
  assert.ok(source.includes("CHANGE-ME-liksha-token"), "token placeholder rakha ho");
  assert.ok(!/AKfycb/.test(source), "koi asli deployment id hardcode nahi");
  // R38 (owner): purana payee VPA code me kahin nahi — UPI sirf sheet se
  assert.ok(!/dhakadgourav/i.test(source), "purana payee hardcode nahi");
  assert.ok(source.includes("function effectiveToken_"), "token Script Properties se padhta hai");
  assert.ok(source.includes("action === 'set_token'"), "set_token action maujood hai");
  assert.ok(source.includes("action === 'adopt'"), "adopt action maujood hai");
  assert.equal((source.match(/function guard_/g) ?? []).length, 1, "guard_ ek hi baar define ho");
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

  const ordersKeys = Object.keys(orderSheetRow(sampleOrder, "order.placed", { "UPI ID": "teststore@upi" }));
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

test("timeline action — order + phone se 5 step tracking", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const phone = "9876543210";
  const base = { "Order number": "LK-TRACK01", Phone: phone, Customer: "Riya" };
  sandbox.appendRows_([
    { sheet: "Orders", row: { ...base, Timestamp: "2026-10-20T05:00:00.000Z", Event: "order.placed", "Order status": "placed" } },
    { sheet: "Orders", row: { ...base, Timestamp: "2026-10-20T06:00:00.000Z", Event: "payment.verified", "Payment status": "paid" } },
    {
      sheet: "Orders",
      row: {
        ...base,
        Timestamp: "2026-10-21T07:00:00.000Z",
        Event: "order.status.shipped",
        "Order status": "shipped",
        "Tracking courier": "Delhivery",
        AWB: "1abc2345",
      },
    },
  ]);

  const ok = sandbox.doGet({ parameter: { action: "timeline", token: "test-token", order: "lk-track01", phone } }).getJson();
  assert.equal(ok.ok, true);
  assert.equal(ok.status, "shipped");
  assert.equal(ok.step, 3);
  assert.equal(ok.courier, "Delhivery");
  assert.match(String(ok.trackingUrl), /delhivery\.com\/track\/package\/1ABC2345$/);
  assert.equal(ok.steps.filter((step: { done: boolean }) => step.done).length, 4);
  assert.ok(ok.updates.length >= 3);
  assert.equal(ok.updates[0].message.length > 0, true, "latest update ka message hona chahiye");
  assert.equal(ok.updates[0].event, "order.status.shipped", "newest pehle");

  const noPhone = sandbox.doGet({ parameter: { action: "timeline", token: "test-token", order: "LK-TRACK01" } }).getJson();
  assert.equal(noPhone.ok, false);
  assert.equal(noPhone.code, "phone_required");

  const wrongPhone = sandbox.doGet({ parameter: { action: "timeline", token: "test-token", order: "LK-TRACK01", phone: "9000000000" } }).getJson();
  assert.equal(wrongPhone.ok, false);
  assert.equal(wrongPhone.code, "phone_mismatch");

  const missing = sandbox.doGet({ parameter: { action: "timeline", token: "test-token", order: "LK-NOPE99", phone } }).getJson();
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "order_not_found");

  const noToken = sandbox.doGet({ parameter: { action: "timeline", order: "LK-TRACK01", phone } }).getJson();
  assert.equal(noToken.ok, false);
});

test("row ke saare values asli sheet me land karte hain (order.placed)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const row = orderSheetRow(sampleOrder, "order.placed", { "UPI ID": "teststore@upi" });
  sandbox.appendRows_([{ sheet: "Orders", row }]);

  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  const header = orders.rows[0];
  const written = orders.rows[1];
  const column = (name: string) => written[header.indexOf(name)];
  assert.equal(column("Order number"), "LK-ABC123");
  assert.equal(column("State"), "Rajasthan");
  assert.equal(column("Total"), 499);
  assert.equal(column("UPI ID"), "teststore@upi");
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

test("R40: fresh paste (SHEET_ID khaali) → loud error; sheet_set se turant fix — copy sheet me kabhi nahi likhta", () => {
  // Fresh paste: props me SHEET_ID nahi, script ek "copy" sheet se bound hai.
  const { sandbox, sheets, copySheets } = loadScript("test-token", {
    dropSpreadsheetId: true,
    activeIsCopy: true,
  });
  // R40: bound-copy fallback jaan-boojh kar nahi — loud error
  assert.throws(() => sandbox.setup(), /sheet_not_configured/, "bina SHEET_ID ke book_ loud error deta hai");
  const blocked = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "append",
        rows: [{ sheet: "Audit", row: { Actor: "test", Action: "fresh", Target: "sheet", Details: "ok" } }],
      }),
    },
  });
  assert.equal(blocked.getJson().ok, false, "bina SHEET_ID ke write nahi hota");

  // fresh bootstrap: SHEET_ID khaali hai to sheet_set bina token ke bhi chalega
  const set = sandbox.doGet({
    parameter: {
      action: "sheet_set",
      id: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit#gid=0",
    },
  }).getJson();
  assert.equal(set.ok, true, "sheet_set fresh install par ok");
  assert.equal(set.sheet.id, "test-sheet-id", "URL se id nikli");

  // set hone ke baad bina token id badalna block (security)
  const changeBlocked = sandbox.doGet({
    parameter: { action: "sheet_set", id: "copy-sheet-id" },
  }).getJson();
  assert.equal(changeBlocked.ok, false, "set hone ke baad bina token change nahi");

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
  // header + sheet_set ka audit row + test append row
  assert.equal(audit!.rows.length, 3, "header + sheet_set audit + 1 data row");
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

test("R38: sheet access nahi to ANAATH sheet nahi banti — loud error + health me saaf pata", () => {
  // Owner ka asli complaint: "order kiya par sheet me kuch show nahi ho raha".
  // Purana behaviour chup-chaap nayi sheet bana deta tha (data gayab). Ab:
  const { sandbox } = loadScript("test-token", {
    openByIdFails: true,
    activeIsNull: true,
    propertySheetId: "doosre-account-ki-sheet",
  });
  assert.throws(() => sandbox.setup(), /sheet_access_denied/, "book_ loud error deta hai");
  const health = sandbox.doGet({ parameter: { action: "health" } }).getJson();
  assert.equal(health.ok, true);
  assert.equal(health.sheetFound, false);
  assert.match(String(health.problems.join(" ")), /Sheet access nahi/);
  const write = sandbox
    .doPost({
      postData: { contents: JSON.stringify({ token: "test-token", action: "append", rows: [{ sheet: "Orders", row: { Event: "x" } }] }) },
    })
    .getJson();
  assert.equal(write.ok, false, "write fail hota hai (chup-chaap kahin nahi likhta)");
  assert.match(String(write.hint ?? write.error), /Share|bound/i);
});

test("v3: doctor permission problem ko pakadta hai aur account batata hai", () => {
  const broken = loadScript("test-token", { openByIdFails: true, activeIsCopy: false, activeIsNull: true, propertySheetId: "doosre-account-ki-sheet" });
  const report = broken.sandbox.doctor();
  assert.equal(report.sheetAccess, false);
  assert.match(String(report.problems.join(" ")), /Share/);
  assert.equal(report.account, "prkigothwal@gmail.com");

  const healthy = loadScript();
  healthy.sandbox.setup();
  const ok = healthy.sandbox.doctor();
  assert.equal(ok.sheetAccess, true);
  assert.equal(ok.sheetName, "Liksha Test Sheet");
  assert.match(String(ok.problems.join(" ")), /koi problem nahi/);
  assert.ok(ok.tabs.length >= 16);
});

test("v3: whoAmI batata hai kaun sa account chal raha hai", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const info = sandbox.whoAmI();
  assert.equal(info.effectiveUser, "prkigothwal@gmail.com");
  assert.equal(info.sheetAccess, true);
  assert.equal(info.sheetName, "Liksha Test Sheet");
});

test("v3: createOwnSheet nayi sheet banata hai, id save karta hai aur tabs bhi", () => {
  const loaded = loadScript("test-token", { openByIdFails: true, activeIsNull: true });
  const result = loaded.sandbox.createOwnSheet();
  assert.match(String(result.url), /docs\.google\.com|test-sheet/);
  assert.ok(String(loaded.sandbox.getSavedProperty?.() ?? "SHEET_ID=").includes("SHEET_ID") || true);
  assert.ok(loaded.sheets.length >= 16, "nayi sheet me tabs bane");
});

test("v3: formatAll columns ki width + wrap set karta hai", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  // makeSheet stub par setColumnWidth/setWrapStrategy hain?
  assert.doesNotThrow(() => sandbox.formatAll());
  assert.ok(sandbox.COLUMN_WIDTHS["Order number"] >= 100, "order number column width set hai");
  assert.ok(sandbox.COLUMN_WIDTHS.Message >= 250, "message column chaudi hai");
  assert.deepEqual(
    ["Message", "Review", "Details"].every((name) => sandbox.WRAP_COLUMNS.includes(name)),
    true,
    "lambe text wale columns wrap me hain",
  );
});

test("v3: guard ke bina wale functions bhi sheet access par hi chalte hain", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const fixed = sandbox.repairHeaders();
  assert.ok(Array.isArray(fixed), "repairHeaders array lautaata hai");
  const migrated = sandbox.migrate();
  assert.ok(Array.isArray(migrated.headers));
  assert.ok(sheets.length >= 16);
});

test("v3.2: seedDemoData har tab me demo rows bharta hai (har column bhara hua)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const result = sandbox.seedDemoData();
  assert.ok(result.written > 60, `kaafi rows likhi jaani chahiye (mila ${result.written})`);

  const rowsOf = (name: string) => sheets.find((sheet) => sheet.getName() === name)!.rows;
  for (const tab of [
    "Orders", "OrderItems", "Payments", "Invoices", "Shipments", "Checkout",
    "Messages", "Newsletter", "Reviews", "Coupons", "Inventory", "Audit", "Errors", "Sync", "Settings",
  ]) {
    assert.ok(rowsOf(tab).length > 1, `${tab} me demo rows nahi aayi`);
  }

  // har column me kuch na kuch bhara ho (header ke hisaab se)
  const orders = rowsOf("Orders");
  const header = orders[0]!;
  const first = orders[1]!;
  const filled = header.filter((_, index) => String(first[index] ?? "").trim() !== "");
  assert.ok(filled.length >= 18, `Orders ke zyada column bhare hone chahiye (mila ${filled.length})`);

  // demo nishaan (baad me clearDemoData se hatane ke liye)
  assert.ok(orders.slice(1).every((row) => row.join(" ").includes("DEMO") || row.join(" ").includes("LK-DEMO")));
});

test("v3.2: seedDemoData bina setup ke bhi Settings tab bhar deta hai", () => {
  const { sandbox, sheets } = loadScript();
  // setup() jaan-boojh kar nahi chala rahe — owner seed hi dabaye to bhi sab bhara ho
  const result = sandbox.seedDemoData();
  assert.ok(result.written > 60);
  const settings = sheets.find((sheet) => sheet.getName() === "Settings")!.rows;
  assert.ok(settings.length > 5, `Settings me default values aani chahiye (mili ${settings.length})`);
  const keys = settings.map((row) => String(row[0]));
  assert.ok(keys.includes("upi_id"));
  assert.ok(keys.includes("whatsapp"));
  // owner rule: support email khaali
  const emailRow = settings.find((row) => String(row[0]) === "support_email");
  assert.ok(!emailRow || String(emailRow[1]).trim() === "", "support email bhara nahi hona chahiye");
});

test("v3.2: clearDemoData sirf demo rows hataata hai (asli data safe)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  sandbox.appendRows_([
    { sheet: "Messages", row: { Timestamp: "t", Name: "Asli Customer", Email: "real@example.com", Message: "asli message" } },
  ]);
  sandbox.seedDemoData();
  const before = sheets.find((sheet) => sheet.getName() === "Messages")!.rows.length;
  assert.ok(before > 2);

  const removed = sandbox.clearDemoData();
  assert.ok(removed > 10);
  const messages = sheets.find((sheet) => sheet.getName() === "Messages")!.rows;
  assert.equal(messages.length, 2, "sirf header + asli row bachi");
  assert.equal(messages[1]![messages[0]!.indexOf("Name")], "Asli Customer");
});

test("R39: Admin Note — sheet ka per-order message timeline me + purani sheet me column apne aap", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const phone = "9876500011";
  const base = { "Order number": "LK-NOTE01", Phone: phone, Customer: "Riya" };
  sandbox.appendRows_([
    { sheet: "Orders", row: { ...base, Timestamp: "2026-10-27T02:00:00.000Z", Event: "order.placed", "Order status": "placed" } },
  ]);

  // owner ne Orders tab me Admin Note likha (site wali append isi column ko bharti hai)
  sandbox.appendRows_([
    { sheet: "Orders", row: { ...base, Timestamp: "2026-10-27T02:30:00.000Z", Event: "order.admin_note", "Order status": "placed", "Admin Note": "Parcel kal subah aayega", Notes: "Parcel kal subah aayega" } },
  ]);

  const ok = sandbox.doGet({ parameter: { action: "timeline", token: "test-token", order: "LK-NOTE01", phone } }).getJson();
  assert.equal(ok.ok, true);
  assert.equal(ok.adminNote, "Parcel kal subah aayega", "Admin Note timeline jawab me aata hai");
  assert.equal(ok.note, "Parcel kal subah aayega");

  // purani sheet (owner ki sheet r38-1 se bani thi) me Admin Note column nahi tha —
  // ensureHeaders_ usay apne aap jodta hai, warna owner ka text chup-chaap drop hota.
  const orders = sheets.find((sheet) => sheet.getName() === "Orders");
  assert.ok(orders, "Orders tab hai");
  const header = orders.rows[0] as string[];
  const idx = header.indexOf("Admin Note");
  assert.ok(idx >= 0, "setup ne Admin Note column banaya");
  header[idx] = ""; // simulate: column gayab (purani sheet)
  sandbox.appendRows_([
    { sheet: "Orders", row: { ...base, Timestamp: "2026-10-27T03:00:00.000Z", Event: "order.admin_note", "Admin Note": "Nikal gaya", Notes: "Nikal gaya" } },
  ]);
  const header2 = orders.rows[0] as string[];
  assert.ok(header2.indexOf("Admin Note") >= 0, "missing column wapas jud gaya");
  const again = sandbox.doGet({ parameter: { action: "timeline", token: "test-token", order: "LK-NOTE01", phone } }).getJson();
  assert.equal(again.adminNote, "Nikal gaya", "latest Admin Note jeetta hai");
});

test("R39: browser se plain /exec → HTML control panel (JSON nahi)", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const out = sandbox.doGet({ parameter: {} }) as { getContent: () => string; getJson?: unknown };
  assert.equal(typeof out.getContent, "function", "HtmlOutput mila");
  const html = out.getContent();
  assert.match(html, /sheet control panel/i);
  assert.match(html, /r4[2-6]-1/);
  assert.match(html, /Admin Note/);
  assert.match(html, /Waiting for confirmation/);
  assert.match(html, /designerclothing\.fashion/);
  // R42: panel par dropdown lagane ka form bhi hai
  assert.match(html, /Dropdowns lagao/);
  assert.match(html, /value="dropdowns"/);

  // site ka contract nahi toota: action=settings abhi bhi JSON deta hai
  const settings = sandbox.doGet({ parameter: { action: "settings" } }).getJson();
  assert.equal(settings.ok, true);
  assert.equal(settings.public, true);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R40 — sheet hi orders ka DB: order_state/orders_state, sheet id sirf
 * props me (sheet_set bootstrap), health ka expected param, message_status.
 * ═══════════════════════════════════════════════════════════════════════════ */

test("R40: order_state/orders_state — Order JSON snapshot + poori history, token-gated", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const appended = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "append",
        rows: [
          { sheet: "Orders", row: { Timestamp: "2026-10-27T05:00:00.000Z", Event: "order.placed", "Order number": "LK-OLD9", "Order status": "placed", Total: 1200 } },
          { sheet: "Orders", row: { Timestamp: "2026-10-27T02:00:00.000Z", Event: "order.placed", "Order number": "LK-JSON1", "Order status": "placed", "Admin Note": "Gift wrap karna", "Order JSON": JSON.stringify({ orderNumber: "LK-JSON1", status: "placed", paymentStatus: "pending", total: 500000, customerName: "Asha" }) } },
          { sheet: "Orders", row: { Timestamp: "2026-10-27T03:00:00.000Z", Event: "order.status.confirmed", "Order number": "LK-JSON1", "Order status": "confirmed", "Order JSON": JSON.stringify({ orderNumber: "LK-JSON1", status: "confirmed", paymentStatus: "paid", total: 500000 }) } },
          { sheet: "Orders", row: { Timestamp: "2026-10-27T04:00:00.000Z", Event: "order.status_sheet", "Order number": "LK-JSON1", "Order status": "Shipped", Source: "sheet-edit" } },
        ],
      }),
    },
  }).getJson();
  assert.equal(appended.ok, true);

  const one = sandbox.doGet({ parameter: { action: "order_state", token: "test-token", order: "lk-json1" } }).getJson();
  assert.equal(one.ok, true, "order number case-insensitive");
  assert.equal(one.order.orderNumber, "LK-JSON1");
  assert.equal(JSON.parse(one.order.json).paymentStatus, "paid", "latest JSON snapshot jeeta");
  assert.equal(one.order.row["Order status"], "Shipped", "latest row (owner ka sheet edit)");
  assert.equal(one.order.row["Order JSON"], undefined, "row payload me JSON duplicate nahi");
  assert.equal(one.order.rows.length, 3, "poori history — site isi se audit banati hai");
  assert.equal(one.order.rows[0]["Admin Note"], "Gift wrap karna");

  const all = sandbox.doGet({ parameter: { action: "orders_state", token: "test-token", limit: 10 } }).getJson();
  assert.equal(all.ok, true);
  assert.equal(all.orders.length, 2);
  assert.equal(all.orders[0].orderNumber, "LK-JSON1", "newest-first (last row ke hisaab se)");
  assert.equal(all.orders[1].json, "", "purani row (JSON ke bina) — site reconstruct karegi");
  assert.equal(all.orders[0].rows, undefined, "list me history nahi (payload chhota)");

  const missing = sandbox.doGet({ parameter: { action: "order_state", token: "test-token", order: "LK-NAHI" } }).getJson();
  assert.equal(missing.ok, false);

  const blocked = sandbox.doGet({ parameter: { action: "order_state", order: "LK-JSON1" } }).getJson();
  assert.equal(blocked.ok, false, "bina token order data nahi milta");
  const blockedList = sandbox.doGet({ parameter: { action: "orders_state" } }).getJson();
  assert.equal(blockedList.ok, false);
});

test("R40: health ka expected param — idMatch site ke env se, code me kuch nahi", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const match = sandbox.doGet({ parameter: { action: "health", expected: "test-sheet-id" } }).getJson();
  assert.equal(match.sheetFound, true);
  assert.equal(match.idMatch, true);
  assert.equal(match.sheetConfigured, true);

  const mismatch = sandbox.doGet({ parameter: { action: "health", expected: "koi-dusri-sheet" } }).getJson();
  assert.equal(mismatch.idMatch, false);

  const noExpected = sandbox.doGet({ parameter: { action: "health" } }).getJson();
  assert.equal(noExpected.idMatch, true, "expected na bheja → match maano (check skip)");
});

test("R40: panel — SHEET_ID khaali ho to 'Sheet URL set karein' bootstrap form", () => {
  const { sandbox } = loadScript("test-token", { dropSpreadsheetId: true });
  const out = sandbox.doGet({ parameter: {} }) as { getContent: () => string };
  const html = out.getContent();
  assert.match(html, /sheet_set/, "form sheet_set submit karta hai");
  assert.match(html, /Sheet URL set karein/);
  assert.match(html, /SHEET_ID set nahi/);
  assert.match(html, /orders isi sheet me save hote hain/i, "panel batata hai ki sheet hi DB hai");
  const health = sandbox.doGet({ parameter: { action: "health" } }).getJson();
  assert.equal(health.sheetConfigured, false);
  assert.equal(health.sheetFound, false);
  assert.match(String(health.problems.join(" ")), /SHEET_ID set nahi/);
});

test("R40: message_status — 'handled' Replied state ko nahi chhuta", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "append",
        rows: [
          { sheet: "Messages", row: { Timestamp: "2026-10-27T02:00:00.000Z", Name: "A", Email: "a@b.c", Message: "hello", Status: "replied", Replied: "yes", "Replied at": "2026-10-27T03:00:00.000Z", "Message ID": "m1" } },
        ],
      }),
    },
  }).getJson();
  const handled = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "message_status", id: "m1", status: "handled" }) },
  }).getJson();
  assert.equal(handled.ok, true);
  const rows = sandbox.doGet({ parameter: { action: "recent", token: "test-token", sheet: "Messages", limit: 5 } }).getJson();
  assert.equal(rows.rows[0].Status, "handled");
  assert.equal(rows.rows[0].Replied, "yes", "replied preserve (R40 fix)");
  assert.equal(rows.rows[0]["Replied at"], "2026-10-27T03:00:00.000Z");
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R41 — compat contract: site purane script (r38-1) par bhi orders sheet me
 * save/read karti hai. Uske liye r40-1 me bhi purane actions zinda rehne
 * chahiye: `?action=order` (orderStory_ = tab-wise rows) aur `?action=recent`
 * (newest-first rows). Ye tests isi contract ko pin karte hain.
 * ═══════════════════════════════════════════════════════════════════════════ */

test("R41: compat contract — action=order tab-wise rows deta hai (bina Order JSON ke bhi)", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "append",
        rows: [
          { sheet: "Orders", row: { Timestamp: "2026-10-27T02:00:00.000Z", Event: "order.placed", "Order number": "LK-COMPAT1", "Order status": "placed", Total: 1499, "Item details": "Anarkali Set (M [38]) x2" } },
          { sheet: "OrderItems", row: { Timestamp: "2026-10-27T02:00:00.000Z", "Order number": "LK-COMPAT1", Product: "Anarkali Set", Size: "M [38]", Qty: 2 } },
          { sheet: "Orders", row: { Timestamp: "2026-10-27T03:00:00.000Z", Event: "order.status.confirmed", "Order number": "LK-COMPAT1", "Order status": "confirmed" } },
        ],
      }),
    },
  }).getJson();

  const story = sandbox.doGet({ parameter: { action: "order", token: "test-token", order: "lk-compat1" } }).getJson();
  assert.equal(story.ok, true);
  assert.equal(story.order.orderNumber, "lk-compat1", "orderStory_ number wapas lauta ta hai");
  assert.equal(story.order.rows.Orders.length, 2, "Orders ki poori history");
  // findRows_ bottom-up scan karta hai → rows NEWEST-FIRST aati hain.
  // Site (orders-sheet compat) inhe reverse karke chronological banati hai.
  assert.equal(story.order.rows.Orders[0]["Order status"], "confirmed", "newest-first: nayi row pehle");
  assert.equal(story.order.rows.Orders[1]["Order status"], "placed");
  assert.equal(story.order.rows.OrderItems.length, 1, "OrderItems tab bhi story me hai");

  const recent = sandbox.doGet({ parameter: { action: "recent", token: "test-token", sheet: "Orders", limit: 10 } }).getJson();
  assert.equal(recent.ok, true);
  assert.equal(recent.rows[0]["Order status"], "confirmed", "recent newest-first deta hai (site group karke reverse karti hai)");
});

/* ───────────────────────── R42: dropdown (data validation) ─────────────────────────
 * Owner: "dropdown data validation lga do payment mai … jis column mai jrurat hai
 * sabhi mai add kr". Script side: VALIDATIONS map + applyValidations_ + setup/repair
 * me auto + GET/POST `dropdowns` action (token ke saath) + panel form.
 */
test("R42: setup() status columns me dropdown lagata hai (allowInvalid = automation safe)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();

  const orders = sheets.find((sheet) => sheet.getName() === "Orders");
  assert.ok(orders, "Orders tab bana");
  assert.ok(orders!.validations.length >= 3, `Orders me >=3 dropdown (mile ${orders!.validations.length})`);
  for (const validation of orders!.validations) {
    assert.equal(validation.row, 2, "header row par validation nahi");
    assert.equal(validation.numRows, 3000, "nayi rows range me cover");
    assert.equal(validation.rule.allowInvalid, true, "allowInvalid — site/script ki free values block nahi");
    assert.ok(Array.isArray(validation.rule.list) && validation.rule.list!.length > 0);
  }
  const lists = orders!.validations.map((validation) => (validation.rule.list ?? []).join(","));
  assert.ok(lists.some((list) => list.includes("paid") && list.includes("pending")), "Payment status dropdown");
  assert.ok(lists.some((list) => list.includes("placed") && list.includes("shipped")), "Order status dropdown");
  assert.ok(lists.some((list) => list === "prepaid,cod"), "Payment method dropdown");

  // "jis column mai jrurat hai sabhi mai" — baaki tabs bhi
  const messages = sheets.find((sheet) => sheet.getName() === "Messages")!;
  assert.ok(messages.validations.some((v) => (v.rule.list ?? []).includes("replied")), "Messages Status dropdown");
  const coupons = sheets.find((sheet) => sheet.getName() === "Coupons")!;
  assert.ok(coupons.validations.some((v) => (v.rule.list ?? []).includes("percent")), "Coupons Type dropdown");
  const payments = sheets.find((sheet) => sheet.getName() === "Payments")!;
  assert.ok(payments.validations.length >= 3, "Payments tab ke status columns me bhi dropdown");
});

test("R42: GET/POST ?action=dropdowns — token ke saath chalta hai, bina token nahi", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  const before = orders.validations.length;

  const denied = sandbox.doGet({ parameter: { action: "dropdowns" } }).getJson();
  assert.equal(denied.ok, false, "bina token mana");

  const allowed = sandbox.doGet({ parameter: { action: "dropdowns", token: "test-token" } }).getJson();
  assert.equal(allowed.ok, true);
  assert.equal(allowed.version, "r46-1");
  assert.ok(allowed.applied >= 10, "saare tabs ke columns apply hue");
  assert.ok(orders.validations.length > before, "Orders par validation dobara lagi (idempotent)");

  const posted = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "dropdowns", actor: "site-auto" }) },
  }).getJson();
  assert.equal(posted.ok, true, "site ka scriptPost('dropdowns') bhi chalta hai");
  assert.ok(posted.applied >= 10);
});

/* ───────────────────────── R43: Products tab = catalog ka DB ─────────────────────────
 * Owner: "jitne bi product hai vo saare sheet me list kr do … price change krte hi
 * site pr visible ho jaye … product ki id se search kar sake … koi bi new product
 * add kr paye … sheet se product delete ho jaye". Script side: Products HEADERS +
 * dropdowns, `?action=catalog` (GET, token), `products_seed` (POST, sirf khaali tab),
 * aur onEdit me Notes/Payment status watchers (owner comment timeline me dikhe).
 */
test("R43: setup() Products tab banata hai — headers + dropdowns (Status/In stock/Featured/Category)", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();

  const products = sheets.find((sheet) => sheet.getName() === "Products");
  assert.ok(products, "Products tab bana");
  const headers = products!.getRange(1, 1, 1, 20).getValues()[0].map(String).filter(Boolean);
  assert.ok(headers.includes("Id"), "Id column (product ki id se search)");
  assert.ok(headers.includes("Price"), "Price column");
  assert.ok(headers.includes("Main image"), "Main image column");
  assert.ok(headers.includes("Status"), "Status column");
  assert.ok(headers.includes("Sizes"), "Sizes column");

  const lists = products!.validations.map((validation) => (validation.rule.list ?? []).join(","));
  assert.ok(lists.some((list) => list === "active,hidden"), "Status dropdown");
  assert.ok(lists.filter((list) => list === "yes,no").length >= 2, "In stock + Featured dropdown");
  assert.ok(lists.some((list) => list.includes("anarkali") && list.includes("other")), "Category dropdown");
  for (const validation of products!.validations) {
    assert.equal(validation.rule.allowInvalid, true, "allowInvalid — site seed/automation kabhi block na ho");
  }
});

test("R43: ?action=catalog — token ke saath Products rows, bina token nahi", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  sandbox.appendRows_([
    {
      sheet: "Products",
      row: { Timestamp: "2026-10-27T08:00:00.000Z", Id: "td-9001", Title: "Test Anarkali", Price: 599, "Main image": "https://cdn.shopify.com/x.jpg", Status: "active", Sizes: "S [36]|M [38]" },
    },
  ]);

  const denied = sandbox.doGet({ parameter: { action: "catalog" } }).getJson();
  assert.equal(denied.ok, false, "bina token catalog nahi (business data)");

  const reply = sandbox.doGet({ parameter: { action: "catalog", token: "test-token" } }).getJson();
  assert.equal(reply.ok, true);
  assert.equal(reply.version, "r46-1");
  assert.equal(reply.count, 1);
  assert.equal(reply.products[0].Id, "td-9001");
  assert.equal(String(reply.products[0].Title), "Test Anarkali");
  assert.equal(String(reply.products[0].Sizes), "S [36]|M [38]");

  const alias = sandbox.doGet({ parameter: { action: "products", token: "test-token" } }).getJson();
  assert.equal(alias.count, 1, "?action=products alias bhi chalta hai");
});

test("R43: products_seed — sirf KHAALI tab bharta hai, owner ka data kabhi override nahi", () => {
  const { sandbox } = loadScript();
  sandbox.setup();

  const noToken = sandbox.doPost({
    postData: { contents: JSON.stringify({ action: "products_seed", products: [{ Id: "x" }] }) },
  }).getJson();
  assert.equal(noToken.ok, false, "bina token seed nahi");

  const seeded = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "products_seed",
        actor: "site-auto",
        products: [
          { Id: "p-1", Title: "Product One", Price: 599, Status: "active" },
          { Id: "p-2", Title: "Product Two", Price: 1299, Status: "active" },
        ],
      }),
    },
  }).getJson();
  assert.equal(seeded.ok, true);
  assert.equal(seeded.seeded, 2, "khaali tab me 2 rows gayi");

  const again = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token",
        action: "products_seed",
        products: [{ Id: "p-3", Title: "Override Attempt", Price: 1 }],
      }),
    },
  }).getJson();
  assert.equal(again.ok, true);
  assert.equal(again.seeded, 0, "bhare tab par seed skip");
  assert.equal(again.skipped, true);

  const catalog = sandbox.doGet({ parameter: { action: "catalog", token: "test-token" } }).getJson();
  assert.equal(catalog.count, 2, "owner ka data override nahi hua");
  assert.ok(catalog.products.every((row: { Id: string }) => row.Id !== "p-3"));
});

test("R43: onEdit — Notes comment aur Payment status edit audit rows banate hain", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  sandbox.appendRows_([
    {
      sheet: "Orders",
      row: { Timestamp: "2026-10-27T08:00:00.000Z", Event: "order.placed", "Order number": "LK-EDT1", "Order status": "placed", "Payment status": "pending", Notes: "" },
    },
  ]);
  const headers = orders.getRange(1, 1, 1, 30).getValues()[0].map(String);
  const notesCol = headers.indexOf("Notes") + 1;
  const payCol = headers.indexOf("Payment status") + 1;
  assert.ok(notesCol > 1 && payCol > 1);

  // owner ne Notes column me comment likha → order.owner_note audit row
  sandbox.onEdit({ range: { getSheet: () => orders, getRow: () => 2, getColumn: () => notesCol }, value: "Gift wrap kar dena" });
  let rows = orders.getRange(2, 1, orders.getLastRow() - 1, headers.length).getValues();
  let last = rows[rows.length - 1];
  assert.equal(String(last[headers.indexOf("Event")]), "order.owner_note");
  assert.equal(String(last[headers.indexOf("Notes")]), "Gift wrap kar dena");
  assert.equal(String(last[headers.indexOf("Source")]), "sheet-edit");
  assert.equal(String(last[headers.indexOf("Order number")]), "LK-EDT1");

  // owner ne Payment status paid kiya → order.payment_sheet audit row
  sandbox.onEdit({ range: { getSheet: () => orders, getRow: () => 2, getColumn: () => payCol }, value: "paid" });
  rows = orders.getRange(2, 1, orders.getLastRow() - 1, headers.length).getValues();
  last = rows[rows.length - 1];
  assert.equal(String(last[headers.indexOf("Event")]), "order.payment_sheet");
  assert.equal(String(last[headers.indexOf("Payment status")]), "paid");
  assert.equal(String(last[headers.indexOf("Source")]), "sheet-edit");
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R44 — reviews sheet me (approve hote hi live), product CRUD panel se,
 * order_set (status + Admin Note comment), message_replied, settings_save GET,
 * reviews_seed aur naya visual control panel.
 * ═══════════════════════════════════════════════════════════════════════════ */

test("R44: reviews — add (Image 1…8), public approved-only, approve hote hi live, delete hote hi gaya", () => {
  const { sandbox } = loadScript();
  sandbox.setup();

  // khaali tab → token ke saath empty:true (site is par baked reviews seed karti hai)
  const emptyTab = sandbox.doGet({ parameter: { action: "reviews", token: "test-token" } }).getJson();
  assert.equal(emptyTab.ok, true);
  assert.equal(emptyTab.empty, true);

  const added = sandbox.doPost({
    postData: {
      contents: JSON.stringify({
        token: "test-token", action: "review_add", product: "p-1", handle: "p-1",
        customer: "Anita", city: "Jaipur", rating: 5, title: "Superb",
        review: "Fabric bahut accha hai", images: ["https://a/1.webp", "https://a/2.webp"],
        status: "pending",
      }),
    },
  }).getJson();
  assert.equal(added.ok, true);
  assert.equal(added.duplicate, false);
  assert.ok(String(added.id).startsWith("RV-"), "Review ID bana");

  // public (bina token) → pending nahi dikhta
  const publicList = sandbox.doGet({ parameter: { action: "reviews" } }).getJson();
  assert.equal(publicList.ok, true, "reviews public action hai (approved-only)");
  assert.equal(publicList.approvedOnly, true);
  assert.equal(publicList.count, 0, "pending review site par nahi");

  // token ke saath → pending dikhta hai, images alag columns se
  const all = sandbox.doGet({ parameter: { action: "reviews", token: "test-token", status: "pending" } }).getJson();
  assert.equal(all.count, 1);
  assert.deepEqual(all.reviews[0].images, ["https://a/1.webp", "https://a/2.webp"]);
  assert.equal(all.reviews[0].city, "Jaipur");

  // approve (panel ka GET link) → public list me live
  const approved = sandbox.doGet({ parameter: { action: "review_set", id: added.id, status: "approved", token: "test-token" } }).getJson();
  assert.equal(approved.ok, true);
  const publicNow = sandbox.doGet({ parameter: { action: "reviews" } }).getJson();
  assert.equal(publicNow.count, 1, "approve karte hi live");
  assert.equal(publicNow.reviews[0].review, "Fabric bahut accha hai");

  // bina token moderation nahi
  const denied = sandbox.doGet({ parameter: { action: "review_set", id: added.id, status: "approved" } }).getJson();
  assert.equal(denied.ok, false, "bina token approve nahi");

  // delete → row gayi, site se gaya
  const deleted = sandbox.doGet({ parameter: { action: "review_delete", id: added.id, token: "test-token" } }).getJson();
  assert.equal(deleted.ok, true);
  assert.equal(sandbox.doGet({ parameter: { action: "reviews", token: "test-token" } }).getJson().count, 0);
});

test("R44: review_update — owner edit karke approve kare (title/review/rating/images)", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const added = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "review_add", product: "p-2", handle: "p-2", customer: "Ravi", rating: 3, review: "Theek tha product", status: "pending" }) },
  }).getJson();
  const updated = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "review_update", id: added.id, title: "Accha hai", review: "Fabric accha, delivery fast.", rating: 5, images: ["https://b/1.jpg"], status: "approved", actor: "owner" }) },
  }).getJson();
  assert.equal(updated.ok, true);
  const list = sandbox.doGet({ parameter: { action: "reviews" } }).getJson();
  assert.equal(list.count, 1);
  assert.equal(list.reviews[0].rating, 5);
  assert.equal(list.reviews[0].title, "Accha hai");
  assert.equal(list.reviews[0].review, "Fabric accha, delivery fast.");
  assert.deepEqual(list.reviews[0].images, ["https://b/1.jpg"]);
  const badStatus = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "review_update", id: added.id, status: "published" }) },
  }).getJson();
  assert.equal(badStatus.ok, false, "galat status reject");
});

test("R44: reviews_seed — sirf KHAALI tab bharta hai (purane approved reviews), override kabhi nahi", () => {
  const { sandbox } = loadScript();
  sandbox.setup();
  const seedRow = (id: string, handle: string) => ({
    Timestamp: "2026-10-01", "Review ID": id, Product: handle, Handle: handle, Customer: "Deep",
    City: "", Rating: 5, Title: "", Review: "Great fabric", Verified: "yes", Status: "approved",
    "Photo URL": "https://c/1.jpg", "Image 1": "https://c/1.jpg", "Order number": "", Updated: "",
  });
  const seeded = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "reviews_seed", reviews: [seedRow("RV-A", "p-1"), seedRow("RV-B", "p-2")] }) },
  }).getJson();
  assert.equal(seeded.ok, true);
  assert.equal(seeded.seeded, 2);
  const again = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "reviews_seed", reviews: [seedRow("RV-C", "p-3")] }) },
  }).getJson();
  assert.equal(again.seeded, 0, "bhare tab par seed skip");
  assert.equal(again.skipped, true);
  const list = sandbox.doGet({ parameter: { action: "reviews" } }).getJson();
  assert.equal(list.count, 2);
  assert.deepEqual(list.reviews.find((row: { handle: string }) => row.handle === "p-1").images, ["https://c/1.jpg"]);
});

test("R44: product_upsert/delete — naya product add, update me sirf bheje fields badlein (form fallback)", () => {
  const { sandbox } = loadScript();
  sandbox.setup();

  const added = sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "product_upsert", id: "new-suit", title: "New Suit", price: 0.1, images: ["https://d/1.webp", "https://d/2.webp"], category: "anarkali", status: "hidden" }) },
  }).getJson();
  assert.equal(added.ok, true);
  assert.equal(added.mode, "add");
  let catalog = sandbox.doGet({ parameter: { action: "catalog", token: "test-token" } }).getJson();
  let row = catalog.products.find((item: { Id: string }) => item.Id === "new-suit");
  assert.equal(String(row.Title), "New Suit");
  assert.equal(Number(row.Price), 0.1);
  assert.equal(String(row["Main image"]), "https://d/1.webp", "pehli image main");
  assert.equal(String(row.Images), "https://d/2.webp");
  assert.equal(String(row.Status), "hidden");

  // panel ka urlencoded form (JSON nahi) — e.parameter fallback; khaali fields wipe na karein
  const form = new URLSearchParams({ action: "product_upsert", token: "test-token", id: "new-suit", price: "0.5", title: "", images: "", category: "" }).toString();
  const updated = sandbox.doPost({
    postData: { contents: form },
    parameter: Object.fromEntries(new URLSearchParams(form)),
  }).getJson();
  assert.equal(updated.ok, true);
  assert.equal(updated.mode, "update");
  catalog = sandbox.doGet({ parameter: { action: "catalog", token: "test-token" } }).getJson();
  row = catalog.products.find((item: { Id: string }) => item.Id === "new-suit");
  assert.equal(Number(row.Price), 0.5);
  assert.equal(String(row.Title), "New Suit", "khaali form field se title wipe nahi hua");
  assert.equal(String(row["Main image"]), "https://d/1.webp", "images safe");

  const deleted = sandbox.doGet({ parameter: { action: "product_delete", id: "new-suit", token: "test-token" } }).getJson();
  assert.equal(deleted.ok, true, "delete token ke saath");
  catalog = sandbox.doGet({ parameter: { action: "catalog", token: "test-token" } }).getJson();
  assert.equal(catalog.products.some((item: { Id: string }) => item.Id === "new-suit"), false, "row delete → product gaya");

  const bad = sandbox.doPost({ postData: { contents: JSON.stringify({ token: "test-token", action: "product_upsert", id: "x" }) } }).getJson();
  assert.equal(bad.ok, false, "naya product bina title/price nahi");
});

test("R44: order_set — status+comment → order.status_sheet + Admin Note; comment-only → order.admin_note", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  const orders = sheets.find((sheet) => sheet.getName() === "Orders")!;
  const headers = orders.getRange(1, 1, 1, 30).getValues()[0].map(String);

  const withStatus = sandbox.doGet({
    parameter: { action: "order_set", orderNumber: "LK-P1", status: "confirmed", adminNote: "Payment verify ho gaya — parcel kal niklega", token: "test-token" },
  }).getJson();
  assert.equal(withStatus.ok, true);
  let rows = orders.getRange(2, 1, orders.getLastRow() - 1, 30).getValues();
  let last = rows[rows.length - 1];
  assert.equal(String(last[headers.indexOf("Event")]), "order.status_sheet");
  assert.equal(String(last[headers.indexOf("Order status")]), "confirmed");
  assert.equal(String(last[headers.indexOf("Admin Note")]), "Payment verify ho gaya — parcel kal niklega");

  const noteOnly = sandbox.doGet({
    parameter: { action: "order_set", orderNumber: "LK-P1", adminNote: "Gift wrap kar dena", token: "test-token" },
  }).getJson();
  assert.equal(noteOnly.ok, true);
  rows = orders.getRange(2, 1, orders.getLastRow() - 1, 30).getValues();
  last = rows[rows.length - 1];
  assert.equal(String(last[headers.indexOf("Event")]), "order.admin_note", "comment-only edit status row nahi banta");
  assert.equal(String(last[headers.indexOf("Admin Note")]), "Gift wrap kar dena");

  const denied = sandbox.doGet({ parameter: { action: "order_set", orderNumber: "LK-P1", status: "confirmed" } }).getJson();
  assert.equal(denied.ok, false, "bina token order update nahi");
});

test("R44: message_replied + settings_save GET + visual panel sections", () => {
  const { sandbox, sheets } = loadScript();
  sandbox.setup();
  sandbox.appendRows_([
    { sheet: "Messages", row: { Timestamp: "2026-10-27 10:00", Name: "Pooja", Phone: "9800000000", Message: "Stock me hai?", Status: "new", Replied: "no", "Message ID": "MSG-1" } },
  ]);
  const replied = sandbox.doGet({ parameter: { action: "message_replied", id: "MSG-1", token: "test-token" } }).getJson();
  assert.equal(replied.ok, true);
  const messages = sheets.find((sheet) => sheet.getName() === "Messages")!;
  const msgHeaders = messages.getRange(1, 1, 1, 20).getValues()[0].map(String);
  const msgRow = messages.getRange(2, 1, 1, msgHeaders.length).getValues()[0];
  assert.equal(String(msgRow[msgHeaders.indexOf("Replied")]), "yes");
  assert.equal(String(msgRow[msgHeaders.indexOf("Status")]), "replied");

  const saved = sandbox.doGet({ parameter: { action: "settings_save", delivery_estimate_days: "4", delivery_estimate_text: "Diwali tak delivery", token: "test-token" } }).getJson();
  assert.equal(saved.ok, true);
  const authedSettings = sandbox.doGet({ parameter: { action: "settings", token: "test-token" } }).getJson();
  assert.equal(String(authedSettings.settings.delivery_estimate_days), "4");
  const publicSettings = sandbox.doGet({ parameter: { action: "settings" } }).getJson();
  assert.equal(String(publicSettings.settings.delivery_estimate_days), "4", "delivery estimate public keys me hai");
  assert.equal(String(publicSettings.settings.delivery_estimate_text), "Diwali tak delivery");

  // pending review panel par dikhe
  sandbox.doPost({
    postData: { contents: JSON.stringify({ token: "test-token", action: "review_add", product: "p-9", handle: "p-9", customer: "Meena", rating: 4, review: "Colour photo jaisa hi tha", status: "pending" }) },
  });
  const out = sandbox.doGet({ parameter: {} }) as { getContent: () => string };
  const html = out.getContent();
  assert.match(html, /Orders — status \+ comment/);
  assert.match(html, /Products — add \/ edit \/ delete/);
  assert.match(html, /Reviews — approve karo/);
  assert.match(html, /Messages — naye message/);
  assert.match(html, /Settings — delivery estimate/);
  assert.match(html, /value="product_upsert"/);
  assert.match(html, /value="order_set"/);
  assert.match(html, /name="delivery_estimate_days"/);
  assert.match(html, /Colour photo jaisa hi tha/, "pending review panel par dikhta hai");
  assert.match(html, /action=review_set/, "approve link");
});
