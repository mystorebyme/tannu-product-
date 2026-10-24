import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Checkout = **3 steps** (owner requirement):
 *   1. delivery details → 2. review → 3. payment page (alag URL).
 *
 * Address aur payment kabhi ek hi screen par nahi aane chahiye — payment ki
 * poori detail sirf `/orders/<number>/pay` par hai.
 */

const root = process.cwd();
const checkout = fs.readFileSync(
  path.join(root, "apps/web/src/components/checkout-form.tsx"),
  "utf8",
);
const payPage = fs.readFileSync(
  path.join(root, "apps/web/src/app/orders/[orderNumber]/pay/page.tsx"),
  "utf8",
);
const upiPayment = fs.readFileSync(
  path.join(root, "apps/web/src/components/upi-payment.tsx"),
  "utf8",
);
const upiLib = fs.readFileSync(path.join(root, "apps/web/src/lib/upi.ts"), "utf8");
/** comments hata kar check karo — UI copy + code me UPI ka zikr na ho */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");
const checkoutCode = stripComments(checkout);

test("checkout has a 3-step indicator", () => {
  assert.match(checkout, /data-testid="checkout-steps"/);
  assert.match(checkout, /Delivery/);
  assert.match(checkout, /Review/);
  assert.match(checkout, /Payment/);
});

test("checkout step 1 continues to review, order is placed only from review", () => {
  assert.match(checkout, /data-testid="checkout-continue"/);
  assert.match(checkout, /data-testid="checkout-review"/);
  assert.match(checkout, /setStep\("review"\)/);
  // submit button sirf review step me dikhta hai
  assert.match(checkout, /step === "details" \? \(\s*<button\s+type="button"/);
});

test("checkout me UPI ID / QR / 'pay here' bilkul nahi — wo sirf payment page par", () => {
  assert.ok(!checkout.includes('data-testid="upi-payment"'), "checkout par UPI block nahi hona chahiye");
  assert.ok(!/UpiApps|upi-apps/.test(checkout), "koi UPI app chip nahi");
  // UPI QR / upi:// link / "UPI ID" copy checkout par kabhi nahi
  assert.ok(!/UpiQr/.test(checkout), "checkout par UPI QR nahi");
  assert.ok(!/buildUpiUri/.test(checkout), "checkout par upi:// link nahi");
  assert.ok(!/UPI ID/i.test(checkoutCode), "checkout par 'UPI ID' text nahi");
  assert.ok(!/upiId|upiName/.test(checkoutCode), "checkout par UPI settings nahi");
  assert.ok(!/dhakadgourav/.test(checkout), "UPI ID hard-code nahi");
  assert.match(payPage, /UpiPayment/);
});

test("payment page par ek hi 'Open UPI app' + auto status detection (koi app brand nahi)", () => {
  assert.match(upiLib, /export function buildUpiUri/);
  assert.match(upiPayment, /data-testid="upi-open"/);
  assert.match(upiPayment, /data-testid="upi-recheck"/);
  // owner rule: GPay/PhonePe/Paytm ke naam kahin nahi
  assert.ok(!/Google Pay|PhonePe|Paytm|BHIM/i.test(upiPayment), "payment page par app brand nahi");
  assert.ok(!/tez:\/\/|phonepe:\/\/|paytmmp:\/\//.test(upiPayment), "app-specific schemes nahi");
  assert.match(payPage, /PaymentStatusWatcher/);
});

test("order place hote hi payment page khulta hai (?pay=1 se UPI app chooser)", () => {
  assert.match(checkout, /router\.push\(`\/orders\/\$\{[^}]+\}\/pay\?pay=1`\)/);
});

test("checkout funnel events DB + sheet me jaate hain", () => {
  assert.match(checkout, /checkout\.started/);
  assert.match(checkout, /order\.failed/);
  assert.match(checkout, /\/api\/checkout\/events/);
});
