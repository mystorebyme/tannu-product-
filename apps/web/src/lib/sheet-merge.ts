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
  /** R43: row ka Payment status (owner ne sheet se paid kiya → timeline dikhe) */
  payment?: string;
  /** R43: row ka Notes column (owner ke in-place comment edit pakadne ke liye) */
  notes?: string;
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

/** Sheet ke onEdit watcher se aane wale events — baaki sab site ke apne hain. */
const SHEET_EDIT_EVENTS = new Set([
  "order.status_sheet",
  "order.admin_note",
  "order.owner_note",
  "order.payment_sheet",
]);

/**
 * R43: Admin Note ka UI default "Waiting for confirmation" hai — sheet me wahi
 * default likha ho aur owner ne Notes column me apna comment diya ho, to default
 * comment ko chhupa nahi sakta (owner: "jo mai likhu wo order page par show ho").
 */
function isDefaultAdminNote(note: string): boolean {
  return note.trim().toLowerCase() === "waiting for confirmation";
}

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
 * R43 (owner): **"sheet me order confirm kar diya fir bhi payment verify kar
 * raha hai — fix karo. Order confirm means store owner ne verify kar diya ki
 * payment aa gaya."**
 *
 * Prepaid/UPI order par owner ne sheet (ya admin) se status `confirmed` ya usse
 * aage kiya → payment ko store-verified maano: CTA hat jaata hai, payment block
 * "paid" dikhata hai, watcher ruk jaata hai. COD par ye rule nahi (wahan
 * delivery par paisa milta hai — pending sahi hai). `refunded`/`paid` ko chhoo
 * nahi (refunded = paisa wapas gaya, paid = pehle se verify).
 */
const OWNER_CONFIRMED_STAGES: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];

export function applyOwnerConfirmation(order: Order): Order {
  if (order.paymentMethod === "cod") return order;
  if (!OWNER_CONFIRMED_STAGES.includes(order.status)) return order;
  if (!["pending", "processing", "failed"].includes(order.paymentStatus)) return order;
  const at = order.statusNote?.at ?? order.createdAt;
  return {
    ...order,
    paymentStatus: "paid",
    payment: order.payment
      ? { ...order.payment, status: "paid", verifiedAt: at, verifiedBy: order.payment.verifiedBy ?? "store" }
      : {
          gateway: "sheet",
          reference: null,
          amount: order.total,
          status: "paid",
          createdAt: at,
          verifiedAt: at,
          verifiedBy: "store",
          failureReason: null,
        },
  };
}

/**
 * DB ke order par sheet ka tracking merge — **pure** (tests isi par chalte hain).
 * Sheet jeete to status / statusNote / courier-AWB-URL aur timeline ke updates
 * sheet se aate hain.
 *
 * R39: sheet ka `adminNote` (Orders → Admin Note column) **hamesha** jeetta hai
 * — status merge ho ya na ho, owner ka message customer ke note-box me dikhega.
 * R43: owner confirm kare to payment bhi verified (applyOwnerConfirmation) aur
 * Notes column me likha owner comment bhi dikhta hai (adminNote ke baad).
 */
