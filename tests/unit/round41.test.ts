/**
 * Round 41 (27 Oct 2026) — owner, R40 deploy ke baad:
 *
 *  1. "**abhi bi sheet mai nhai aa rha hai fix kro yrr**" — live script abhi
 *     **r38-1** par hai (r40-1 paste hona baaki). R40 ka version gate orders ko
 *     503 par rok raha tha. Ab **compat mode**: purane script par bhi orders
 *     sheet me hi save/read hote hain (writes = wahi append; reads =
 *     `?action=order` ke tab-wise rows + `?action=recent` → reconstruct).
 *     r40-1 paste ke baad full mode (Order JSON snapshot) apne aap chalu.
 *  2. "**ye direct mt baya kro ki kya problem hai server problem ok sabhi
 *     jgha**" — customer-facing messages me "sheet store ready nahi"/"server
 *     par save nahi hua" jaisa technical jargon nahi; friendly line + WhatsApp.
 *     Asli diagnosis sirf owner ke `/api/sheet-health` par.
 *  3. "**website ne upi id kha se detect ki… sheet me alag detail dali hai**" —
 *     UPI sirf sheet ke `upi_id` se aati hai; script doosri sheet pakde
 *     (idMatch:false) aur r40+ ho to site `sheet_set` se **auto-heal** karti hai.
 *     Purane script par sheet-health saaf batata hai ki script kaun si sheet
 *     pakde hai (owner `?action=settings` se script ki nazar se sheet dekh sakta hai).
 *
 * Behaviour tests pure functions par (sheet-merge.ts); source guards baaki par.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { groupOrdersFromRecentRows, orderFromSheetRows, type SheetRow } from "../../apps/web/src/lib/sheet-merge";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/* ── 1. Behaviour — compat grouping (recent rows → per-order chronological) ── */

test("R41: groupOrdersFromRecentRows — newest-first groups, andar se chronological", () => {
  // recentRows_ newest-first deta hai (script rows.reverse() karta hai)
  const rows: SheetRow[] = [
    { "Order number": "LK-B2", "Order status": "placed", Timestamp: "2026-10-27T05:00:00.000Z" },
    { "Order number": "lk-a1", "Order status": "Shipped", Timestamp: "2026-10-27T04:30:00.000Z" },
    { "Order number": "LK-B2", "Order status": "confirmed", Timestamp: "2026-10-27T04:00:00.000Z" },
    { "Order number": "", "Order status": "placed" }, // bina number ki row skip
    { "Order number": "LK-A1", "Order status": "placed", Timestamp: "2026-10-27T03:00:00.000Z" },
  ];
  const groups = groupOrdersFromRecentRows(rows);
  assert.equal(groups.length, 2);
  // newest-first: LK-B2 ki latest row sabse upar thi → group bhi pehle
  assert.equal(groups[0]!.orderNumber, "LK-B2");
  assert.equal(groups[1]!.orderNumber, "LK-A1", "case-insensitive + trim (lk-a1 → LK-A1)");
  // group ke andar chronological (purani→nayi) — orderFromSheetRows last row ko latest maanta hai
  assert.equal(String(groups[0]!.rows[0]!["Order status"]), "confirmed");
  assert.equal(String(groups[0]!.rows[1]!["Order status"]), "placed");
  assert.equal(groups[1]!.rows.length, 2);
  assert.equal(String(groups[1]!.rows[1]!["Order status"]), "Shipped", "nayi row last me");
});

test("R41: compat reconstruct — recent/action=order rows se poora order (bina Order JSON)", () => {
  // r38-1 jaisa script: rows me Order JSON column hi nahi
  const rows: SheetRow[] = [
    {
      Timestamp: "2026-10-27T02:00:00.000Z",
      Event: "order.placed",
      "Order number": "LK-COMPAT1",
      "Order status": "placed",
      "Payment status": "pending",
      Total: "1,499",
      Items: "2",
      "Item details": "Anarkali Set (M [38]) x2",
      Customer: "Asha Devi",
      Phone: "9812345678",
      Address: "12 MG Road",
      City: "Alwar",
      State: "Rajasthan",
      Pincode: "301001",
    },
    {
      Timestamp: "2026-10-27T03:00:00.000Z",
      Event: "order.status.confirmed",
      "Order number": "LK-COMPAT1",
      "Order status": "confirmed",
      // asli orderSheetRow har event row me poore columns bharta hai
      "Payment status": "pending",
      Total: "1,499",
      "Item details": "Anarkali Set (M [38]) x2",
    },
    {
      // onEdit ki SPARSE row (owner ne sheet me status badla) — sirf status/number.
      // R41 hardening: iske baad bhi customer/total placed row se last-non-empty aana chahiye.
      Timestamp: "2026-10-27T04:00:00.000Z",
      Event: "order.status_sheet",
      "Order number": "LK-COMPAT1",
      "Order status": "Shipped",
      Source: "sheet-edit",
    },
  ];
  const groups = groupOrdersFromRecentRows([...rows].reverse());
  const order = orderFromSheetRows(groups[0]!.orderNumber, groups[0]!.rows);
  assert.ok(order, "order reconstruct hua");
  assert.equal(order!.orderNumber, "LK-COMPAT1");
  assert.equal(order!.status, "shipped", "sparse onEdit row ka status jeeta (free-text map)");
  assert.equal(order!.total, 149900, "comma-rupees → paise (purani full row se)");
  assert.equal(order!.items.length, 1);
  assert.equal(order!.customerName, "Asha Devi");
  assert.equal(order!.phone, "9812345678");
});

