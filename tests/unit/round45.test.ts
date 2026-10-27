import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { whatsappHref, whatsappNumber } from "../../apps/web/src/lib/phone";
import { normaliseSheetSettings } from "../../apps/web/src/lib/sheet-format";

/**
 * R45 — owner ke 3 complaints ka regression suite:
 *
 *  1. Checkout/payment copy me **andar ki baat nahi** ("alag page nahi khulega",
 *     "sheet se aati hai") — customer ko sirf kaam ki line dikhti hai.
 *  2. Order fail hone par **ek hi message** — `{error}` paragraph aur fallback
 *     box duplicate nahi dikhte.
 *  3. Sheet/DB ka data **hardcoded fallback se kabhi override nahi hota** —
 *     owner ne UPI/phone delete kiya to site se bhi turant gayab:
 *       - `whatsappNumber("")` → "" (pehle "918005900581" default tha)
 *       - normaliseSheetSettings empty string ko undefined nahi banata
 *       - apps/web/src me koi hardcoded support number nahi (allowlist ke bina)
 *       - gs settings response me missing public keys '' se bhari jaati hain
 *       - gs appendRows_ validation error par dropdowns repair karke retry karta hai
 */

// test runner repo root se chalta hai (npm run test:unit)
const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

/* ─────────────── 1. phone/WhatsApp helpers — koi hardcoded default nahi ─────────────── */

test("R45: whatsappNumber/whatsappHref — khaali number = khaali link (hardcoded fallback gaya)", () => {
  assert.equal(whatsappNumber(""), "", "khaali → '' (pehle 918005900581 default tha)");
  assert.equal(whatsappNumber(undefined), "");
  assert.equal(whatsappNumber(null), "");
  assert.equal(whatsappHref(""), "", "bina number ke wa.me link banta hi nahi");
  // sahi number ab bhi country code ke saath
  assert.equal(whatsappNumber("8005900581"), "918005900581");
  assert.equal(whatsappHref("8005900581", "hi"), "https://wa.me/918005900581?text=hi");
  // explicit fallback ab bhi kaam karta hai (caller ki marzi)
  assert.equal(whatsappNumber("", "919999999999"), "919999999999");
});

/* ─────────────── 2. sheet settings — empty string owner ki marzi hai ─────────────── */

test("R45: normaliseSheetSettings — khaali string '' rehti hai (undefined nahi), missing key undefined", () => {
  const cleared = normaliseSheetSettings({ ok: true, settings: { upi_id: "", whatsapp: "", support_phone: "" } });
  assert.equal(cleared?.upiId, "", "owner ne sheet se UPI delete kiya → '' site tak jaata hai");
  assert.equal(cleared?.whatsapp, "");
  assert.equal(cleared?.supportPhone, "");

  const missing = normaliseSheetSettings({ ok: true, settings: { announcement: "Sale" } });
  assert.equal(missing?.upiId, undefined, "key sheet me thi hi nahi (purana script) → undefined (stored chalega)");
  assert.equal(missing?.announcement, "Sale");

  const empty = normaliseSheetSettings({ ok: true, settings: {} });
  assert.equal(empty, null, "bilkul khaali payload = read fail jaisa (stored fallback)");
});

/* ─────────────── 3. source guards — customer code me hardcoded contact nahi ─────────────── */

test("R45: apps/web/src me hardcoded support number nahi (sirf allowlist: policy text, selftest, comment)", () => {
  const allowlist = [
    "content/policies.generated.ts", // legal policy text (owner-approved content)
    "app/api/sheet-selftest/route.ts", // owner-only diagnostics ka test payload
    "lib/phone.ts", // sirf comment me zikr (helper ka itihas)
  ];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const rel = path.relative(path.join(root, "apps/web/src"), full);
        if (allowlist.includes(rel)) continue;
        if (read(path.join("apps/web/src", rel)).includes("8005900581")) offenders.push(rel);
      }
    }
  };
  walk(path.join(root, "apps/web/src"));
  assert.deepEqual(offenders, [], "ye files ab bhi hardcoded number rakhti hain");
});

