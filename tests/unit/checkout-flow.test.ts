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

test("checkout me UPI block nahi — wo sirf payment page par", () => {
  assert.ok(!checkout.includes('data-testid="upi-payment"'), "checkout par UPI block nahi hona chahiye");
  assert.ok(!/UpiApps|upi-apps/.test(checkout), "koi UPI app chip nahi");
  assert.match(payPage, /UpiPayment/);
});

test("order place hote hi payment page khulta hai", () => {
  assert.match(checkout, /router\.push\(`\/orders\/\$\{[^}]+\}\/pay`\)/);
});
