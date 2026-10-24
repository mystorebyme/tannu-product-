#!/usr/bin/env node
/**
 * Payment flow e2e — owner ka exact flow:
 *
 *   place order → payment page (alag) → order number wahan → pending
 *   → UTR submit → processing → payment confirm → paid + order confirmed
 *   → tracking page par wahi status
 *
 * Server chahiye:  PORT=3100 ADMIN_API_TOKEN=dev-admin-token npm run start --workspace @liksha/web
 * Chalao:          BASE_URL=http://127.0.0.1:3100 ADMIN_API_TOKEN=dev-admin-token node tests/e2e/payments.mjs
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.ADMIN_API_TOKEN ?? "dev-admin-token";

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const getJson = async (path) => {
  const response = await fetch(`${BASE}${path}`, { headers: { "cache-control": "no-store" } });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
};

const adminPatch = (path, payload) =>
  fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });

// ── 1. ek available product chuno ────────────────────────────────────────────
const products = await getJson("/api/products?limit=24");
const list = products.body?.products ?? products.body?.items ?? products.body?.data ?? [];
const candidate = list.find((product) => {
  const sizes = product.sizes ?? [];
  return sizes.some((size) => product.sizePricing?.[size]?.available !== false) && product.inStock !== false;
});
check("catalogue has a buyable product", Boolean(candidate));
if (!candidate) {
  console.log("payments: cannot continue without a product");
  process.exit(1);
}
const size = candidate.sizes.find((option) => candidate.sizePricing?.[option]?.available !== false);

// ── 2. order place (server validation) ───────────────────────────────────────
const phone = "9876543210";
const create = await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    customerName: "Payment Test",
    email: "payment-test@example.com",
    phone,
    address: "12 Test Street",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    paymentMethod: "prepaid",
    items: [{ handle: candidate.handle, size, quantity: 1 }],
  }),
});
const order = await create.json();
check("order creates with a generated order number", create.status === 201 && /^LK-[A-Z0-9]{6,}$/.test(order.orderNumber ?? ""), `${create.status}`);
check("new order starts as payment pending", order.paymentStatus === "pending", order.paymentStatus);
check("new order is not confirmed before payment", order.status === "placed", order.status);

const number = order.orderNumber;

// ── 3. payment page (alag route) ─────────────────────────────────────────────
const payPage = await fetch(`${BASE}/orders/${number}/pay`);
const payHtml = await payPage.text();
check("payment page renders separately", payPage.status === 200, String(payPage.status));
check("payment page shows the order number", payHtml.includes(number));
check("payment page shows the live payment state", payHtml.includes('data-testid="payment-state"'));
check("payment page keeps the UPI block here (not checkout)", payHtml.includes('data-testid="upi-payment"'));

// ── 4. status API (polling) ──────────────────────────────────────────────────
const status1 = await getJson(`/api/orders/${number}/payment`);
check("payment status API returns pending first", status1.body?.paymentStatus === "pending", status1.body?.paymentStatus);

// ── 5. reference submit → processing ────────────────────────────────────────
const manual = await fetch(`${BASE}/api/payments/manual`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ orderNumber: number, reference: "123456789012", phoneLast4: phone.slice(-4) }),
});
const manualBody = await manual.json();
check("UTR submit is accepted", manual.ok && manualBody.ok === true, JSON.stringify(manualBody).slice(0, 120));
const status2 = await getJson(`/api/orders/${number}/payment`);
check("status becomes processing (awaiting verification)", status2.body?.paymentStatus === "processing", status2.body?.paymentStatus);
check("order still not confirmed while payment is processing", status2.body?.status === "placed", status2.body?.status);

// ── 6. unpaid order dispatch nahi ho sakta ──────────────────────────────────
const blocked = await adminPatch(`/api/admin/orders/${number}`, { action: "status", status: "packed" });
const blockedBody = await blocked.json();
check("unpaid order cannot be packed", blocked.status === 409 && blockedBody.code === "payment_pending", `${blocked.status} ${blockedBody.code ?? ""}`);

// ── 7. admin payment confirm → order confirmed ──────────────────────────────
const paid = await adminPatch(`/api/admin/orders/${number}`, {
  action: "payment",
  reference: "123456789012",
  amount: order.total,
  note: "e2e",
});
const paidBody = await paid.json();
check("admin can mark payment verified", paid.ok, String(paid.status));
check("payment is paid in DB", paidBody.order?.paymentStatus === "paid", paidBody.order?.paymentStatus);
check("order becomes confirmed only after payment", paidBody.order?.status === "confirmed", paidBody.order?.status);
const status3 = await getJson(`/api/orders/${number}/payment`);
check("status API reports paid + confirmed", status3.body?.paymentStatus === "paid" && status3.body?.status === "confirmed");

// ── 8. paid order par payment page redirect ─────────────────────────────────
const payAfter = await fetch(`${BASE}/orders/${number}/pay`, { redirect: "manual" });
check("paid order skips the payment page", payAfter.status === 307 || payAfter.status === 308, String(payAfter.status));

// ── 9. order page = tracking, same status ───────────────────────────────────
const orderPage = await fetch(`${BASE}/orders/${number}`);
const orderHtml = await orderPage.text();
check("order page opens (tracking works)", orderPage.status === 200, String(orderPage.status));
check("order page shows the order number", orderHtml.includes(number));
check("order page shows payment confirmed", /Payment confirmed|payment-status/i.test(orderHtml));
check("order page has the tracking timeline", orderHtml.includes('data-testid="order-tracking"'));

// ── 10. failed payment bhi DB me save hota hai ──────────────────────────────
const create2 = await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    customerName: "Failure Test",
    email: "payment-fail@example.com",
    phone,
    address: "9 Test Street",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    paymentMethod: "prepaid",
    items: [{ handle: candidate.handle, size, quantity: 1 }],
  }),
});
const order2 = await create2.json();
const failBody = await (
  await fetch(`${BASE}/api/payments/failed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderNumber: order2.orderNumber, phoneLast4: phone.slice(-4), reason: "e2e failure" }),
  })
).json();
check("failed payment is recorded", failBody.ok === true, JSON.stringify(failBody).slice(0, 120));
const statusFail = await getJson(`/api/orders/${order2.orderNumber}/payment`);
check("failed status saved in DB", statusFail.body?.paymentStatus === "failed", statusFail.body?.paymentStatus);
check("failed order still unconfirmed", statusFail.body?.status === "placed", statusFail.body?.status);

// ── 11. unknown order = clean 404 ───────────────────────────────────────────
const missing = await fetch(`${BASE}/orders/LK-DOESNOTEXIST`);
check("unknown order shows the not-found page", missing.status === 404, String(missing.status));
const missingPay = await getJson("/api/orders/LK-DOESNOTEXIST/payment");
check("unknown order payment API is 404", missingPay.status === 404, String(missingPay.status));

console.log(`\npayments: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
