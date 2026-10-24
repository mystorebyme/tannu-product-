import "server-only";

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { AuditEntry, InvoiceMeta, Order, OrderStatus, PaymentMethod, Tracking } from "@liksha/types";
import {
  COD_FEE,
  COD_MAX_SUBTOTAL,
  IDEMPOTENCY_TTL_MS,
  canTransition,
  computeDiscount,
  generateOrderNumber,
  invoiceNumber,
} from "@liksha/validation";
import { dataFile } from "@/lib/data-dir";
import { products } from "@/lib/store";

type StoredOrder = Order;

function readAll(): StoredOrder[] {
  const file = dataFile("orders.json");
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as StoredOrder[];
  } catch {
    return [];
  }
}

function writeAll(orders: StoredOrder[]) {
  const file = dataFile("orders.json");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(orders, null, 2));
  fs.renameSync(tmp, file); // atomic write -> partial file kabhi nahi
}

export interface CreateOrderPayload {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  items: { handle: string; size: string; quantity: number }[];
}

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "order_error",
  ) {
    super(message);
  }
}

/** price server par recompute hota hai — client ke bheje hue amount par bharosa nahi */
export function createOrder(payload: CreateOrderPayload): Order {
  if (!payload.items.length) throw new OrderError("Cart khaali hai.", 400, "empty_cart");

  const items = payload.items.map((line) => {
    const product = products.find((candidate) => candidate.handle === line.handle);
    if (!product) throw new OrderError(`Product nahi mila: ${line.handle}`, 400, "product_not_found");
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new OrderError(`Quantity 1 se 10 ke beech honi chahiye (${product.title}).`, 400, "invalid_item");
    }
    // size silently badalna galat order deta hai — customer ko saaf error do
    if (!product.sizes.includes(line.size)) {
      throw new OrderError(
        `${product.title} me size "${line.size}" available nahi hai. Options: ${product.sizes.join(", ")}`,
        400,
        "invalid_item",
      );
    }
    const size = line.size;
    return {
      handle: product.handle,
      title: product.title,
      image: product.images[0] ?? "",
      size,
      quantity,
      price: product.price,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = computeDiscount(subtotal, payload.couponCode);

  if (payload.paymentMethod === "cod" && subtotal > COD_MAX_SUBTOTAL) {
    throw new OrderError("COD sirf Rs. 3,500 se kam orders par available hai.", 400, "cod_not_allowed");
  }
  const codFee = payload.paymentMethod === "cod" ? COD_FEE : 0;
  const total = Math.max(0, subtotal - discount + codFee);

  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    orderNumber: generateOrderNumber(),
    createdAt: now,
    customerName: payload.customerName,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    pincode: payload.pincode,
    notes: payload.notes ?? null,
    items,
    subtotal,
    discount,
    shipping: 0,
    total,
    couponCode: payload.couponCode ?? null,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentMethod === "cod" ? "cod" : "pending",
    status: "placed",
    audit: [
      {
        at: now,
        actor: "customer",
        action: "order.placed",
        meta: { paymentMethod: payload.paymentMethod, total },
      },
    ],
  };

  const all = readAll();
  all.unshift(order);
  writeAll(all);
  return order;
}

export function listOrders(): Order[] {
  return readAll();
}

export function getOrder(orderNumberValue: string): Order | undefined {
  return readAll().find((order) => order.orderNumber === orderNumberValue);
}

export function updateOrderStatus(
  orderNumberValue: string,
  status: OrderStatus,
  actor = "admin",
  note?: string,
): Order {
  const all = readAll();
  const index = all.findIndex((order) => order.orderNumber === orderNumberValue);
  if (index === -1) throw new OrderError("Order nahi mila", 404, "order_not_found");
  const order = all[index]!;
  if (!canTransition(order.status, status)) {
    throw new OrderError(
      `Order ${orderNumberValue} ka status ${order.status} se ${status} nahi ho sakta.`,
      409,
      "invalid_transition",
    );
  }
  const entry: AuditEntry = {
    at: new Date().toISOString(),
    actor,
    action: `order.status.${status}`,
    meta: note ? { note } : undefined,
  };
  const updated: Order = {
    ...order,
    status,
    paymentStatus:
      status === "delivered" && order.paymentMethod === "cod" ? "paid" : order.paymentStatus,
    audit: [entry, ...order.audit],
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

/* ------------------------------------------------------------------ *
 * Tracking — admin courier/AWB daalta hai, customer track page dikhata hai.
 * ------------------------------------------------------------------ */

export function setTracking(
  orderNumberValue: string,
  input: { courier?: string | null; awb?: string | null; url?: string | null },
  actor = "admin",
): Order {
  const all = readAll();
  const index = all.findIndex((order) => order.orderNumber === orderNumberValue);
  if (index === -1) throw new OrderError("Order nahi mila", 404, "order_not_found");
  const order = all[index]!;
  const now = new Date().toISOString();
  const courier = input.courier?.trim() || null;
  const awb = input.awb?.trim() || null;
  const url = input.url?.trim() || null;

  const tracking: Tracking = {
    courier,
    awb,
    url,
    shippedAt: order.tracking?.shippedAt ?? (courier || awb ? now : null),
    deliveredAt: order.tracking?.deliveredAt ?? (order.status === "delivered" ? now : null),
    updatedAt: now,
    updatedBy: actor,
  };

  const updated: Order = {
    ...order,
    tracking,
    audit: [
      {
        at: now,
        actor,
        action: "order.tracking_updated",
        meta: { courier, awb, url },
      },
      ...order.audit,
    ],
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

/* ------------------------------------------------------------------ *
 * GST invoice — serial ek baar issue hone par lock.
 * ------------------------------------------------------------------ */

type InvoiceSequence = { next: number };

function nextInvoiceSerial(): number {
  const file = dataFile("invoice-seq.json");
  let state: InvoiceSequence = { next: 1 };
  if (fs.existsSync(file)) {
    try {
      state = JSON.parse(fs.readFileSync(file, "utf8")) as InvoiceSequence;
    } catch {
      state = { next: 1 };
    }
  }
  const serial = Math.max(1, Number(state.next) || 1);
  fs.writeFileSync(`${file}.${process.pid}.tmp`, JSON.stringify({ next: serial + 1 }, null, 2));
  fs.renameSync(`${file}.${process.pid}.tmp`, file);
  return serial;
}

/** Invoice meta assign karta hai (idempotent — dobara call par wahi number). */
export function ensureInvoice(orderNumberValue: string): { order: Order; invoice: InvoiceMeta } {
  const all = readAll();
  const index = all.findIndex((order) => order.orderNumber === orderNumberValue);
  if (index === -1) throw new OrderError("Order nahi mila", 404, "order_not_found");
  const order = all[index]!;
  if (order.invoice) return { order, invoice: order.invoice };

  const issuedAt = new Date().toISOString();
  const serial = nextInvoiceSerial();
  const invoice: InvoiceMeta = {
    number: invoiceNumber(serial, new Date(issuedAt)),
    issuedAt,
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    gstRate: 0,
    hsn: process.env.GST_HSN ?? "6204",
    placeOfSupply: order.state || "Rajasthan",
  };
  const updated: Order = {
    ...order,
    invoice,
    audit: [{ at: issuedAt, actor: "system", action: "invoice.issued", meta: { number: invoice.number } }, ...order.audit],
  };
  all[index] = updated;
  writeAll(all);
  return { order: updated, invoice };
}

export function markPaymentPaid(orderNumberValue: string, reference: string): Order | undefined {
  const all = readAll();
  const index = all.findIndex((order) => order.orderNumber === orderNumberValue);
  if (index === -1) return undefined;
  const order = all[index]!;
  all[index] = {
    ...order,
    paymentStatus: "paid",
    status: order.status === "placed" ? "confirmed" : order.status,
    audit: [
      {
        at: new Date().toISOString(),
        actor: "webhook",
        action: "payment.paid",
        meta: { reference },
      },
      ...order.audit,
    ],
  };
  writeAll(all);
  return all[index];
}


/* ------------------------------------------------------------------ *
 * Idempotency — double click / retry par ek hi order.
 * File me rakha jaata hai taaki server restart par bhi key zinda rahe.
 * ------------------------------------------------------------------ */

type IdempotencyRecord = { key: string; orderNumber: string; at: string };

function readIdempotency(): IdempotencyRecord[] {
  const file = dataFile("idempotency.json");
  if (!fs.existsSync(file)) return [];
  try {
    const rows = JSON.parse(fs.readFileSync(file, "utf8")) as IdempotencyRecord[];
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    return rows.filter((row) => new Date(row.at).getTime() > cutoff);
  } catch {
    return [];
  }
}

function writeIdempotency(rows: IdempotencyRecord[]) {
  const file = dataFile("idempotency.json");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, file);
}

export function findIdempotentOrder(key: string): Order | undefined {
  const record = readIdempotency().find((row) => row.key === key);
  return record ? getOrder(record.orderNumber) : undefined;
}

export function rememberIdempotency(key: string, orderNumberValue: string): void {
  const rows = readIdempotency().filter((row) => row.key !== key);
  rows.push({ key, orderNumber: orderNumberValue, at: new Date().toISOString() });
  writeIdempotency(rows);
}
