/**
 * Round 40 (27 Oct 2026) — owner, live site par order fail hone ke baad:
 *
 *  1. "**supabase pr nhai chiye yrr sheet mai hi chiye** ok proper working abhi
 *     supbase chl rhai hia **usko htao ok only sheet**" — orders ka store ab
 *     **sirf Google Sheet** hai (Orders tab + `Order JSON` snapshot column).
 *     Owner ne Supabase DB delete kar diya tha; site "Order server par save
 *     nahi hua" dikha rahi thi.
 *  2. "**order krne ke baad bi new order krne pr vo old order jo cache mai save
 *     hai unko hi de detha** ia fix kro" — checkout me purana `?order=` URL
 *     param naye cart ko hijack kar leta tha (staleResume guard).
 *  3. "**google sheet ka koi bi chij hardcoded nhai honi chiye ok koi bi nhia
 *     means koi bi nhai jo jo change ho immidate dikhne chiye**" — sheet ka id
 *     ab na code me, na script me: sirf Script Properties (`SHEET_ID`) +
 *     Vercel env (`SHEET_EXPECTED_ID`), badalna = panel form / sheet_set /
 *     adopt, turant asar.
 *  4. "merge mt kro bar bar" — is round ka ek hi commit/PR/merge/deploy hai.
 *
 * Ye guards source-level hain + parse/overlay behaviour pure functions par
 * (sheet-merge.ts) test hota hai — network layer apps-script harness me.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { orderFromSheetRows, parseOrderState, type OrderState } from "../../apps/web/src/lib/sheet-merge";
import type { Order } from "@liksha/types";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const FINAL_SHEET_ID = "1b8DReh2RF5JeOSJeknWmH1KSE1RZgmBjatgkCDS9w_4";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "oid-1",
    orderNumber: "LK-TEST1",
    createdAt: "2026-10-27T02:00:00.000Z",
    customerName: "Asha Devi",
    email: "asha@example.com",
    phone: "9812345678",
    address: "12 MG Road",
    city: "Alwar",
    state: "Rajasthan",
    pincode: "301001",
    notes: null,
    items: [
      { handle: "h1", title: "Anarkali Set", image: "", size: "M [38]", quantity: 1, price: 499900 },
    ],
    subtotal: 499900,
    discount: 0,
    shipping: 0,
    total: 499900,
    couponCode: null,
    paymentMethod: "prepaid",
    paymentStatus: "pending",
    payment: {
      gateway: "pending",
      reference: null,
      amount: 499900,
      status: "pending",
      createdAt: "2026-10-27T02:00:00.000Z",
      verifiedAt: null,
      verifiedBy: null,
      failureReason: null,
    },
    status: "placed",
    audit: [],
    ...overrides,
  };
}

/* ── 1. Sheet = orders ka DB (backend + write/read paths) ─────────────────── */

test("R40: orders-sheet — backend priority sheet-first, version gate r40+, JSON snapshot write", () => {
  const lib = read("apps/web/src/lib/orders-sheet.ts");
  assert.match(lib, /export const SHEET_ORDERS_MIN_MAJOR = 40;/, "r40 se pehle ka script sheet-DB nahi chala sakta");
  assert.match(lib, /if \(sheetOrdersConfigured\(\)\) return "sheet";/, "sheet configured = sheet jeetta hai");
  assert.match(lib, /if \(dbEnabled\(\)\) return "postgres";/, "uske baad postgres");
  assert.match(lib, /process\.env\.ORDERS_STORE/, "env override (tests/dev ke liye json force)");
  assert.match(lib, /"Order JSON": JSON\.stringify\(snapshot\)/, "har event row me poora order snapshot");
  assert.match(lib, /audit: \[\]/, "snapshot me audit nahi — rows khud event log hain (cell size chhoti)");
  assert.match(lib, /action === "order_state"|order_state/, "single-order read action");
  assert.match(lib, /orders_state/, "list read action");
  assert.match(lib, /invalidateSheetOrder\(order\.orderNumber\)/, "write ke baad read cache fresh");
});

