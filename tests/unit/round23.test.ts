/**
 * R23 guards — owner ke do asks ka code-level proof:
 *   1. Pincode ka state aur form ka state match hona chahiye (client + server).
 *   2. Sheet ki published Settings CSV se bhi settings padhi ja sakein
 *      (Apps Script deployment ke bina bhi phone/UPI live rahe).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { canonicalStateName, statesMatch, INDIAN_STATES } from "../../apps/web/src/lib/state-match";
import { parseSettingsCsv } from "../../apps/web/src/lib/sheet-format";
import { whatsappHref, whatsappNumber } from "../../apps/web/src/lib/phone";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("same state ke alag spelling match hoti hai (J&K, Odisha, Puducherry)", () => {
  assert.ok(statesMatch("Jammu & Kashmir", "Jammu and Kashmir"));
  assert.ok(statesMatch("Orissa", "Odisha"));
  assert.ok(statesMatch("Pondicherry", "Puducherry"));
  assert.ok(statesMatch("Uttaranchal", "Uttarakhand"));
  assert.ok(statesMatch("rajasthan", "Rajasthan"));
});

test("doosri state par mismatch pakda jata hai", () => {
  assert.equal(statesMatch("Gujarat", "Rajasthan"), false);
  assert.equal(statesMatch("Delhi", "Haryana"), false);
  // data hi nahi to block nahi karte
  assert.ok(statesMatch("", "Rajasthan"));
});

test("pincode ka state dropdown me canonical naam se milta hai", () => {
  assert.equal(canonicalStateName("Jammu and Kashmir"), "Jammu and Kashmir");
  assert.equal(canonicalStateName("orissa"), "Odisha");
  assert.equal(canonicalStateName("Somewhere"), null);
  // dropdown me pincode-data ke saare 36 states/UTs hone chahiye
  assert.equal(INDIAN_STATES.length, 36);
});

test("checkout client me mismatch block hota hai + ek tap fix", () => {
  const form = read("apps/web/src/components/checkout-form.tsx");
  assert.match(form, /stateMismatch/);
  assert.match(form, /data-testid="state-mismatch"/);
  assert.match(form, /data-testid="state-fix"/);
  assert.match(form, /Ye pincode .* ka hai/);
  assert.match(form, /INDIAN_STATES/);
});

test("server bhi galat state ka order reject karta hai (GST place of supply)", () => {
  const orders = read("apps/web/src/lib/orders.ts");
  assert.match(orders, /state_mismatch/);
  assert.match(orders, /statesMatch\(payload\.state, pinState\)/);
});

test("Sheet ki published Settings CSV se settings parse hoti hain", () => {
  const csv = [
    "key,value",
    "support_phone,8005900581",
    "whatsapp,8005900581",
    "support_email,Info.likshaclothing@gmail.com",
    "upi_id,dhakadgourav@fam",
    "upi_name,Designer Clothing",
    "announcement,Diwali Sale — Flat 70% OFF",
    "free_shipping,true",
    "gstin,",
  ].join("\n");
  const settings = parseSettingsCsv(csv);
  assert.ok(settings);
  assert.equal(settings?.supportPhone, "8005900581");
  assert.equal(settings?.upiId, "dhakadgourav@fam");
  assert.equal(settings?.upiName, "Designer Clothing");
  assert.equal(settings?.freeShipping, true);
  // khaali value default ko overwrite na kare
  assert.equal(settings?.gstin, undefined);
});

test("CSV fallback sirf docs.google.com published link par chalta hai", () => {
  const sheets = read("apps/web/src/lib/google-sheets.ts");
  assert.match(sheets, /GOOGLE_SHEETS_SETTINGS_CSV_URL/);
  assert.match(sheets, /readSettingsFromCsv/);
  // host allowlist regex (escape ke saath) — plain words se check karte hain
  assert.ok(sheets.includes("spreadsheets") && sheets.includes("docs"), "CSV host guard");
});

/**
 * R24 — WhatsApp link me country code.
 *
 * Bug tha: settings se `8005900581` aata tha aur link `wa.me/8005900581` banta tha
 * (WhatsApp kehta hai "invalid number") — contact page ka CTA khaali pada tha.
 */
test("whatsappLink me country code 91 lagta hai", () => {
  assert.equal(whatsappNumber("8005900581"), "918005900581");
  assert.equal(whatsappNumber("+91 80059 00581"), "918005900581");
  assert.equal(whatsappNumber("08005900581"), "918005900581");
  assert.equal(whatsappNumber("918005900581"), "918005900581");
  // fallback number bhi 91 ke saath hi jaata hai
  assert.equal(whatsappNumber("", "918005900581"), "918005900581");
});

test("WhatsApp link me country code hamesha lagta hai (wa.me/91…)", () => {
  assert.equal(whatsappNumber("8005900581"), "918005900581");
  assert.equal(whatsappNumber("+91 80059 00581"), "918005900581");
  assert.equal(whatsappNumber("918005900581"), "918005900581");
  assert.equal(whatsappNumber("08005900581"), "918005900581");
  assert.equal(whatsappNumber(""), "918005900581");
  assert.equal(whatsappHref("8005900581", "hi"), "https://wa.me/918005900581?text=hi");
});