test("R45: static config/provider defaults me contact number khaali hai", () => {
  const site = read("apps/web/src/config/site.ts");
  assert.match(site, /phone: ""/, "siteConfig.phone khali");
  assert.match(site, /whatsapp: ""/, "siteConfig.whatsapp khali");
  const provider = read("apps/web/src/components/store-settings-provider.tsx");
  assert.match(provider, /supportPhone: ""/, "client defaults me number nahi");
  assert.doesNotMatch(provider, /8005900581/);
  const settings = read("apps/web/src/lib/store-settings.ts");
  assert.match(settings, /supportPhone: ""/, "server defaults me number nahi");
  assert.match(settings, /whatsapp: ""/, "server defaults me whatsapp nahi");
  assert.match(settings, /textOrEmpty/, "owner-editable keys me khaali string preserve hoti hai");
});

/* ─────────────── 4. checkout copy — andar ki baat customer ko nahi ─────────────── */

test("R45: checkout/payment copy me 'alag page'/'sheet' jaisi internal baat nahi", () => {
  /** sirf customer-visible code: comment lines (// … , /* … , * …) hata kar */
  const codeOnly = (file: string) =>
    read(file)
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join("\n");
  assert.doesNotMatch(codeOnly("apps/web/src/components/checkout-form.tsx"), /alag page/, "customer copy me 'alag page nahi khulega' hata diya");
  assert.doesNotMatch(codeOnly("apps/web/src/components/checkout-payment-step.tsx"), /sheet se aati hai/);
  assert.doesNotMatch(codeOnly("apps/web/src/components/upi-payment.tsx"), /sheet se aati hai/);
});

test("R45: order fail par ek hi message — fallback box khula ho to {error} duplicate nahi", () => {
  const form = read("apps/web/src/components/checkout-form.tsx");
  // standalone error line sirf tab jab fallback box NA ho
  assert.match(form, /\{error && !fallbackReason \? <p/);
  // box fallbackHref par nahi, fallbackReason par khulta hai (WhatsApp khali ho to bhi Try again dikhe)
  assert.match(form, /\{fallbackReason \? \(/);
  // box ka message = API ka error (duplicate generic line nahi)
  assert.match(form, /\{error \?\? \(/);
  // WhatsApp button sirf number set hone par
  assert.match(form, /if \(!wa\) return "";/, "whatsappOrderLink khaali number par '' deta hai");
  assert.match(form, /\{fallbackHref \? \(\s*\n\s*<a/, "box me WhatsApp anchor guard ke andar hai");
});

/* ─────────────── 5. Apps Script r45-1 guards ─────────────── */

test("R45: gs settings response — missing public keys '' se bharti hain (delete = site se gaya)", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  assert.match(gs, /var CODE_VERSION = 'r4[56]-1';/);
  assert.match(gs, /if \(all\[key\] === undefined\) all\[key\] = '';/);
  // seed defaults me bhi contact number khali
  assert.match(gs, /\['support_phone', ''\]/);
  assert.match(gs, /\['whatsapp', ''\]/);
  assert.doesNotMatch(gs, /8005900581/);
});

test("R45: gs appendRows_ — validation error par dropdowns repair + ek retry (order save nahi rukta)", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  const fn = gs.slice(gs.indexOf("function appendRows_"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /catch \(writeError\)/, "setValues ka error pakda jaata hai");
  assert.match(body, /validation\|invalid/i, "sirf validation error par repair");
  assert.match(body, /applyValidations_\(\);/, "dropdowns (allowInvalid=true) dobara lagte hain");
  assert.equal((body.match(/setValues\(values\)/g) ?? []).length, 2, "pehli koshish + ek retry");
});