export function mergeSheetTracking(order: Order, sheet: SheetTracking | null): Order {
  if (!sheet) return applyOwnerConfirmation(order);
  // Pehle sheet ka status merge — phir owner-confirm rule (sheet ke confirmed
  // par bhi laagu ho, sirf purane status par nahi).
  const merged = applyOwnerConfirmation(
    sheetTrackingWins(order, sheet) ? mergeSheetWins(order, sheet) : order,
  );
  const adminNote = String(sheet.adminNote ?? "").trim();
  /**
   * R43 (owner): "jo comment maine likha vo show nhi ho rha" — owner kabhi
   * comment `Notes` column me likh deta hai (Admin Note me nahi). Snapshot ke
   * customer-note se alag latest Notes = owner ka comment → note-box + timeline.
   */
  const customerNote = String(order.notes ?? "").trim();
  const rowNote = String(
    sheet.updates.find((update) => {
      const text = String(update.notes ?? "").trim();
      if (!text) return false;
      // R43: sirf owner wale rows gino — onEdit watcher (`order.owner_note`) ya
      // manual row (Event khaali). Site ke apne rows / status-edit rows ke Notes
      // canned messages hote hain ("Sheet se status update"), owner ka comment nahi.
      const event = String(update.event ?? "");
      return !event || event === "order.owner_note";
    })?.notes ?? "",
  ).trim();
  const ownerNote = rowNote && rowNote !== customerNote ? rowNote : "";
  // R43: default "Waiting for confirmation" owner ke Notes-comment ko chhupa
  // nahi sakta (owner complaint, LK-QDM2EXQMGO live screenshot).
  const noteText = adminNote && !(isDefaultAdminNote(adminNote) && ownerNote) ? adminNote : ownerNote;
  if (!noteText) return merged;
  return {
    ...merged,
    statusNote: {
      text: noteText,
      at: sheet.updates[0]?.at ?? merged.createdAt,
      by: "sheet",
      status: merged.status,
    },
  };
}