test("R40: orders.ts — createOrder sheet par await save, fail = honest error (aadha order nahi)", () => {
  const lib = read("apps/web/src/lib/orders.ts");
  assert.match(lib, /ordersBackend\(\)/, "backend selector wire hai");
  assert.match(lib, /const saved = await persistOrderEvent\(order, "order\.placed", \{ items: true \}\);/, "order.placed AWAIT hota hai");
  assert.match(lib, /sheet_store_not_ready/, "script purana/down = saaf 503");
  assert.match(lib, /sheet_write_failed/, "sheet write fail = order fail, jhootha success nahi");
  assert.match(lib, /WhatsApp par order bhej dijiye/, "customer ke liye fallback raasta");
  // writeAll: sirf badla hua order sheet par jaata hai (diff by snapshot)
  assert.match(lib, /const previous = lastSnapshot\.get\(order\.orderNumber\);/, "writeAll diff karta hai");
  assert.match(lib, /order\.audit\[0\]\?\.action \?\? "order\.updated"/, "event naam audit se");
  // DB-mode wale background mirrors sheet mode me double-write nahi karte
  const guards = lib.match(/ordersBackend\(\) !== "sheet"/g) ?? [];
  assert.ok(guards.length >= 7, "explicit syncOrderToSheet calls sheet mode me skip hote hain");
  // reads
  assert.match(lib, /return \(await readSheetOrder\(wanted\)\) \?\? undefined;/, "getOrder sheet se");
  assert.match(lib, /lastLoaded = await readSheetOrders\(\);/, "readAll sheet se");
  assert.match(lib, /nextInvoiceSerialSheet/, "invoice serial sheet ke Invoices tab se");
  // idempotency sheet mode me DB touch nahi karti
  assert.match(lib, /ordersBackend\(\) === "postgres" && dbEnabled\(\)/, "idempotency ka DB branch sirf postgres mode me");
});