/* ── 2. Guards — compat mode wire hai (orders-sheet) ─────────────────────── */

test("R41: orders-sheet — full/compat/none mode, purana script orders block nahi karta", () => {
  const lib = read("apps/web/src/lib/orders-sheet.ts");
  assert.match(lib, /export type SheetOrdersMode = "full" \| "compat" \| "none";/);
  assert.match(lib, /export const SHEET_ORDERS_MIN_MAJOR = 40;/, "full mode ki boundary wahi hai");
  // version na padha ja sake → optimistic compat (pehle se 503 nahi; write fail = honest error)
  assert.match(lib, /mode: "compat",\s*\n\s*reason: "script ka version padha nahi ja saka/);
  // purana script → compat (ready:true — orders sheet me hi jaate hain)
  assert.match(lib, /par compat mode — orders sheet me hi save hote hain/);
  // compat reads: purane script ke actions
  assert.match(lib, /"order",\s*\n\s*\{ order: wanted \}/, "single order = ?action=order (orderStory_ rows)");
  assert.match(lib, /rows\?\.Orders/, "orderStory_ ke Orders rows se reconstruct");
  assert.match(lib, /groupOrdersFromRecentRows/, "list = recent rows → groups → reconstruct");
  assert.match(lib, /\{ sheet: "Orders", limit: 200 \}/, "recent ki cap 200 (script ki apni cap)");
  assert.match(lib, /parseOrderState\(\{ orderNumber: wanted, rows, json: lastOrderJson\(rows\) \}\)/, "reconstruct pure fn se (unit-tested) + Order JSON restore (R43)");
});

test("R41: orders.ts — gate sirf mode 'none' par, customer message friendly", () => {
  const lib = read("apps/web/src/lib/orders.ts");
  assert.match(lib, /if \(!ready\.ready\)/, "gate wahi ek jagah");
  assert.match(lib, /Order abhi complete nahi hua\. Thodi der me dobara try kariye, ya WhatsApp par order bhej dijiye — team turant confirm karegi\./);
  assert.match(lib, /Order abhi complete nahi hua\. Dobara try kariye, ya WhatsApp par order bhej dijiye — team turant confirm karegi\./);
  // owner rule: customer ko andar ki problem mat dikhao
  assert.ok(!lib.includes("sheet store ready nahi"), "technical jargon customer message se gaya");
  assert.ok(!lib.includes("Order sheet me save nahi hua — order nahi bana"), "purana technical message gaya");
  assert.match(lib, /sheet_store_not_ready/, "diagnostics ke liye code wahi (sheet-health/logs)");
});

test("R41: checkout/http-json — 'server problem' customer par expose nahi (sabhi jagah)", () => {
  const form = read("apps/web/src/components/checkout-form.tsx");
  assert.ok(!form.includes("Order server par save nahi hua"), "fallback banner friendly");
  assert.ok(!form.includes("Order server tak nahi pahuncha"), "catch message friendly");
  assert.match(form, /Order abhi complete nahi hua\./);
  assert.match(form, /data-testid="checkout-fallback"/, "banner testid wahi (smoke pin)");

  const http = read("apps/web/src/lib/http-json.ts");
  assert.ok(!http.includes("Server par problem hai"), "500 message friendly");
  assert.ok(!http.includes("Server se reply nahi aaya"), "timeout/read messages friendly");
  assert.match(http, /Kaam abhi complete nahi hua — thodi der baad try kariye ya WhatsApp par order bhej dijiye/);
});

/* ── 3. Guards — sheet-health honest + wrong-sheet auto-heal ─────────────── */

test("R41: sheet-health — purana script warning hai (failure nahi), mode payload me", () => {
  const route = read("apps/web/src/app/api/sheet-health/route.ts");
  // compat = warning, help (failure) nahi — warna ok:false owner ko darata rahega
  assert.match(route, /warnings\.push\(`Script ka purana version chal raha hai/);
  assert.match(route, /compat mode/, "warning me compat ka zikr — orders phir bhi sheet me");
  assert.match(route, /mode: orderStore\.mode/, "full/compat/none payload me dikhta hai");
  assert.match(route, /GOOGLE_SHEETS_WEBAPP_URL \+ GOOGLE_SHEETS_TOKEN set karke redeploy/, "ready:false = env missing ka fix");
});

test("R41: google-sheets — r40+ script doosri sheet pakde to sheet_set auto-heal", () => {
  const lib = read("apps/web/src/lib/google-sheets.ts");
  assert.match(lib, /payload\.idMatch === false && healMajor >= 40/, "sirf r40+ par heal (purane script par sheet_set hota hi nahi)");
  assert.match(lib, /void healSheetConfig\(\)\.catch/, "heal fire-and-forget — health probe block nahi hota");
  assert.match(lib, /10 \* 60_000/, "heal rate limit (loop guard) wahi hai");
});

test("R41: messages — purane script par bhi admin list chalti hai (id fallback)", () => {
  const lib = read("apps/web/src/lib/messages.ts");
  assert.match(lib, /String\(row\["Message ID"\] \?\? ""\) \|\| `row:/, "Message ID column na ho to Timestamp+Email se id (r40+ ka Message ID hi primary)");
});
