/**
 * Round 42 (27 Oct 2026) — owner, R41 deploy ke baad:
 *
 *  1. "**dropdown data validation lga do payment mai** … jis column mai jrurat
 *     hai sabhi mai add kr" — script r42-1: status columns me dropdown
 *     (Order/Payment status, Payment method, Messages/Newsletter/Reviews/
 *     Coupons/Inventory), `setup`/`repair` ke saath auto + `?action=dropdowns`
 *     (panel form se ya site khud r42+ detect karke).
 *  2. "**payment pending/processing → Complete payment ka option aana chiye,
 *     payment complete → hat jana chiye**" — order page CTA: paid/refunded par
 *     hidden, cancelled/returned order par bhi hidden.
 *  3. "**order ke every stage pr owner ya store wale ka comment dikhna chiye**" —
 *     compat reconstruct ab onEdit events (`order.status_sheet`,
 *     `order.admin_note`) ko timeline ki bhasha me badalta hai aur har stage
 *     par owner ka comment (Admin Note / sheet-edit Notes) dikhata hai.
 *     Customer ke order `Notes` stage-comment bankar spam nahi hote.
 *  4. "**repo bilkul clean — no extra, no .md**" — docs/, .claude/, agent-guides/,
 *     README/PROGRESS sab gaye; sirf live-site content (policies) bacha.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { groupOrdersFromRecentRows, orderFromSheetRows, type SheetRow } from "../../apps/web/src/lib/sheet-merge";
import { trackingUpdates } from "../../apps/web/src/lib/tracking";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/* ── 1. Behaviour: stage comments + statusNote (compat reconstruct) ───────── */

test("R42: owner ke sheet edits har stage par comment ban kar timeline me dikhte hain", () => {
  const customerNote = "ghar par leave kar jana";
  const adminNote = "Courier Blue Dart — AWB shaam tak update hoga";
  // chronological rows (site placed/confirmed + owner ke 2 onEdit rows)
  const chronological: SheetRow[] = [
    {
      Timestamp: "2026-10-27T03:00:00.000Z",
      Event: "order.placed",
      "Order number": "LK-STAGE1",
      "Order status": "placed",
      "Payment status": "pending",
      Total: "1,499",
      Customer: "Asha Devi",
      Phone: "9812345678",
      "Item details": "Anarkali Set (M [38]) x1",
      Notes: customerNote,
      Source: "website",
    },
    {
      Timestamp: "2026-10-27T03:30:00.000Z",
      Event: "order.status.confirmed",
      "Order number": "LK-STAGE1",
      "Order status": "confirmed",
      Notes: customerNote, // site har row me customer Notes dohrati hai
      Source: "website",
    },
    {
      Timestamp: "2026-10-27T04:00:00.000Z",
      Event: "order.status_sheet",
      "Order number": "LK-STAGE1",
      "Order status": "Shipped",
      Notes: "Sheet se status update (owner)",
      Source: "sheet-edit",
    },
    {
      Timestamp: "2026-10-27T04:10:00.000Z",
      Event: "order.admin_note",
      "Order number": "LK-STAGE1",
      "Order status": "Shipped",
      "Admin Note": adminNote,
      Notes: adminNote,
      Source: "sheet-edit",
    },
  ];
  // action=recent newest-first deta hai
  const groups = groupOrdersFromRecentRows([...chronological].reverse());
  const order = orderFromSheetRows(groups[0]!.orderNumber, groups[0]!.rows);
  assert.ok(order);

  assert.equal(order!.status, "shipped", "owner ka sheet status jeeta");
  assert.equal(order!.notes, customerNote, "customer ka order note barkarar");
  assert.equal(order!.statusNote?.text, adminNote, "Admin Note compat me bhi statusNote banta hai");
  assert.equal(order!.statusNote?.by, "sheet");

  // audit newest-first: admin_note → order.note_updated (meta.text), status_sheet → order.status.<slug> (meta.note)
  const [newest, second, third] = order!.audit;
  assert.equal(newest!.action, "order.note_updated");
  assert.equal(newest!.meta?.text, adminNote);
  assert.equal(newest!.actor, "sheet");
  assert.equal(second!.action, "order.status.shipped", "status_sheet normalize hua — warna STATUS_ACTION pakadta hi nahi");
  assert.equal(second!.meta?.note, "Sheet se status update (owner)");
  assert.equal(third!.action, "order.status.confirmed");
  assert.equal(third!.meta, undefined, "site rows ka customer Notes stage-comment nahi banta (spam fix)");

  // timeline (customer page) me har stage ka comment dikhta hai
  const updates = trackingUpdates(order!);
  assert.ok(
    updates.some((update) => update.kind === "note" && update.text === adminNote),
    "owner ka note timeline me",
  );
  assert.ok(
    updates.some((update) => update.status === "shipped" && String(update.text ?? "").includes("Sheet se status")),
    "shipped stage par owner comment",
  );
  assert.ok(
    !updates.some((update) => update.text === customerNote),
    "customer ka order-note timeline par spam nahi hota",
  );
});

