import test, { before } from "node:test";
import assert from "node:assert/strict";
import { isolate } from "../helpers/env.ts";

/**
 * R45 (owner): "UPI ID aur phone sheet se delete kiye — site se turant jaane
 * chahiye; kitni baar bolu ye hardcoded nahi honi chahiye."
 *
 * Purana bug: merge me `...(sheet.upiId ? {...} : {})` tha — sheet ki **khaali**
 * value ignore ho kar stored/env/hardcoded default chalta rehta tha. Ab:
 *   • sheet read successful ⇒ owner-editable keys me sheet ki value jeetti hai,
 *     khaali string bhi ("" = owner ne clear/delete kiya).
 *   • key sheet response me hai hi nahi (purana script) ⇒ stored/last-good chalta hai.
 *   • read fail ⇒ last good value (hardcoded par nahi jaate).
 *
 * Chalane ka tarika: `npm run test:sheets` (--conditions=react-server).
 */

const SHEET_URL = "https://script.google.com/macros/s/AKfycbTEST45/exec";

type StubReply = { body?: unknown; error?: string };
let handler: (url: string) => StubReply = () => ({ error: "no stub set" });

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(typeof input === "string" ? input : (input as Request).url ?? input);
    const reply = handler(url);
    if (reply.error) throw new Error(reply.error);
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const sheetReply = (settings: Record<string, unknown>): StubReply => ({
  body: { ok: true, version: "r45-test", settings },
});

let store: typeof import("../../apps/web/src/lib/store-settings.ts");
let invoice: typeof import("../../apps/web/src/lib/invoice.ts");

before(async () => {
  isolate("round45-settings", {
    GOOGLE_SHEETS_WEBAPP_URL: SHEET_URL,
    GOOGLE_SHEETS_TOKEN: "test-token",
    SHEET_SETTINGS_TTL_MS: "50",
    // env fallback set ho to bhi sheet ki khaali value jeetni chahiye
    STORE_UPI_ID: "env-emergency@upi",
    DATA_DIR: process.env.DATA_DIR ?? "/tmp/liksha-round45-settings",
  });
  installFetchStub();
  store = await import("../../apps/web/src/lib/store-settings.ts");
  invoice = await import("../../apps/web/src/lib/invoice.ts");
});

test("R45: sheet me value clear ('') = site par '' — env/stored/default jeetta nahi", async () => {
  handler = () =>
    sheetReply({
      upi_id: "",
      upi_name: "",
      support_phone: "",
      whatsapp: "",
      announcement: "Sale live",
    });
  const settings = await store.getStoreSettings({ fresh: true });
  assert.equal(settings.upiId, "", "owner ne upi_id delete kiya → site par khaali (env fallback nahi)");
  assert.equal(settings.supportPhone, "");
  assert.equal(settings.whatsapp, "");
  assert.equal(settings.upiName, "");
  assert.equal(settings.announcement, "Sale live", "bhari hui keys pehle jaisi sheet se aati hain");
  assert.equal(settings.updatedBy, "google-sheet");
});

test("R45: bhari sheet → owner delete kare → agli fresh read par value gayab", async () => {
  handler = () => sheetReply({ upi_id: "owner@ybl", whatsapp: "8005900581", support_phone: "8005900581" });
  const before_ = await store.getStoreSettings({ fresh: true });
  assert.equal(before_.upiId, "owner@ybl");
  assert.equal(before_.whatsapp, "8005900581");

  // owner ne sheet se rows/values hata diye (naya script '' bhejta hai)
  handler = () => sheetReply({ upi_id: "", whatsapp: "", support_phone: "" });
  const after = await store.getStoreSettings({ fresh: true });
  assert.equal(after.upiId, "", "delete ka asar turant (redeploy nahi)");
  assert.equal(after.whatsapp, "");
  assert.equal(after.supportPhone, "");
});

test("R45: sheet read fail → last good value chalti rahe, hardcoded default par nahi jaate", async () => {
  handler = () => sheetReply({ upi_id: "owner@ybl", whatsapp: "9876543210", support_phone: "9876543210" });
  const good = await store.getStoreSettings({ fresh: true });
  assert.equal(good.upiId, "owner@ybl");

  handler = () => ({ error: "boom — Apps Script down" });
  const during = await store.getStoreSettings({ fresh: true });
  assert.equal(during.upiId, "owner@ybl", "script down = last good (customer ka paisa sahi VPA par)");
  assert.equal(during.whatsapp, "9876543210");
});

test("R45: purana script (keys missing) → stored/default chalta rahe, '' force nahi hota", async () => {
  // r40-1 jaisa script: sirf jo rows bhari hain wahi bhejta hai
  handler = () => sheetReply({ announcement: "Old script" });
  const settings = await store.getStoreSettings({ fresh: true });
  assert.equal(settings.announcement, "Old script");
  assert.equal(
    settings.upiId,
    "env-emergency@upi",
    "missing key = stored/env default chalta rahe (undefined se override nahi hota)",
  );
});

test("R45: normalizeStoreSettings — khaali string preserve, missing key par base default", () => {
  const cleared = store.normalizeStoreSettings({ upiId: "", whatsapp: "", supportPhone: "", supportEmail: "" });
  assert.equal(cleared.upiId, "");
  assert.equal(cleared.whatsapp, "");
  assert.equal(cleared.supportPhone, "");

  const base = store.normalizeStoreSettings({});
  assert.equal(base.supportPhone, "", "DEFAULT me koi hardcoded phone nahi");
  assert.equal(base.whatsapp, "", "DEFAULT me koi hardcoded whatsapp nahi");
  assert.equal(store.DEFAULT_STORE_SETTINGS.supportPhone, "");
  assert.equal(store.DEFAULT_STORE_SETTINGS.whatsapp, "");
});

test("R45: whatsappLink/orderWhatsAppLink — number khali to '' (order/cart CTA chhup jaate hain)", async () => {
  const { whatsappLink, orderWhatsAppLink } = await import("../../apps/web/src/lib/whatsapp.ts");
  assert.equal(whatsappLink("hello"), "", "default number hata diya");
  assert.equal(whatsappLink("hello", ""), "");
  assert.equal(
    whatsappLink("hello", "8005900581"),
    `https://wa.me/918005900581?text=${encodeURIComponent("hello")}`,
  );
  const order = {
    orderNumber: "LK-TEST",
    customerName: "Test",
    phone: "9876543210",
    email: "",
    items: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    total: 0,
    paymentStatus: "pending",
  } as never;
  assert.equal(orderWhatsAppLink(order, "https://example.com"), "", "bina number ke link nahi");
  assert.ok(orderWhatsAppLink(order, "https://example.com", "8005900581").startsWith("https://wa.me/918005900581"));
});

test("R45: invoice seller phone — settings khali to invoice par bhi khali (hardcoded '+91 80059…' gaya)", () => {
  const seller = invoice.sellerFromSettings({ supportPhone: "" });
  assert.equal(seller.phone, "", "khaali settings = khaali phone");
  const filled = invoice.sellerFromSettings({ supportPhone: "8005900581" });
  assert.equal(filled.phone, "8005900581", "sheet ka number invoice par dikhta hai");
});
