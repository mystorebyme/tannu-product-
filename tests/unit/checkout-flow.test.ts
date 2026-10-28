import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Checkout = **3 steps** (owner requirement, R46 me update):
 *   1. delivery details → 2. review (+coupon) → 3. **order placed + WhatsApp
 *   confirmation** — isi page par (alag page nahi).
 *
 * R46 (owner): online payment **hold** par hai — checkout me payment step nahi.
 * Order place hote hi confirmation card khulta hai jo poori order detail WhatsApp
 * par bhejta hai; team confirm karke payment arrange karti hai.
 * `/orders/<number>/pay` deep links (WhatsApp/email/QR) ke liye bacha hai aur
 * wahi `UpiPayment` render karta hai.
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
  assert.match(checkout, /label: "WhatsApp"/);
});

test("checkout step 1 continues to review, order is placed only from review", () => {
  assert.match(checkout, /data-testid="checkout-continue"/);
  assert.match(checkout, /data-testid="checkout-review"/);
  assert.match(checkout, /setStep\("review"\)/);
  // submit button sirf review step me dikhta hai (R46: placed step alag shell me hai)
  assert.match(checkout, /const showDetails = !isPlaced && !resumed && step === "details"/);
  assert.match(checkout, /\)\s*:\s*showDetails \? \(\s*<button\s+type="button"/);
});

test("step 1/2 me UPI ID / QR / 'pay here' nahi — R46: payment checkout se hata hi diya gaya", () => {
  // checkout form khud UPI render nahi karta — payment step ab hai hi nahi
  assert.ok(!checkout.includes('data-testid="upi-payment"'), "checkout form me UPI block nahi");
  assert.ok(!/UpiApps|upi-apps/.test(checkout), "koi UPI app chip nahi");
  assert.ok(!/UpiQr/.test(checkout), "checkout form me UPI QR nahi");
  assert.ok(!/buildUpiUri/.test(checkout), "checkout form me upi:// link nahi");
  assert.ok(!/upi:\/\//.test(checkout), "checkout form me UPI scheme nahi");
  assert.ok(!/UPI ID/i.test(checkoutCode), "checkout par 'UPI ID' text nahi");
  assert.ok(!/dhakadgourav/.test(checkout), "UPI ID hard-code nahi");
  assert.ok(!/CheckoutPaymentStep/.test(checkoutCode), "payment step component checkout me nahi");
  // step 3 = placed confirmation card, sirf isPlaced par
  assert.match(checkout, /data-testid="checkout-placed-step"/);
  assert.match(checkout, /\{isPlaced \? \(/);
  assert.match(payPage, /UpiPayment/);
});

test("payment par ek hi 'Pay on UPI' button + auto status detection (koi app brand nahi)", () => {
  assert.match(upiLib, /export function buildUpiUri/);
  assert.match(upiPayment, /data-testid="upi-open"/);
  assert.match(upiPayment, /data-testid="upi-recheck"/);
  assert.match(upiPayment, /Pay on UPI/);
  // owner rule: GPay/PhonePe/Paytm ke naam kahin nahi
  assert.ok(!/Google Pay|PhonePe|Paytm|BHIM/i.test(upiPayment), "payment page par app brand nahi");
  assert.ok(!/tez:\/\/|phonepe:\/\/|paytmmp:\/\//.test(upiPayment), "app-specific schemes nahi");
  assert.match(payPage, /PaymentStatusWatcher/);
});

test("order place hote hi confirmation step 3 checkout ke andar khulta hai (alag page nahi)", () => {
  assert.match(checkout, /goToPlaced\(result\.data\.orderNumber/);
  assert.match(checkout, /window\.history\.pushState\(\{\}, "", placedUrl\(target\)\)/);
  assert.doesNotMatch(checkout, /router\.push\(`\/orders\//, "order page par redirect nahi");
  assert.doesNotMatch(checkout, /\?pay=1/, "UPI auto-open wala flag hata diya gaya");
});

test("R46: confirmation step par WhatsApp CTA + order details ka raasta", () => {
  assert.match(checkout, /data-testid="placed-whatsapp"/);
  assert.match(checkout, /orderWhatsAppHref/);
  assert.match(checkout, /Send order on WhatsApp/);
  assert.match(checkout, /data-testid="payment-order-details"/);
  // WhatsApp message me poori detail: items + links + total + address
  assert.match(checkout, /productUrl\(/);
});

test("R46: coupon payment ki jagah — review step par coupon box", () => {
  assert.match(checkout, /data-testid="coupon-box"/);
  assert.match(checkout, /data-testid="coupon-input"/);
  assert.match(checkout, /data-testid="coupon-apply"/);
  assert.match(checkout, /data-testid="coupon-status"/);
  assert.match(checkout, /\/api\/coupons\/check/);
  // order POST me couponCode jaata hai
  assert.match(checkout, /couponCode: coupon\?\.code \?\? null/);
});

test("checkout funnel events DB + sheet me jaate hain", () => {
  assert.match(checkout, /checkout\.started/);
  assert.match(checkout, /order\.failed/);
  assert.match(checkout, /\/api\/checkout\/events/);
});
