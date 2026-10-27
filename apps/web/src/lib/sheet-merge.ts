import type { AuditEntry, Order, OrderStatus } from "@liksha/types";

import { cleanAwb, courierTrackingUrl } from "./tracking";

/**
 * Sheet-tracking ka **pure** hissa — koi network / server-only import nahi,
 * isliye unit tests ise seedha import kar sakte hain.
 * Fetch + cache `sheet-tracking.ts` me hai.
 */

export type SheetTrackingUpdate = {
  at: string;
  status: string;
  event: string;
  message: string;
};

export type SheetTracking = {
  orderNumber: string;
  status: string;
  step: number;
  steps: { step: string; done: boolean }[];
  paymentStatus: string;
  courier: string;
  awb: string;
  trackingUrl: string;
  note: string;
  /**
   * R39 (owner): Orders tab ke `Admin Note` column ka text — order ke liye
   * owner ka apna message. Status merge jeete ya na jeete, ye note hamesha
   * customer page ke note-box me dikhta hai (khaali ho to "Waiting for
   * confirmation"). Purane script (r38-) isay nahi bhejte — isliye optional.
   */
  adminNote?: string;
  updates: SheetTrackingUpdate[];
  readAt: number;
};

const ORDER_STATUSES: OrderStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];
const STEP_INDEX: Record<string, number> = {
  placed: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
};

/** Sheet ka koi bhi status text ("Shipped", "dispatch ho gaya") → OrderStatus. */
export function sheetStatusToOrderStatus(status: unknown): OrderStatus | null {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return null;
  if (ORDER_STATUSES.includes(value as OrderStatus)) return value as OrderStatus;
  if (/cancel|rto/.test(value)) return "cancelled";
  if (/return|refund/.test(value)) return "returned";
  if (/out for deliver/.test(value)) return "shipped";
  if (/deliver|complete|handover/.test(value)) return "delivered";
  if (/ship|dispatch|transit|courier/.test(value)) return "shipped";
  if (/pack|label|ready/.test(value)) return "packed";
  if (/confirm|process|accept/.test(value)) return "confirmed";
  if (/placed|created|pending/.test(value)) return "placed";
  return null;
}

function stepOf(status: string): number {
  const mapped = sheetStatusToOrderStatus(status);
  return mapped ? (STEP_INDEX[mapped] ?? 0) : 0;
}



/**
 * Sheet jeet-ti hai kab? (owner rule: sheet value wins)
 *  • sheet ka status rukna bataye (cancelled / returned) → hamesha
 *  • sheet ka step DB ke step se aage ya barabar → sheet
 *  • warna DB (payment-confirm jaisi cheezein sheet se pehle hoti hain)
 */
export function sheetTrackingWins(order: Order, sheet: SheetTracking | null): boolean {
  if (!sheet || !sheet.status) return false;
  const mapped = sheetStatusToOrderStatus(sheet.status);
  if (!mapped) return false;
  if (mapped === "cancelled" || mapped === "returned") return true;
  return stepOf(sheet.status) >= stepOf(order.status);
}

/**
 * DB ke order par sheet ka tracking merge — **pure** (tests isi par chalte hain).
 * Sheet jeete to status / statusNote / courier-AWB-URL aur timeline ke updates
 * sheet se aate hain; paymentStatus hamesha DB ka (paisa = DB sacchai).
 *
 * R39: sheet ka `adminNote` (Orders → Admin Note column) **hamesha** jeetta hai
 * — status merge ho ya na ho, owner ka message customer ke note-box me dikhega.
 */
export function mergeSheetTracking(order: Order, sheet: SheetTracking | null): Order {
  if (!sheet) return order;
  const merged = sheetTrackingWins(order, sheet) ? mergeSheetWins(order, sheet) : order;
  const adminNote = String(sheet.adminNote ?? "").trim();
  if (!adminNote) return merged;
  return {
    ...merged,
    statusNote: {
      text: adminNote,
      at: sheet.updates[0]?.at ?? merged.createdAt,
      by: "sheet",
      status: merged.status,
    },
  };
}