function mergeSheetWins(order: Order, sheet: SheetTracking): Order {
  const status = sheetStatusToOrderStatus(sheet.status) ?? order.status;

  /**
   * R43: onEdit events ko timeline ki sahi bhasha do —
   *  • `order.admin_note`/`order.owner_note` → `order.note_updated` (owner ka
   *    comment "Team update" bankar dikhe; pehle ye stage-entry ban jaata tha
   *    aur comment stage ke canned text me dab jaata tha)
   *  • `order.payment_sheet` (owner ne Payment status badla) → paid par
   *    `payment.verified` ("Payment received")
   *  • **site ke apne events** (order.placed, payment.claimed, …) apna event
   *    hi rahete hain — pehle HAR row `order.status.<slug>` ban jaati thi, isliye
   *    claim ka message "Delivered" jaise galat stage label ke neeche dikhta tha
   *    (owner ka live screenshot, LK-QDM2EXQMGO).
   */
  const audit: AuditEntry[] = sheet.updates
    .filter((update) => update?.at)
    .map((update): AuditEntry | null => {
      const event = String(update.event ?? "");
      if (event === "order.admin_note" || event === "order.owner_note") {
        return {
          at: update.at,
          actor: "sheet" as const,
          action: "order.note_updated",
          meta: { text: update.message || undefined, event },
        };
      }
      if (event === "order.payment_sheet" && /paid|verified|success/i.test(String(update.payment ?? ""))) {
        return {
          at: update.at,
          actor: "sheet" as const,
          action: "payment.verified",
          meta: { note: update.message || undefined, event, payment: update.payment },
        };
      }
      if (event && !SHEET_EDIT_EVENTS.has(event)) {
        // site ka apna event (order.placed / payment.claimed / payment.failed …)
        return {
          at: update.at,
          actor: "system" as const,
          action: event,
          meta: { note: update.message || undefined, event },
        };
      }
      // R44: row ka status khaali hai (payment-only ya note-only sheet edit) →
      // stage entry banti hi nahi; pehle fallback "placed" se galat entry aati thi.
      const rowStatus = sheetStatusToOrderStatus(update.status);
      if (!rowStatus) return null;
      return {
        at: update.at,
        actor: "sheet" as const,
        action: `order.status.${rowStatus}`,
        meta: { note: update.message || undefined, event: event || undefined },
      };
    })
    .filter((entry): entry is AuditEntry => entry !== null)
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
      // R43: payment + notes alag se — owner ke sheet edits timeline/comment me dikhein
      payment: String(row["Payment status"] ?? ""),
      notes: String(row.Notes ?? ""),
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
  /**
   * R42 (owner): "har stage par owner/store ka comment dikhna chahiye".
   *  • onEdit ke events (`order.status_sheet`, `order.admin_note`) timeline ki
   *    bhasha me badlo — `STATUS_ACTION` sirf `order.status.<slug>` pakadta hai,
   *    warna owner ke sheet edits stages me dikhte hi nahi.
   *  • stage-comment = **Admin Note** (ya sheet-edit row ka Notes, jaise
   *    "Sheet se status update (owner)") — customer ke order `Notes` nahi
   *    (wo har row me repeat hote hain → timeline par spam lagta tha).
   */
  const audit: AuditEntry[] = list
    .filter((row) => String(row?.Timestamp ?? "").trim())
    .map((row) => {
      const rawEvent = String(row.Event ?? "order.updated");
      const sheetEdit = String(row.Source ?? "") === "sheet-edit";
      let action = rawEvent;
      if (rawEvent === "order.status_sheet") {
        action = `order.status.${sheetStatusToOrderStatus(row["Order status"]) ?? "placed"}`;
      } else if (rawEvent === "order.admin_note" || rawEvent === "order.owner_note") {
        // R43: owner ka comment (Admin Note ya Notes column se) → note entry
        action = "order.note_updated";
      } else if (rawEvent === "order.payment_sheet") {
        // R43: owner ne Payment status sheet se badla → paid par "Payment received"
        action = /paid|verified|success/i.test(String(row["Payment status"] ?? ""))
          ? "payment.verified"
          : `order.status.${sheetStatusToOrderStatus(row["Order status"]) ?? "placed"}`;
      }
      const comment =
        String(row["Admin Note"] ?? "").trim() || (sheetEdit ? String(row.Notes ?? "").trim() : "");
      const isNoteEvent = action === "order.note_updated" || action === "payment.verified";
      const meta = comment ? { [isNoteEvent ? "text" : "note"]: comment } : undefined;
      return { at: toIso(row.Timestamp), actor: sheetEdit ? "sheet" : "system", action, meta };
    })
    .reverse();
  /** R42: Admin Note compat reconstruct me bhi statusNote banta hai (full mode
   *  JSON snapshot se lata tha; purane-script rows se ye raha — owner ka comment
   *  note-box + timeline me har mode me dikhe). */
  let adminNoteAt = "";
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (String(list[i]?.["Admin Note"] ?? "").trim()) {
      adminNoteAt = String(list[i]?.Timestamp ?? "");
      break;
    }
  }
  const adminNote = lastNonEmpty("Admin Note");
  /**
   * R42 bug-fix: customer ka order-note sirf **site ki rows** se lo — onEdit ki
   * rows me `Notes` owner ka message hota hai ("Sheet se status update (owner)"
   * ya admin note), customer ka delivery-note nahi. Last-non-empty Notes scan
   * owner-edit ke baad customer note ko admin message se badal deta tha.
   */
  let customerNotes = "";
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (String(list[i]?.Source ?? "") === "sheet-edit") continue;
    const value = String(list[i]?.Notes ?? "").trim();
    if (value) {
      customerNotes = value;
      break;
    }
  }
  const courier = lastNonEmpty("Tracking courier") || null;
  const awb = lastNonEmpty("AWB") || null;
  const url = lastNonEmpty("Tracking URL") || null;
  // R43: owner ne sheet se confirm kiya → payment store-verified (COD chhod kar)
  return applyOwnerConfirmation({
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
    notes: customerNotes || null,
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
    statusNote: adminNote
      ? { text: adminNote, at: toIso(adminNoteAt) || createdAt, by: "sheet", status }
      : undefined,
    tracking:
      courier || awb || url
        ? { courier, awb, url, shippedAt: null, deliveredAt: null, updatedAt: createdAt, updatedBy: "sheet" }
        : undefined,
    audit,
  });
}

/**
 * R43: `state.json` khaali ho (order_state timeout ke baad compat rows) to rows
 * ke `Order JSON` column se snapshot utha lo — warna items Rs. 0 / khaali link
 * par reconstruct hota tha (live bug LK-QDM2EXQMGO).
 */
export function lastOrderJsonInRows(rows: SheetRow[]): string {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = String(rows[i]?.["Order JSON"] ?? "").trim();
    if (value) return value;
  }
  return "";
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
  const json = String(state.json ?? "").trim() || lastOrderJsonInRows(rows);
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
 * orders sheet me **tab bhi** save/read hote hain (compat mode), latest script paste ke baad
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
