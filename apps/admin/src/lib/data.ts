import fs from "node:fs";
import path from "node:path";
import type { Catalog, Order, Product } from "@liksha/types";
import { canTransition } from "@liksha/validation";
import catalogJson from "../data/catalog.json";

export function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(dir, "turbo.json")) || fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function dataFile(name: string): string {
  const dir = process.env.DATA_DIR ?? path.join(repoRoot(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

function readRows<T>(name: string): T[] {
  const file = dataFile(name);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeRows<T>(name: string, rows: T[]) {
  const file = dataFile(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, file);
}

export type Override = { handle: string; price?: number; inStock?: boolean; updatedAt: string };

/** Catalogue base JSON hai; admin ke edits override file me jaate hain (source data safe rehta hai) */
export function getProducts(): Product[] {
  const catalog = catalogJson as unknown as Catalog;
  const overrides = readRows<Override>("catalog-overrides.json");
  if (overrides.length === 0) return catalog.products;
  const map = new Map(overrides.map((row) => [row.handle, row]));
  return catalog.products.map((product) => {
    const override = map.get(product.handle);
    return override
      ? {
          ...product,
          price: override.price ?? product.price,
          inStock: override.inStock ?? product.inStock,
        }
      : product;
  });
}

export function saveOverride(handle: string, patch: { price?: number; inStock?: boolean }) {
  const rows = readRows<Override>("catalog-overrides.json");
  const index = rows.findIndex((row) => row.handle === handle);
  const next: Override = {
    ...rows[index],
    handle,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (index === -1) rows.push(next);
  else rows[index] = next;
  writeRows("catalog-overrides.json", rows);
}

export function getCollections() {
  return (catalogJson as unknown as Catalog).collections;
}

export function getOrders(): Order[] {
  return readRows<Order>("orders.json");
}

export function getOrder(orderNumber: string): Order | undefined {
  return getOrders().find((order) => order.orderNumber === orderNumber);
}

export function updateOrderStatus(orderNumber: string, status: Order["status"], actor: string, note?: string) {
  const rows = readRows<Order>("orders.json");
  const index = rows.findIndex((order) => order.orderNumber === orderNumber);
  if (index === -1) return null;
  const current = rows[index]!;
  // status machine ek hi jagah define hai (packages/validation)
  if (!canTransition(current.status, status)) return null;
  rows[index] = {
    ...current,
    status,
    audit: [
      { at: new Date().toISOString(), actor, action: `order.status.${status}`, meta: note ? { note } : undefined },
      ...current.audit,
    ],
  };
  writeRows("orders.json", rows);
  return rows[index]!;
}

/** courier + AWB admin panel se set hote hain; customer track page yahi dikhata hai */
export function setOrderTracking(
  orderNumber: string,
  input: { courier?: string; awb?: string; url?: string },
  actor: string,
) {
  const rows = readRows<Order>("orders.json");
  const index = rows.findIndex((order) => order.orderNumber === orderNumber);
  if (index === -1) return null;
  const current = rows[index]!;
  const now = new Date().toISOString();
  const tracking = {
    courier: input.courier?.trim() || null,
    awb: input.awb?.trim() || null,
    url: input.url?.trim() || null,
    shippedAt: current.tracking?.shippedAt ?? (input.courier || input.awb ? now : null),
    deliveredAt: current.tracking?.deliveredAt ?? (current.status === "delivered" ? now : null),
    updatedAt: now,
    updatedBy: actor,
  };
  rows[index] = {
    ...current,
    tracking,
    audit: [
      { at: now, actor, action: "order.tracking_updated", meta: { courier: tracking.courier, awb: tracking.awb } },
      ...current.audit,
    ],
  };
  writeRows("orders.json", rows);
  return rows[index]!;
}

export type StoreSettings = {
  announcement: string;
  freeShipping: boolean;
  upiId: string;
  gstin: string;
  supportPhone: string;
  supportEmail: string;
};

const DEFAULT_SETTINGS: StoreSettings = {
  announcement: "Festive dispatch · Free shipping across India · Express delivery on prepaid orders",
  freeShipping: true,
  upiId: "likshaclothing@upi",
  gstin: "27AAAAA0000A1Z5",
  supportPhone: "9909790455",
  supportEmail: "Info.likshaclothing@gmail.com",
};

export function getSettings(): StoreSettings {
  const file = dataFile("settings.json");
  if (!fs.existsSync(file)) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(fs.readFileSync(file, "utf8")) as StoreSettings) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: StoreSettings) {
  const file = dataFile("settings.json");
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
}

export type AuditRow = { at: string; actor: string; action: string; target: string; meta?: unknown };

export function appendAudit(row: Omit<AuditRow, "at">) {
  const rows = readRows<AuditRow>("admin-audit.json");
  rows.unshift({ at: new Date().toISOString(), ...row });
  writeRows("admin-audit.json", rows.slice(0, 500));
}

export function getAudit(limit = 100): AuditRow[] {
  const rows = readRows<AuditRow>("admin-audit.json");
  const orderAudit = getOrders().flatMap((order) =>
    order.audit.map((entry) => ({
      at: entry.at,
      actor: entry.actor,
      action: entry.action,
      target: order.orderNumber,
      meta: entry.meta,
    })),
  );
  return [...orderAudit, ...rows].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

export function getMessages() {
  return readRows<{ id: string; createdAt: string; name: string; email: string; message: string; handled: boolean }>(
    "messages.json",
  );
}

/* ───────────────────────── manual invoice (admin) ─────────────────────────
 * Owner apne hi store ke naam par invoice bana ke WhatsApp par bhej sakta hai
 * (kisi aur ke naam/address par bhi). Ye invoice series alag rehti hai taaki
 * real orders ki GST numbering se clash na ho. */

export type ManualInvoiceItem = { title: string; size?: string; quantity: number; price: number };

export type ManualInvoice = {
  number: string;
  createdAt: string;
  createdBy: string;
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  items: ManualInvoiceItem[];
  subtotal: number;
  total: number;
  notes?: string;
  orderRef?: string;
};

export function getManualInvoices(): ManualInvoice[] {
  return readRows<ManualInvoice>("manual-invoices.json");
}

export function getManualInvoice(number: string): ManualInvoice | undefined {
  return getManualInvoices().find((invoice) => invoice.number === number);
}

export function createManualInvoice(
  input: Omit<ManualInvoice, "number" | "createdAt" | "subtotal" | "total">,
): ManualInvoice {
  const rows = getManualInvoices();
  const sequence = rows.length + 1;
  const createdAt = new Date().toISOString();
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const invoice: ManualInvoice = {
    ...input,
    number: `LK/MANUAL/${String(sequence).padStart(4, "0")}`,
    createdAt,
    subtotal,
    total: subtotal,
  };
  rows.unshift(invoice);
  writeRows("manual-invoices.json", rows);
  return invoice;
}

/* ───────────────────────── payment verification (admin) ───────────────────────── */

/** Manual UPI / bank transfer admin verify karta hai — tab order confirm hota hai. */
export function verifyOrderPayment(
  orderNumber: string,
  input: { reference: string; amount: number; actor: string; note?: string },
): Order | null {
  const rows = readRows<Order>("orders.json");
  const index = rows.findIndex((order) => order.orderNumber === orderNumber);
  if (index === -1) return null;
  const current = rows[index]!;
  if (current.paymentStatus === "paid") return current;
  const now = new Date().toISOString();
  const nextStatus = current.status === "placed" && canTransition("placed", "confirmed") ? "confirmed" : current.status;
  rows[index] = {
    ...current,
    paymentStatus: "paid",
    status: nextStatus,
    payment: {
      gateway: current.payment?.gateway ?? "manual-upi",
      reference: input.reference,
      upiUri: current.payment?.upiUri ?? null,
      amount: input.amount,
      status: "paid",
      createdAt: current.payment?.createdAt ?? now,
      verifiedAt: now,
      verifiedBy: input.actor,
      failureReason: null,
    },
    audit: [
      {
        at: now,
        actor: input.actor,
        action: "payment.verified.manual",
        meta: { reference: input.reference, amount: input.amount, note: input.note },
      },
      ...(nextStatus !== current.status
        ? [{ at: now, actor: input.actor, action: "order.status.confirmed", meta: { reason: "payment verified" } }]
        : []),
      ...current.audit,
    ],
  };
  writeRows("orders.json", rows);
  return rows[index]!;
}

export function pendingPayments() {
  return getOrders().filter((order) => order.paymentStatus !== "paid" && order.paymentStatus !== "cod");
}