test("R40: google-sheets — scriptGet/scriptPost/version-check/auto-heal, expected id sirf env se", () => {
  const lib = read("apps/web/src/lib/google-sheets.ts");
  assert.match(lib, /export async function scriptGet</, "generic gated GET");
  assert.match(lib, /export async function scriptPost</, "generic POST");
  assert.match(lib, /export async function readScriptVersion\(/, "version 30s cache");
  assert.match(lib, /export async function healSheetConfig\(/, "SHEET_ID auto-heal");
  assert.match(lib, /sheet_set/, "heal script ke sheet_set action se hota hai");
  assert.match(lib, /sheet_not_configured/i, "append/read not-configured par heal retry karte hain");
  assert.ok(!lib.includes(FINAL_SHEET_ID), "sheet id hardcoded nahi");
  assert.ok(!lib.includes("export const EXPECTED_SHEET_ID"), "R39 wala constant gaya");
  assert.match(lib, /return \(process\.env\.SHEET_EXPECTED_ID \?\? ""\)\.trim\(\);/, "expected id sirf env");
  assert.match(lib, /endpoint\.searchParams\.set\("expected", expected\)/, "health probe expected id bhejta hai");
});

/* ── 2. Script r40+ guards ───────────────────────────────────────────────── */

test("R40: script — sheet id sirf Script Properties, sheet_set bootstrap, order_state/orders_state", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  assert.match(gs, /var CODE_VERSION = 'r4[2345]-1';/);
  assert.ok(!gs.includes(FINAL_SHEET_ID), "sheet id code me kahin nahi");
  assert.ok(!gs.includes("var SPREADSHEET_ID"), "SPREADSHEET_ID constant gaya");
  assert.ok(!gs.includes("SHEET_ID_FALLBACK ="), "fallback constant gaya");
  assert.match(gs, /function propsSheetId_\(/, "id sirf props se");
  assert.match(gs, /sheet_not_configured/, "props khaali = loud error (bound-copy fallback nahi)");
  assert.match(gs, /sheet_access_denied/, "id set par sheet na khule = loud error");
  assert.match(gs, /action === 'sheet_set'/, "sheet_set action");
  assert.match(gs, /if \(haveId && !authed\)/, "set id ko badalna token-gated (fresh bootstrap free)");
  assert.match(gs, /function extractSheetId_\(/, "URL ya raw id dono chalte hain");
  // sheet-as-DB
  assert.match(gs, /'Order JSON',/, "Orders HEADERS me Order JSON");
  assert.match(gs, /'Invoice JSON',/, "Invoices HEADERS me Invoice JSON");
  assert.match(gs, /function orderStates_\(/, "state reader");
  assert.match(gs, /action === 'order_state'/);
  assert.match(gs, /action === 'orders_state'/);
  assert.match(gs, /delete object\['Order JSON'\]/, "row payload me JSON duplicate nahi jaata");
  assert.match(gs, /var MAX_CELL_CHARS = 20000;/, "Order JSON ke liye cell cap badha");
  assert.match(gs, /GIDS = \{\n  Settings: null, Products: null, Orders: null/, "gid bhi kisi ek sheet ke nahi — naam-based lookup");
  assert.match(gs, /expectedId/, "health ka idMatch site ke bheje expected se");
  assert.match(gs, /sheetConfigured: Boolean\(propsSheetId_\(\)\)/, "health sheetConfigured batata hai");
  // panel bootstrap form
  assert.match(gs, /Sheet URL set karein/, "panel par sheet-set form");
  assert.match(gs, /name="action" value="sheet_set"/, "form GET sheet_set submit karta hai");
  // message_status: handled Replied ko nahi chhuta
  assert.match(gs, /msgUpdates/, "status-wise updates (handled sirf Status badalta hai)");
});

/* ── 3. Checkout stale-resume (cache wala purana order) ───────────────────── */

test("R40: checkout-form — naya cart purane ?order= ko hijack nahi kar sakta", () => {
  const form = read("apps/web/src/components/checkout-form.tsx");
  assert.match(form, /const staleResume =/, "stale resume detect hota hai");
  assert.match(form, /Boolean\(resumeOrderNumber\) && lines\.length > 0 && placedOrderNumber !== resumeOrderNumber/, "cart me items + purana order param = stale");
  assert.match(form, /if \(!resumeOrderNumber \|\| staleResume\) \{\n      setResumed\(null\);/, "snapshot load skip");
  assert.match(form, /if \(staleResume\) \{\n      setStep\("details"\);/, "step details par reset");
  assert.match(form, /if \(linesCountRef\.current > 0 && order !== placedRef\.current\) return;/, "popstate hijack guard");
  assert.match(form, /router\.replace\("\/checkout"\)/, "stale URL param ek baar clean hota hai");
  assert.match(form, /const resumed: PlacedOrderSnapshot \| null = staleResume\n    \? null/, "review/summary purane order ka nahi dikhta");
  assert.match(form, /const target = staleResume \? null : orderNumber;/, "purana payment-context fetch nahi hota");
  assert.match(form, /!staleResume\);/, "resumePending/resumeMissing stale par normal checkout dikhate hain");
});

/* ── 4. Messages / manual invoices bhi sheet par ──────────────────────────── */

test("R40: messages + manual invoices sheet mode me sheet hi store hain", () => {
  const msg = read("apps/web/src/lib/messages.ts");
  assert.match(msg, /ordersBackend\(\) === "sheet"/, "sheet backend branch");
  assert.match(msg, /const mirrored = await mirrorMessageToSheet\(message\);\n    if \(mirrored\) return message;/, "message sheet par AWAIT save hota hai");
  assert.match(msg, /sheet: "Messages", limit:/, "list Messages tab se padhti hai");
  assert.match(msg, /scriptPost\("message_status"/, "replied/handled sheet row update karta hai");
  assert.match(msg, /scriptPost<\{ duplicate\?: boolean \}>\("subscribe"/, "newsletter script ke dedupe ke saath");

  const inv = read("apps/web/src/lib/manual-invoices.ts");
  assert.match(inv, /ordersBackend\(\) === "sheet"/);
  assert.match(inv, /"Invoice JSON": JSON\.stringify\(invoice\)/, "manual invoice ka snapshot sheet me");
  assert.match(inv, /Type: "manual"/);
  assert.match(inv, /String\(row\.Type \?\? ""\) === "manual"/, "list sirf manual rows parse karti hai");

  const fmt = read("apps/web/src/lib/sheet-format.ts");
  assert.match(fmt, /"Message ID": message\.id \?\? ""/, "message row me id (update isi se row dhoondhta hai)");
});

/* ── 5. Health endpoints — store ka saaf jawab ────────────────────────────── */

test("R40: health + sheet-health — ordersStore sheet, version gate r40, sheet-not-set help", () => {
  const health = read("apps/web/src/app/api/health/route.ts");
  assert.match(health, /ordersStore: ordersBackend\(\)/, "/api/health asli backend batata hai");
  assert.match(health, /storage:\n          ordersBackend\(\) === "sheet"\n            \? "sheet"/, "storage=sheet report");

  const route = read("apps/web/src/app/api/sheet-health/route.ts");
  assert.match(route, /major < 40/, "purana script = orders save nahi honge, help me paste recipe");
  assert.match(route, /sheetOrderStoreInfo/, "orders store ka ready/reason payload me");
  assert.match(route, /sheetConfigured === false/, "SHEET_ID set na hone ka alag help");
  assert.match(route, /action=sheet_set/, "help me sheet_set ka raasta");
  assert.match(route, /expectedSheetId\(\) && health\.spreadsheetId/, "env khaali ho to id-match check skip");
  assert.ok(!route.includes(FINAL_SHEET_ID), "route me sheet id hardcoded nahi");
});

test("R40: selfcheck — koi default sheet id nahi, version r40+ check", () => {
  const selfcheck = read("scripts/sheets-selfcheck.mjs");
  assert.ok(!selfcheck.includes(FINAL_SHEET_ID), "default id hata");
  assert.match(selfcheck, /process\.env\.EXPECTED_SHEET_ID \?\? ""/, "argv/env se id, warna skip");
  assert.match(selfcheck, /id-check skip/, "bina id ke check skip hone ka message");
  assert.match(selfcheck, />= 40/, "version r40+ expect");
});

/* ── 6. Behaviour — parse/overlay (pure, sheet-merge.ts) ─────────────────── */

test("R40: parseOrderState — JSON snapshot + owner ke live sheet edits ka overlay", () => {
  const order = makeOrder();
  const latestRow = {
    Timestamp: "2026-10-27T04:00:00.000Z",
    Event: "order.status_sheet",
    "Order number": "LK-TEST1",
    "Order status": "Shipped",
    "Admin Note": "",
    Notes: "",
    "Tracking courier": "Deliveroo",
    AWB: "awb 9988",
    "Tracking URL": "",
  };
  const state: OrderState = {
    orderNumber: "LK-TEST1",
    json: JSON.stringify({ ...order, audit: [] }),
    row: latestRow,
    rows: [
      {
        Timestamp: "2026-10-27T02:00:00.000Z",
        Event: "order.placed",
        "Order number": "LK-TEST1",
        "Order status": "placed",
        "Admin Note": "Gift wrap karna",
        Notes: "",
      },
      latestRow,
    ],
  };
  const parsed = parseOrderState(state);
  assert.ok(parsed);
  assert.equal(parsed.orderNumber, "LK-TEST1");
  // owner ne sheet me status Shipped kiya → snapshot (placed) par jeeta hai
  assert.equal(parsed.status, "shipped");
  // Admin Note (kisi purani row me bhi ho) → note-box text
  assert.equal(parsed.statusNote?.text, "Gift wrap karna");
  assert.equal(parsed.statusNote?.by, "sheet");
  // tracking columns overlay
  assert.equal(parsed.tracking?.courier, "Deliveroo");
  assert.equal(parsed.tracking?.awb, "AWB9988", "AWB clean hota hai");
  // R43 (owner rule): sheet par status shipped = owner ne verify kar diya ki
  // paisa aa gaya — prepaid par payment store-verified ("paid") maana jaata hai
  assert.equal(parsed.paymentStatus, "paid");
  assert.equal(parsed.payment?.verifiedBy, "store");
  assert.equal(parsed.total, 499900);
  // audit rows se banta hai (snapshot me audit bhejte hi nahi)
  assert.ok(parsed.audit.length >= 2, "row-history se audit bani");
});

test("R40: parseOrderState — JSON ke bina (purani rows) best-effort reconstruct", () => {
  const state: OrderState = {
    orderNumber: "LK-OLD1",
    json: "",
    rows: [
      {
        Timestamp: "2026-10-26T18:30:00.000Z",
        Event: "order.placed",
        "Order number": "LK-OLD1",
        "Order status": "placed",
        "Payment status": "paid",
        "Payment reference": "UTR123",
        Total: 4999,
        Subtotal: 4999,
        Discount: 0,
        "Item details": "Anarkali Set (M [38]) x2 | Gown (L) x1",
        Customer: "Ravi",
        Phone: "9800000000",
        Email: "ravi@example.com",
        Address: "48 Park St",
        City: "Kolkata",
        State: "West Bengal",
        Pincode: "700016",
        Notes: "shaam ko bhejna",
      },
    ],
  };
  const parsed = parseOrderState(state);
  assert.ok(parsed);
  assert.equal(parsed.customerName, "Ravi");
  assert.equal(parsed.total, 499900, "rupees → paise");
  assert.equal(parsed.paymentStatus, "paid");
  assert.equal(parsed.payment?.reference, "UTR123");
  assert.equal(parsed.items.length, 2, "Item details parse hua");
  assert.equal(parsed.items[0]!.size, "M [38]");
  assert.equal(parsed.items[0]!.quantity, 2);
  assert.equal(parsed.status, "placed");
});

test("R40: orderFromSheetRows — galat payment text safe, khaali rows null", () => {
  assert.equal(orderFromSheetRows("LK-X", []), null);
  const parsed = orderFromSheetRows("LK-X", [
    {
      Timestamp: "2026-10-27T02:00:00.000Z",
      Event: "order.placed",
      "Order number": "LK-X",
      "Order status": "cancelled by owner",
      "Payment status": "paisa aa gaya",
      Total: "1,200",
      "Item details": "",
    },
  ]);
  assert.ok(parsed);
  assert.equal(parsed.status, "cancelled", "free-text status map hua");
  assert.equal(parsed.paymentStatus, "pending", "galat payment text → safe default");
  assert.equal(parsed.total, 120000, "comma wala rupee parse");
});