function mergeSheetWins(order: Order, sheet: SheetTracking): Order {
  const status = sheetStatusToOrderStatus(sheet.status) ?? order.status;

  const audit: AuditEntry[] = sheet.updates
    .filter((update) => update?.at)
    .map((update) => ({
      at: update.at,
      actor: "sheet",
      action: `order.status.${sheetStatusToOrderStatus(update.status) ?? "placed"}`,
      meta: { note: update.message || undefined, event: update.event || undefined },
    }))
    .reverse(); // trackingUpdates newest-first expect karta hai

  const courier = sheet.courier || order.tracking?.courier || null;
  const awb = sheet.awb ? cleanAwb(sheet.awb) : (order.tracking?.awb ?? null);
  const url =
    sheet.trackingUrl ||
    order.tracking?.url ||
    courierTrackingUrl(courier, awb ?? "");

  return {
    ...order,
    status,
    statusNote: sheet.note
      ? { text: sheet.note, at: sheet.updates[0]?.at ?? order.createdAt, by: "sheet", status }
      : order.statusNote,
    tracking:
      courier || awb || url
        ? {
            courier,
            awb,
            url,
            shippedAt: order.tracking?.shippedAt ?? (stepOf(status) >= 3 ? (sheet.updates[0]?.at ?? null) : null),
            deliveredAt: order.tracking?.deliveredAt ?? (status === "delivered" ? (sheet.updates[0]?.at ?? null) : null),
            updatedAt: sheet.updates[0]?.at ?? order.tracking?.updatedAt ?? order.createdAt,
            updatedBy: "sheet",
          }
        : order.tracking,
    audit: audit.length ? audit : order.audit,
  };
}

/* ───────────────────────── R40: sheet hi orders ka DB hai ─────────────────────────
 * Orders tab = append-only event log; har event row me poora order snapshot
 * (`Order JSON` column, audit ke bina). Read = latest snapshot + rows se owner
 * ke live edits ka overlay (upar wale proven merge rules). Ye functions **pure**
 * hain — network/cache `orders-sheet.ts` me hai.
 */

export type SheetRow = Record<string, string | number>;
export type OrderState = { orderNumber: string; json?: string; row?: SheetRow | null; rows?: SheetRow[] | null };

/** row(s) → SheetTracking (merge rules reuse) — owner ke live edits ka overlay. */
function trackingFromRows(orderNumber: string, rows: SheetRow[]): SheetTracking | null {
  if (!rows.length) return null;
  const lastNonEmpty = (column: string): string => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const value = String(rows[i]?.[column] ?? "").trim();
      if (value) return value;
    }
    return "";
  };
  const updates: SheetTrackingUpdate[] = rows
    .filter((row) => String(row?.Timestamp ?? "").trim())
    .map((row) => ({
      at: toIso(row.Timestamp),
      status: String(row["Order status"] ?? ""),
      event: String(row.Event ?? ""),
      message: String(row.Notes ?? "") || String(row["Admin Note"] ?? ""),
    }))
    .reverse(); // newest-first (mergeSheetWins isi order me audit banata hai)
  const status = lastNonEmpty("Order status");
  const step = stepOfStatus(status);
  return {
    orderNumber,
    status,
    step,
    steps: [],
    paymentStatus: "",
    courier: lastNonEmpty("Tracking courier"),
    awb: lastNonEmpty("AWB"),
    trackingUrl: lastNonEmpty("Tracking URL"),
    note: "",
    adminNote: lastNonEmpty("Admin Note"),
    updates,
    readAt: Date.now(),
  };
}

