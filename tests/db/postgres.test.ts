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
  await db.exec(
    fs.readFileSync(path.resolve(__dirname, "../../database/migrations/0001_orders_runtime.sql"), "utf8"),
  );

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

after(async () => {
  await server.stop();
  await db.close();
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
