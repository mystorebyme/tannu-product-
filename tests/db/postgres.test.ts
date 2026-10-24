import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { isolate } from "../helpers/env.ts";

/**
 * Postgres backend ka end-to-end check.
 *
 * PGlite (WASM Postgres) ek local socket par asli Postgres jaisa chalta hai,
 * isliye `pg` driver + hamara SQL + schema sab as-is test hote hain. JSON store
 * bilkul use nahi hona chahiye.
 */

const dir = isolate("postgres");

let db: PGlite;
let server: PGLiteSocketServer;
let orders: typeof import("../../apps/web/src/lib/orders.ts");
let payload: Parameters<typeof orders.createOrder>[0];

before(async () => {
  db = await PGlite.create();

  const schema = fs
    .readFileSync(path.resolve(__dirname, "../../database/schema.sql"), "utf8")
    // PGlite me extensions nahi hote; schema same rehta hai (uuid core me hai)
    .replace(/create extension if not exists "[a-z]+";[^\n]*\n/g, "")
    .replace(/citext/g, "text");
  await db.exec(schema);
  const migrationsDir = path.resolve(__dirname, "../../database/migrations");
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
  }

  const port = 54_000 + Math.floor(Math.random() * 900);
  server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();

  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  delete process.env.STORE_API_URL;

  // env set hone ke baad import — orders module load par backend chunta hai
  orders = await import("../../apps/web/src/lib/orders.ts");
  const { products } = await import("../../apps/web/src/lib/store.ts");
  const product = products[0]!;
  payload = {
    customerName: "Postgres Tester",
    email: "pg@example.com",
    phone: "9876500000",
    address: "22 MI Road",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    paymentMethod: "prepaid",
    items: [{ handle: product.handle, size: product.sizes[0]!, quantity: 1 }],
  };
});


test("order Postgres me likha jaata hai, JSON file nahi banti", async () => {
  const order = await orders.createOrder(payload);
  assert.match(order.orderNumber, /^LK-/);
  assert.equal(order.status, "placed");
  assert.equal(fs.existsSync(path.join(dir, "orders.json")), false, "JSON store use nahi hona chahiye");

  const rows = await db.query<{ order_number: string; payment_status: string }>(
    "select order_number, payment_status::text as payment_status from orders where order_number = $1",
    [order.orderNumber],
  );
  assert.equal(rows.rows[0]?.order_number, order.orderNumber);
  assert.equal(rows.rows[0]?.payment_status, "pending");
});

test("admin status + tracking Postgres me persist hote hain", async () => {
  const { orderNumber } = await orders.createOrder(payload);
  await orders.updateOrderStatus(orderNumber, "confirmed", "admin@likshaclothing.com");
  await orders.setTracking(
    orderNumber,
    { courier: "Delhivery", awb: "AWB-PG-1", url: "https://www.delhivery.com/track/AWB-PG-1" },
    "admin@likshaclothing.com",
  );

  const reread = await orders.getOrder(orderNumber);
  assert.equal(reread?.status, "confirmed");
  assert.equal(reread?.tracking?.awb, "AWB-PG-1");
  assert.equal(reread?.tracking?.courier, "Delhivery");

  // DB me bhi wahi data (restart ke baad bhi rahega)
  const shipment = await db.query<{ awb: string }>(
    `select s.awb from shipments s join orders o on o.id = s.order_id where o.order_number = $1`,
    [orderNumber],
  );
  assert.equal(shipment.rows[0]?.awb, "AWB-PG-1");
});

test("invoice serial DB se aata hai (deploy par repeat nahi)", async () => {
  const first = await orders.createOrder(payload);
  const second = await orders.createOrder(payload);
  const a = await orders.ensureInvoice(first.orderNumber);
  const b = await orders.ensureInvoice(second.orderNumber);
  assert.match(a.invoice.number, /^LK\/\d{4}-\d{2}\/0001$/);
  assert.match(b.invoice.number, /^LK\/\d{4}-\d{2}\/0002$/);
  // dobara call par wahi number (idempotent)
  assert.equal((await orders.ensureInvoice(first.orderNumber)).invoice.number, a.invoice.number);
});

test("payment verify hone par order confirmed hota hai", async () => {
  const { orderNumber } = await orders.createOrder(payload);
  const result = await orders.confirmPayment(orderNumber, {
    gateway: "manual-upi",
    reference: "UPI-REF-1",
    amount: 100,
    actor: "admin@likshaclothing.com",
  });
  assert.equal(result?.order.paymentStatus, "paid");
  assert.equal(result?.order.status, "confirmed");

  const status = await orders.paymentStatusFor(orderNumber);
  assert.equal(status?.paymentStatus, "paid");
});

test("blocked pincode par order place nahi hota", async () => {
  const delivery = await import("../../apps/web/src/lib/delivery.ts");
  await delivery.saveDeliverySettings(
    {
      allowAllStates: true,
      states: {},
      blockedPincodes: [{ pincode: "302003", at: new Date().toISOString() }],
      allowedPincodes: [],
      deliveryDays: "4-7 business days",
      freeShipping: true,
    },
    "admin@likshaclothing.com",
  );

  const blocked = await orders
    .createOrder({ ...payload, pincode: "302003" })
    .then(() => null)
    .catch((error: Error & { code?: string }) => error);
  assert.ok(blocked, "blocked pincode par order ban gaya");
  assert.equal(blocked!.code, "pincode_not_serviceable");

  const fake = await orders
    .createOrder({ ...payload, pincode: "999999" })
    .then(() => null)
    .catch((error: Error & { code?: string }) => error);
  assert.equal(fake?.code, "pincode_not_serviceable");
});

test("delivery rules Postgres me persist hote hain aur pincode check par lagte hain", async () => {
  const delivery = await import("../../apps/web/src/lib/delivery.ts");

  // default: sab allowed, par faltu pincode phir bhi reject
  assert.equal((await delivery.checkPincode("302001")).serviceable, true);
  assert.equal((await delivery.checkPincode("999999")).serviceable, false);

  // admin sirf Rajasthan allow kare + ek Jaipur pincode block kare
  await delivery.saveDeliverySettings(
    {
      allowAllStates: false,
      states: { Rajasthan: true },
      blockedPincodes: [{ pincode: "302001", at: new Date().toISOString() }],
      allowedPincodes: [{ pincode: "400001", at: new Date().toISOString() }],
      deliveryDays: "3-5 business days",
      freeShipping: true,
    },
    "admin@likshaclothing.com",
  );

  const saved = await delivery.getDeliverySettings({ fresh: true });
  assert.equal(saved.allowAllStates, false);
  assert.equal(saved.states.Rajasthan, true);
  assert.equal(saved.blockedPincodes.length, 1);
  assert.equal(saved.deliveryDays, "3-5 business days");

  const blocked = await delivery.checkPincode("302001");
  assert.equal(blocked.serviceable, false);
  assert.equal(blocked.reason, "blocked");

  const otherRajasthan = await delivery.checkPincode("302002");
  assert.equal(otherRajasthan.serviceable, true);
  assert.equal(otherRajasthan.deliveryDays, "3-5 business days");

  const gujarat = await delivery.checkPincode("380001");
  assert.equal(gujarat.serviceable, false);
  assert.equal(gujarat.reason, "state_blocked");

  // allowed override blocked state me bhi chalta hai
  assert.equal((await delivery.checkPincode("400001")).serviceable, true);

  // DB me row bani
  const rows = await db.query<{ id: string }>("select id from delivery_settings");
  assert.equal(rows.rows[0]?.id, "default");
});

after(async () => {
  await server.stop();
  await db.close();
});