const STATUS_STEPS: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered"];
function stepOfStatus(status: string): number {
  const mapped = sheetStatusToOrderStatus(status);
  return mapped ? Math.max(0, STATUS_STEPS.indexOf(mapped)) : 0;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? "").trim();
  if (!text) return new Date().toISOString();
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function rupeesToPaise(value: unknown): number {
  const num = Number(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

/**
 * r40 se purani rows (JSON column khaali) → human columns se best-effort
 * Order. Tracking page / admin list chalte rehte hain; items ki price 0 hoti
 * hai (columns me sirf title/size/qty hota tha) — total sheet ke Total se.
 */
export function orderFromSheetRows(orderNumber: string, rows: SheetRow[]): Order | null {
  const list = rows.length ? rows : [];
  const latest = list[list.length - 1];
  if (!latest) return null;
  const first = list[0] ?? latest;
  /**
   * R41: onEdit ki sparse rows (`order.status_sheet` — sirf status/number bhara)
   * latest ban sakti hain, isliye har human column **last non-empty** scan se
   * padho (trackingFromRows wala rule). Warna owner ke sheet-status-edit ke baad
   * compat reconstruct me customer/total/items khaali ho jaate.
   */
  const lastNonEmpty = (column: string): string => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const value = String(list[i]?.[column] ?? "").trim();
      if (value) return value;
    }
    return "";
  };
  const itemsText = lastNonEmpty("Item details");
  const items = itemsText
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(.*)\s\(([^)]+)\)\sx(\d+)$/.exec(part);
      return {
        handle: "",
        title: match ? match[1]!.trim() : part,
        image: "",
        size: match ? match[2]! : "",
        quantity: match ? Number(match[3]) || 1 : 1,
        price: 0,
      };
    });
  const status = (sheetStatusToOrderStatus(lastNonEmpty("Order status")) ?? "placed") as OrderStatus;
  /** sheet ka koi bhi text → valid PaymentStatus (galat/ khaali = pending) */
  const payRaw = lastNonEmpty("Payment status").toLowerCase();
  const paymentStatus: Order["paymentStatus"] = ["pending", "processing", "paid", "failed", "refunded"].includes(payRaw)
    ? (payRaw as Order["paymentStatus"])
    : "pending";
  const createdAt = toIso(first.Timestamp ?? latest.Timestamp);
  const audit: AuditEntry[] = list
    .filter((row) => String(row?.Timestamp ?? "").trim())
    .map((row) => ({
      at: toIso(row.Timestamp),
      actor: String(row.Source ?? "") === "sheet-edit" ? "sheet" : "system",
      action: String(row.Event ?? "order.updated"),
      meta: String(row.Notes ?? "") ? { note: String(row.Notes ?? "") } : undefined,
    }))
    .reverse();
  const courier = lastNonEmpty("Tracking courier") || null;
  const awb = lastNonEmpty("AWB") || null;
  const url = lastNonEmpty("Tracking URL") || null;
  return {
    id: orderNumber,
    orderNumber,
    createdAt,
    customerName: lastNonEmpty("Customer"),
    email: lastNonEmpty("Email"),
    phone: lastNonEmpty("Phone"),
    address: lastNonEmpty("Address"),
    city: lastNonEmpty("City"),
    state: lastNonEmpty("State"),
    pincode: lastNonEmpty("Pincode"),
    notes: lastNonEmpty("Notes") || null,
    items,
    subtotal: rupeesToPaise(lastNonEmpty("Subtotal")),
    discount: rupeesToPaise(lastNonEmpty("Discount")),
    shipping: 0,
    total: rupeesToPaise(lastNonEmpty("Total")),
    couponCode: lastNonEmpty("Coupon") || null,
    paymentMethod: "prepaid",
    paymentStatus,
    payment: {
      gateway: "sheet",
      reference: lastNonEmpty("Payment reference") || null,
      amount: rupeesToPaise(lastNonEmpty("Total")),
      status: paymentStatus,
      createdAt,
      verifiedAt: null,
      verifiedBy: null,
      failureReason: null,
    },
    status,
    tracking:
      courier || awb || url
        ? { courier, awb, url, shippedAt: null, deliveredAt: null, updatedAt: createdAt, updatedBy: "sheet" }
        : undefined,
    audit,
  };
}

/** order_state/orders_state ka ek entry → Order (JSON snapshot + rows overlay). */
export function parseOrderState(state: OrderState | null | undefined): Order | null {
  if (!state) return null;
  const orderNumber = String(state.orderNumber ?? "").trim().toUpperCase();
  if (!orderNumber) return null;
  const rows = Array.isArray(state.rows) && state.rows.length
    ? state.rows
    : state.row
      ? [state.row]
      : [];
  const json = String(state.json ?? "").trim();
  let base: Order | null = null;
  if (json) {
    try {
      const parsed = JSON.parse(json) as Order;
      if (parsed && typeof parsed === "object" && parsed.orderNumber) {
        base = { ...parsed, orderNumber: String(parsed.orderNumber).toUpperCase() };
      }
    } catch {
      base = null; // snapshot toota → rows se reconstruct
    }
  }
  if (!base) base = orderFromSheetRows(orderNumber, rows);
  if (!base) return null;
  // owner ke live sheet edits (status/Admin Note/AWB) — proven merge rules se
  const overlay = trackingFromRows(orderNumber, rows);
  return overlay ? mergeSheetTracking(base, overlay) : base;
}


/* ───────────────────────── R41: purane script ke saath compat ─────────────────────────
 * Owner ka live script r40 se purana ho (jaise r38-1) to `order_state`/`orders_state`
 * nahi hote — par `?action=order` (orderStory_: tab-wise rows) aur `?action=recent`
 * (newest-first rows) hamesha se hain. Site unhi se orders reconstruct karti hai:
 * orders sheet me **tab bhi** save/read hote hain (compat mode), r40-1 paste ke baad
 * full fidelity (Order JSON snapshot) apne aap chalu.
 */

/**
 * `?action=recent&sheet=Orders` ki rows (newest-first) ko order number ke hisaab
 * se group karo. Har group **chronological** (purani→nayi) return hota hai kyunki
 * `orderFromSheetRows` last row ko latest maanta hai. Group ka order newest-first
 * hi rehta hai (Map insertion order = recent ka order).
 */
export function groupOrdersFromRecentRows(
  rows: SheetRow[],
): { orderNumber: string; rows: SheetRow[] }[] {
  const groups = new Map<string, SheetRow[]>();
  for (const row of rows ?? []) {
    const orderNumber = String(row?.["Order number"] ?? "").trim().toUpperCase();
    if (!orderNumber) continue;
    const list = groups.get(orderNumber);
    if (list) list.push(row);
    else groups.set(orderNumber, [row]);
  }
  return [...groups.entries()].map(([orderNumber, list]) => ({
    orderNumber,
    rows: list.reverse(),
  }));
}