/* ── 2. Guards: order page CTA + watcher ──────────────────────────────────── */

test("R42: Complete payment CTA — paid/refunded/cancelled par hidden, pending/processing par dikhta hai", () => {
  const page = read("apps/web/src/app/orders/[orderNumber]/page.tsx");
  assert.match(
    page,
    /order\.paymentStatus !== "paid" && order\.paymentStatus !== "refunded" && !stopped/,
    "CTA guard: paid + refunded + cancelled/returned par hidden",
  );
  assert.match(page, /data-testid="complete-payment"/, "CTA wahi testid ke saath");
  // cod par payment block hi nahi (existing rule barkarar)
  assert.match(page, /order\.paymentMethod !== "cod"/);
});

test("R42: watcher — refunded ki apni copy + polling paid/refunded par rukti hai", () => {
  const watcher = read("apps/web/src/components/payment-status-watcher.tsx");
  assert.match(watcher, /refunded:\s*{/, "refunded state ki copy hai");
  assert.match(watcher, /Refund ho gaya/, "refunded label");
  assert.match(watcher, /status === "paid" \|\| status === "refunded"/, "paid/refunded par poll start hi nahi");
  assert.match(watcher, /next === "paid" \|\| next === "refunded"/, "poll me bhi refund par stop");
});

/* ── 3. Guards: dropdown pipeline (script + site auto-apply) ──────────────── */

test("R42: script r42-1 — VALIDATIONS map, dropdowns action (GET+POST), setup/repair me auto", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  assert.match(gs, /var CODE_VERSION = 'r4[234]-1';/);
  assert.match(gs, /function applyValidations_\(/);
  assert.match(gs, /setAllowInvalid\(true\)/, "dropdown suvidha hai, taala nahi — automation nahi tootta");
  // "jis column mai jrurat hai sabhi mai"
  for (const tab of ["Orders", "Payments", "OrderItems", "Shipments", "Invoices", "Messages", "Newsletter", "Reviews", "Coupons", "Inventory"]) {
    assert.ok(new RegExp(`VALIDATIONS[\\s\\S]*?${tab}:`).test(gs), `${tab} dropdown map me`);
  }
  assert.match(gs, /'Payment status': PAYMENT_DROPDOWN/, "payment status dropdown");
  assert.match(gs, /if \(action === 'dropdowns'\) \{[\s\S]*?if \(!authed\)/, "GET dropdowns token mangta hai");
  assert.ok(gs.includes("if (action === 'dropdowns')"), "POST dropdowns action");
  assert.match(gs, /applyValidations_\(\); \/\/ R42/, "setup/repair me auto-apply");
  assert.match(gs, /Dropdowns lagao/, "panel par button");
});

test("R42: site r42+ script detect karte hi dropdowns khud lagwa deti hai (rate-limited)", () => {
  const sheets = read("apps/web/src/lib/google-sheets.ts");
  assert.match(sheets, /export async function applySheetDropdowns\(/);
  assert.match(sheets, /scriptPost<\{ applied\?: number \}>\("dropdowns"/);
  assert.match(sheets, /lastDropdownsAt < 10 \* 60_000/, "10-min rate limit (heal jaisa)");
  assert.match(sheets, /healMajor >= 42/, "health probe r42+ par trigger karta hai");
  assert.match(sheets, /void applySheetDropdowns\(\)\.catch\(\(\) => \{\}\)/, "fire-and-forget — probe nahi rokta");
});

/* ── 4. Guard: repo clean (owner rule — "no extra no .md") ────────────────── */

test("R42: repo clean — koi .md nahi (sirf live policies content), docs/.claude/agent-guides gaye", () => {
  const root = process.cwd();
  const skip = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".turbo", ".venv", "out", "build"]);
  const offenders: string[] = [];
  let policyCount = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const rel = path.relative(root, path.join(dir, entry.name));
      if (rel.startsWith(path.join("apps/web/src/content/policies"))) {
        policyCount += 1; // live site ka legal content — build-policies.mjs isi se banata hai
        continue;
      }
      offenders.push(rel);
    }
  };
  walk(root);
  assert.deepEqual(offenders, [], "repo me sirf policies ke .md bachne chahiye");
  assert.equal(policyCount, 4, "privacy/terms/shipping/refund — chaaron policies intact");

  for (const gone of ["docs", ".claude", "agent-guides", "scripts/export-apps-script.mjs", "scripts/repo-audit.mjs", "scripts/brand/render-proof.mjs", "PROGRESS.md", "README.md"]) {
    assert.ok(!fs.existsSync(path.join(root, gone)), `${gone} rehna nahi chahiye`);
  }
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  for (const script of ["apps-script:export", "audit", "audit:check", "assets:proof"]) {
    assert.equal(pkg.scripts[script], undefined, `package.json se "${script}" gaya`);
  }
});
