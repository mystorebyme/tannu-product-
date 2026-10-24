import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Catalog } from "@liksha/types";
import { dataDir } from "../helpers/orders-env.ts";
import * as service from "../../apps/api/src/modules/orders/orders.service.ts";
import { canTransition } from "@liksha/validation";

const catalog = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "database/seeds/catalog.json"), "utf8"),
) as Catalog;

// COD limit ke andar rehne ke liye sabse sasta multi-size product
const product = catalog.products
  .filter((item) => item.sizes.length > 1 && item.price <= 350_000)
  .sort((a, b) => a.price - b.price)[0]!;
const baseOrder = {
  customerName: "Test Buyer",
  email: "buyer@example.com",
  phone: "9876543210",
  address: "12 MI Road, Panch Batti",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
  paymentMethod: "cod" as const,
  items: [{ handle: product.handle, size: product.sizes[1]!, quantity: 1 }],
};

test("catalogue price is used, not any client value", () => {
  // client sirf handle/size/quantity bhejta hai — price catalogue se aata hai
  const order = service.create({
    ...baseOrder,
    paymentMethod: "prepaid",
    items: [{ ...baseOrder.items[0]!, quantity: 2 }],
  });
  assert.equal(order.items[0]!.price, product.price);
  assert.equal(order.subtotal, product.price * 2);
  assert.equal(order.total, product.price * 2);
  assert.equal(order.paymentStatus, "pending");
  assert.equal(order.status, "placed");
  assert.match(order.orderNumber, /^LK-[A-Z0-9]{6,12}$/);
});

test("coupon discount is applied server side", () => {
  const order = service.create({ ...baseOrder, couponCode: "LIKSHA10" });
  assert.equal(order.discount, Math.round(order.subtotal * 0.1));
  assert.equal(order.total, order.subtotal - order.discount + 5_000);
});

test("unknown size is rejected instead of silently substituted", () => {
  assert.throws(
    () => service.create({ ...baseOrder, items: [{ handle: product.handle, size: "ZZ [99]", quantity: 1 }] }),
    /not available/i,
  );
});

test("unknown product is rejected", () => {
  assert.throws(
    () => service.create({ ...baseOrder, items: [{ handle: "no-such-product", size: "S [36]", quantity: 1 }] }),
    /Product not found/i,
  );
});

test("COD above Rs. 3,500 is refused", () => {
  const expensive = catalog.products.find((item) => item.price > 350_000)!;
  assert.throws(
    () => service.create({ ...baseOrder, items: [{ handle: expensive.handle, size: expensive.sizes[0]!, quantity: 1 }] }),
    /COD/i,
  );
});

test("prepaid order above the COD limit is accepted", () => {
  const expensive = catalog.products.find((item) => item.price > 350_000)!;
  const order = service.create({
    ...baseOrder,
    paymentMethod: "prepaid",
    items: [{ handle: expensive.handle, size: expensive.sizes[0]!, quantity: 1 }],
  });
  assert.equal(order.paymentStatus, "pending");
  assert.equal(order.total, expensive.price);
});

test("status transitions are enforced", () => {
  const order = service.create(baseOrder);
  assert.throws(() => service.updateStatus(order.orderNumber, "delivered", "test"), /Invalid transition/i);
  const confirmed = service.updateStatus(order.orderNumber, "confirmed", "test");
  assert.equal(confirmed.status, "confirmed");
  const shipped = service.updateStatus(order.orderNumber, "packed", "test");
  assert.equal(shipped.status, "packed");
  assert.equal(canTransition("packed", "shipped"), true);
});

test("payment webhook flips pending order to paid + confirmed", () => {
  const order = service.create({ ...baseOrder, paymentMethod: "prepaid" });
  const paid = service.markPaid(order.orderNumber, "pay_test_123");
  assert.equal(paid!.paymentStatus, "paid");
  assert.equal(paid!.status, "confirmed");
  assert.equal(paid!.audit[0]!.action, "payment.paid");
});

test("orders persist to the data dir as an array", () => {
  const file = path.join(dataDir, "orders.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
  assert.ok(rows.length >= 5);
});
