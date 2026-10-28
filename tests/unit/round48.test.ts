import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * R48 (owner):
 *   "2nd step jo continue aata ahi uski jgha whatshap pr send kre detail ok"
 *   — step 2 ka aage badhne wala button **direct WhatsApp send** hai; customer
 *   ke tap par hi poori detail (jo fill kiya + jo buy kiya) sheet wale owner
 *   number par jaati hai.
 *
 * R52 update (owner): "Send order on WhatsApp ye press krte hi direct whatsapp
 * hi khule ok kisi api se load na ho" — ab WhatsApp tap ke saath hi INSTANT
 * khulta hai (order API ka wait nahi); R48 wala blank-tab reserve +
 * "Placing your order… wait" beech ka step hata diya gaya. Order number
 * website par background me banta hai (detail round52.test.ts me).
 */

const root = process.cwd();
const FORM = path.join(root, "apps/web/src/components/checkout-form.tsx");
const form = fs.readFileSync(FORM, "utf8");

test("R48/R52: WhatsApp customer ke tap par hi khulta hai — number sheet se", () => {
  assert.match(form, /const \{ whatsapp \} = useStoreSettings\(\)/, "whatsapp number sheet settings se");
  assert.match(form, /function openWhatsAppNow\(href: string\): boolean/, "instant-open helper hai");
  assert.match(form, /if \(typeof window === "undefined" \|\| !href\) return false;/, "khali number/href = koi tab nahi");
  const submitAt = form.indexOf("async function submit(");
  const openAt = form.indexOf("const waOpened = openWhatsAppNow(instantWaHref)", submitAt);
  const orderAwaitAt = form.indexOf("await postJson", submitAt);
  assert.ok(submitAt > -1 && openAt > submitAt, "submit me instant-open call hai");
  assert.ok(orderAwaitAt > openAt, "WhatsApp order API ke await se PEHLE khulta hai (popup-block safe + instant)");
});

test("R52: purana wait-wala blank tab poori tarah gaya", () => {
  assert.ok(!form.includes("reserveWhatsAppTab"), "reserve helper gaya");
  assert.ok(!form.includes("openInReservedTab"), "reserved-tab fill gaya");
  assert.ok(!form.includes("closeReservedWa"), "reserved-tab close gaya");
  assert.ok(!form.includes("Placing your order… WhatsApp will open here"), "wait wali blank-tab copy gayi");
});

test("R48: step 2 ka resumed 'Continue' button ab bhi WhatsApp send hai", () => {
  assert.match(form, /Send order on WhatsApp · \{formatPrice\(shownTotal\)\}/, "resumed CTA = WhatsApp send");
  assert.ok(!form.includes("Continue · {formatPrice(shownTotal)}"), "purana 'Continue ·' label gaya");
  assert.match(form, /data-testid="review-continue-payment"/, "testid wahi (tests/e2e compat)");
  assert.match(form, /if \(resumed\) \{\s*goToPlaced\(resumed\.orderNumber/, "resume par dobara order nahi banta");
});

test("R48/R52: WhatsApp message me SAARI detail — jo fill kiya + jo buy kiya", () => {
  const start = form.indexOf("function orderWhatsAppHref");
  const body = form.slice(start, form.indexOf("function openWhatsAppNow"));
  assert.ok(start > -1 && body.length > 0, "orderWhatsAppHref mila");
  // jo buy kiya — har item
  for (const field of ["Order number:", "*Items (", "Size:", "Qty:", "Link:", "*Total:"]) {
    assert.ok(body.includes(field), `message me ${field} jaata hai`);
  }
  // jo fill kiya — customer form
  for (const field of ["*Customer details*", "Name:", "Phone:", "Email:", "Address:", "Notes:"]) {
    assert.ok(body.includes(field), `message me ${field} jaata hai`);
  }
  // coupon discount bhi
  assert.ok(body.includes("Coupon:"), "coupon detail message me");
  assert.ok(body.includes("Please confirm my order"), "confirm request");
});

test("R48/R52: customer ko pata chale button kya karta hai (English note)", () => {
  assert.match(form, /data-testid="checkout-whatsapp-note"/);
  assert.match(form, /WhatsApp opens instantly with your complete order details/, "note copy");
  // step indicator ka step 3 = WhatsApp (owner ne "3 · WhatsApp" bola)
  assert.match(form, /label: "WhatsApp"/);
});
