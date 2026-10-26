/**
 * R35 — Sheet ki Settings tab me owner jo bhi likhe, wahi key bane.
 *
 * Owner ne "UPI ID" (space + capital) likha tha aur site `upi_id` dhoondh rahi thi —
 * isliye naya UPI kabhi site par nahi pahuncha. Ye test un saare roopon ko pin karta
 * hai jo owner ki sheet me aa sakte hain: `UPI ID`, `upi id`, `Upi-Id`, `upi_vpa`, `VPA`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSettingKey,
  normaliseSheetSettings,
  normaliseUpiId,
  parseSettingsCsv,
} from "../../apps/web/src/lib/sheet-format.ts";

test("UPI key ke saare roop ek hi value dete hain", () => {
  for (const key of ["upi_id", "UPI ID", "upi id", "Upi-Id", "upiId", "upi_vpa", "VPA", "payee_vpa"]) {
    const value = normaliseSheetSettings({ [key]: "naya@okaxis" });
    assert.equal(value?.upiId, "naya@okaxis", `key "${key}" nahi padhi gayi`);
  }
});

test("baaki settings bhi spelling ke hisaab se padhi jaati hain", () => {
  const value = normaliseSheetSettings({
    "Support Phone": "8005900581",
    "Free Shipping": "yes",
    "WhatsApp Number": "8005900581",
    "Payee Name": "Designer Clothing",
    Announcement: "Diwali Sale",
  });
  assert.equal(value?.supportPhone, "8005900581");
  assert.equal(value?.freeShipping, true);
  assert.equal(value?.whatsapp, "8005900581");
  assert.equal(value?.upiName, "Designer Clothing");
  assert.equal(value?.announcement, "Diwali Sale");
});

test("UPI value me label/space ho to bhi saaf ho jaati hai", () => {
  assert.equal(normaliseUpiId("UPI ID: naya@okaxis"), "naya@okaxis");
  assert.equal(normaliseUpiId("  naya@okaxis  "), "naya@okaxis");
  assert.equal(normaliseUpiId("naya @ okaxis"), "naya@okaxis");
  // VPA nahi hai — ignore (site galat UPI se kabhi na toote)
  assert.equal(normaliseUpiId("naya-okaxis"), undefined);
  assert.equal(normaliseUpiId(""), undefined);
  assert.equal(normaliseUpiId(12345), undefined);
});

test("published CSV me 'UPI ID' header ho to bhi UPI milta hai", () => {
  const value = parseSettingsCsv("key,value\nUPI ID,csv@ybl\nSupport Phone,8005900581\n");
  assert.equal(value?.upiId, "csv@ybl");
  assert.equal(value?.supportPhone, "8005900581");
});

test("Apps Script ka jawab (settings/data/nested) teeno shape me padha jaata hai", () => {
  assert.equal(normaliseSheetSettings({ settings: { "UPI ID": "naya@okaxis" } })?.upiId, "naya@okaxis");
  assert.equal(normaliseSheetSettings({ data: { "UPI ID": "naya@okaxis" } })?.upiId, "naya@okaxis");
  assert.equal(normaliseSheetSettings({ "UPI ID": "naya@okaxis" })?.upiId, "naya@okaxis");
  // ok:false = script ne mana kiya — koi setting nahi
  assert.equal(normaliseSheetSettings({ ok: false, error: "unauthorized" }), null);
});

test("canonicalSettingKey har spelling ko ek jaisa karta hai", () => {
  for (const key of ["UPI ID", "upi-id", " upi  id ", "Upi_Id"]) {
    assert.equal(canonicalSettingKey(key), "upi_id");
  }
});
