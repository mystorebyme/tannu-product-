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

function loadScript(token = "test-token") {
  const file = path.join(process.cwd(), "scripts/google-apps-script/liksha-sheets.gs");
  const source = fs.readFileSync(file, "utf8").replace(
    "var TOKEN = 'CHANGE-ME-liksha-token';",
    `var TOKEN = '${token}';`,
  );
  assert.ok(source.includes(`var TOKEN = '${token}';`), "token replace hua");

  const sheets: ReturnType<typeof makeSheet>[] = [];
  const book = {
    getName: () => "Liksha Test Sheet",
    getSheets: () => sheets,
    getSheetByName: (name: string) => sheets.find((sheet) => sheet.getName() === name) ?? null,
    insertSheet: (name: string) => {
      const sheet = makeSheet(name, 1000 + sheets.length);
      sheets.push(sheet);
      return sheet;
    },
    toast: () => {},
  };

  const sandbox: Record<string, unknown> = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book },
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
  return { sandbox: sandbox as Record<string, any>, sheets, book };
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
