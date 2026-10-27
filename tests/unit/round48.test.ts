import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * R48 (owner):
 *   "3 · WhatsApp. ye 3rd step hai isme saari detail whatshap send krvavo jo
 *    owner ka hai number sheet se fetched usme order ki saari detail jani chiye
 *    jo jo fill kiya hai or jo jo buy kiya … ya aisa kro ki 2nd step mai jo
 *    contimue kr ke 3rd step mai jate to 2nd step jo continue aata ahi uski
 *    jgha whatshap pr send kre detail ok ye kr ok"
 *
 * Matlab: step 2 ka aage badhne wala button **direct WhatsApp send** hai —
 * customer ke tap par hi WhatsApp tab reserve hota hai (popup-block safe) aur
 * order bante hi poori detail (jo fill kiya + jo buy kiya) sheet wale owner
 * number par chali jaati hai.
 */

const root = process.cwd();
const FORM = path.join(root, "apps/web/src/components/checkout-form.tsx");
const form = fs.readFileSync(FORM, "utf8");

test("R48: WhatsApp tab tap par synchronously reserve hota hai — await se pehle", () => {
  assert.match(form, /function reserveWhatsAppTab\(\): Window \| null/, "reserve helper hai");
  assert.match(form, /window\.open\("", "_blank"\)/, "blank tab user gesture me khulta hai");
  const submitAt = form.indexOf("async function submit(");
  assert.ok(submitAt > -1, "submit handler mila");
  const reserveAt = form.indexOf("const reservedWa = reserveWhatsAppTab()", submitAt);
  const couponAwaitAt = form.indexOf("await applyCoupon()", submitAt);
  const orderAwaitAt = form.indexOf("await postJson", submitAt);
  assert.ok(reserveAt > submitAt, "submit me reserve call hai");
  assert.ok(couponAwaitAt > submitAt && orderAwaitAt > submitAt, "submit ke awaits mile");
  assert.ok(
    reserveAt < couponAwaitAt && reserveAt < orderAwaitAt,
    "reserve kisi bhi await se PEHLE hona chahiye (warna popup block)",
  );
  // number sheet se (R45: hardcoded number nahi) — khali number = koi tab nahi
  assert.match(form, /if \(!whatsappNumber\(whatsapp\)\) return null;/, "sheet ka number khali = tab nahi");
  assert.match(form, /const \{ whatsapp \} = useStoreSettings\(\)/, "whatsapp number sheet settings se");
});

test("R48: order bante hi reserved tab me poori detail waala wa.me link", () => {
  assert.match(form, /function openInReservedTab\(reserved: Window \| null, href: string\): boolean/);
  assert.match(form, /const waSent = openInReservedTab\(reservedWa, waHref\)/, "step 2 send = reserved tab");
  assert.match(form, /reserved\.location\.href = href/, "tab me wa.me bhara jaata hai");
  // dobara na khule — warna WhatsApp ke do tab ban jaate
  assert.match(form, /goToPlaced\(result\.data\.orderNumber, waSent \? undefined : waHref \|\| undefined\)/);
  // purana fallback (step 3 button + window.open attempt) barkaraar
  assert.match(form, /window\.open\(waHref, "_blank", "noopener,noreferrer"\)/);
  assert.match(form, /data-testid="placed-whatsapp"/);
});

test("R48: order fail/validation fail par reserved blank tab band hota hai", () => {
  const closes = form.split("closeReservedWa();").length - 1;
  assert.ok(closes >= 5, `har failure path par tab close (mile ${closes} calls)`);
});

test("R48: step 2 ka resumed 'Continue' button ab WhatsApp send hai", () => {
  assert.match(form, /Send order on WhatsApp · \{formatPrice\(shownTotal\)\}/, "resumed CTA = WhatsApp send");
  assert.ok(!form.includes("Continue · {formatPrice(shownTotal)}"), "purana 'Continue ·' label gaya");
  assert.match(form, /data-testid="review-continue-payment"/, "testid wahi (tests/e2e compat)");
  assert.match(form, /if \(resumed\) \{\s*goToPlaced\(resumed\.orderNumber/, "resume par dobara order nahi banta");
});

test("R48: WhatsApp message me SAARI detail — jo fill kiya + jo buy kiya", () => {
  const start = form.indexOf("function placedWhatsAppHref");
  const body = form.slice(start, form.indexOf("function reserveWhatsAppTab"));
  assert.ok(start > -1 && body.length > 0, "placedWhatsAppHref mila");
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

test("R48: customer ko pata chale button kya karta hai (English note)", () => {
  assert.match(form, /data-testid="checkout-whatsapp-note"/);
  assert.match(form, /WhatsApp will open with your complete order details/, "note copy");
  // step indicator ka step 3 = WhatsApp (owner ne "3 · WhatsApp" bola)
  assert.match(form, /label: "WhatsApp"/);
});
