import type { Order } from "@liksha/types";

/**
 * Google Sheet row formatting — pure functions (koi network / server-only nahi).
 * Isliye unit tests me seedha import ho sakte hain.
 */

export type SheetSettings = {
  announcement?: string;
  supportPhone?: string;
  supportEmail?: string;
  whatsapp?: string;
  upiId?: string;
  upiName?: string;
  gstin?: string;
  freeShipping?: boolean;
  adminUrl?: string;
};

function text(value: unknown, max = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : undefined;
}

function truthy(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (["true", "yes", "y", "1", "on", "haan"].includes(normalised)) return true;
    if (["false", "no", "n", "0", "off", "nahi"].includes(normalised)) return false;
  }
  return undefined;
}

/**
 * UPI VPA ko saaf karo: sheet me owner kabhi `UPI ID` label ke saath, space ke
 * saath, ya bade harf me likh deta hai — wahi value site par jaani chahiye.
 *
 * R35 (owner: "sheet me UPI change ki par site par nahi aayi"): sirf exact key
 * `upi_id` dhoondhne se `UPI ID` / `upi id` / `Upi-Id` wali row chhoot jaati thi.
 */
export function normaliseUpiId(value: unknown): string | undefined {
  const raw = text(value, 120);
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/^(upi(\s*id)?|vpa|payee(\s*upi)?)\s*[:\-]\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
  // VPA: kuch@handle — dono taraf kuch hona chahiye, koi space nahi
  if (!/^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9._-]{1,}$/.test(cleaned)) return undefined;
  return cleaned;
}

/** Sheet/CSS/JSON sab jagah key ka same roop: `UPI ID` → `upi_id` */
export function canonicalSettingKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Har field ke saare naam jo owner ki sheet me mil sakte hain */
const SETTING_ALIASES = {
  announcement: ["announcement", "announcement_text", "banner", "notice"],
  supportPhone: ["support_phone", "supportphone", "phone", "helpline", "contact_number"],
  supportEmail: ["support_email", "supportemail", "email"],
  whatsapp: ["whatsapp", "whatsapp_number", "wa", "whatsapp_no"],
  upiId: ["upi_id", "upiid", "upi", "upi_vpa", "upi_address", "payee_vpa", "vpa"],
  upiName: ["upi_name", "upiname", "payee_name", "account_name"],
  gstin: ["gstin", "gst_number", "gstno", "gst_no"],
  freeShipping: ["free_shipping", "freeshipping"],
  adminUrl: ["admin_url", "adminurl", "admin_panel", "admin_link"],
} as const;

/** Aliases ke hisaab se pehla non-empty value */
function pick(source: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

/** Apps Script kai shapes bhej sakta hai — sabko ek hi shape me laao */
export function normaliseSheetSettings(payload: unknown): SheetSettings | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.ok === false) return null;
  const nested =
    (root.settings as Record<string, unknown> | undefined) ??
    (root.data as Record<string, unknown> | undefined) ??
    root;

  // keys normalise — `UPI ID`, `upi-id`, `Upi_Id` sab `upi_id` ban jaate hain
  const source: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(nested)) {
    const canonical = canonicalSettingKey(key);
    if (canonical && !(canonical in source)) source[canonical] = value;
  }

  const settings: SheetSettings = {
    announcement: text(pick(source, SETTING_ALIASES.announcement), 180),
    supportPhone: text(pick(source, SETTING_ALIASES.supportPhone), 16),
    supportEmail: text(pick(source, SETTING_ALIASES.supportEmail), 120),
    whatsapp: text(pick(source, SETTING_ALIASES.whatsapp), 16),
    upiId: normaliseUpiId(pick(source, SETTING_ALIASES.upiId)),
    upiName: text(pick(source, SETTING_ALIASES.upiName), 80),
    gstin: text(pick(source, SETTING_ALIASES.gstin), 20),
    freeShipping: truthy(pick(source, SETTING_ALIASES.freeShipping)),
    adminUrl: text(pick(source, SETTING_ALIASES.adminUrl), 200),
  };

  const hasValue = Object.values(settings).some((value) => value !== undefined);
  return hasValue ? settings : null;
}

const inr = (paise: number) => Math.round(paise) / 100;

/**
 * Order ki ek sheet row. Har event (placed / payment submitted / paid / shipped)
 * apni row banata hai — owner ko timeline milti hai, purani row overwrite nahi hoti.
 */
export function orderSheetRow(
  order: Order,
  event: string,
  extra: Record<string, string | number | null> = {},
): Record<string, string | number> {
  const items = order.items.map((item) => `${item.title} (${item.size}) x${item.quantity}`).join(" | ");
  return {
    Timestamp: new Date().toISOString(),
    Event: event,
    "Order number": order.orderNumber,
    "Order status": order.status,
    "Payment status": order.paymentStatus,
    "Payment method": order.paymentMethod,
    "Payment reference": order.payment?.reference ?? "",
    "UPI ID": extra["UPI ID"] ?? "",
    Total: inr(order.total),
    Subtotal: inr(order.subtotal),
    Discount: inr(order.discount),
    Coupon: order.couponCode ?? "",
    Items: order.items.reduce((sum, item) => sum + item.quantity, 0),
    "Item details": items,
    Customer: order.customerName,
    Phone: order.phone,
    Email: order.email,
    Address: order.address,
    City: order.city,
    State: order.state,
    Pincode: order.pincode,
    "Tracking courier": order.tracking?.courier ?? "",
    AWB: order.tracking?.awb ?? "",
    "Tracking URL": order.tracking?.url ?? "",
    Notes: order.notes ?? "",
    ...extra,
  };
}

/** CSV (key,value rows) → SheetSettings. Sirf 2-column layout expect karta hai. */
export function parseSettingsCsv(csv: string): SheetSettings | null {
  const rows: Record<string, string> = {};
  for (const line of csv.split(/\r?\n/)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g);
    if (!cells || cells.length < 2) continue;
    const clean = (value: string) =>
      value
        .replace(/,$/, "")
        .replace(/^"|"$/g, "")
        .replace(/""/g, '"')
        .trim();
    // R35: `UPI ID` / `upi-id` / `Upi Id` sab `upi_id` — warna CSV wali row chhoot jaati thi
    const key = canonicalSettingKey(clean(cells[0]!));
    const value = clean(cells.slice(1).join(","));
    if (!key || key === "key" || !value) continue;
    rows[key] = value;
  }
  return normaliseSheetSettings(rows);
}

/**
 * Checkout funnel ki sheet row ("Checkout" tab).
 * Apps Script header **naam** se column dhoondhta hai — isliye keys yahan aur
 * `scripts/google-apps-script/liksha-sheets.gs` ke HEADERS me same hone chahiye
 * (`tests/unit/apps-script.test.ts` isi contract ko check karta hai).
 */
export function checkoutEventSheetRow(event: {
  createdAt: string;
  event: string;
  step?: string | null;
  orderNumber?: string | null;
  itemsCount: number;
  subtotal: number;
  reason?: string | null;
  phone?: string | null;
}): Record<string, string | number> {
  return {
    Timestamp: event.createdAt,
    Event: event.event,
    Step: event.step ?? "",
    "Order number": event.orderNumber ?? "",
    Items: event.itemsCount,
    Subtotal: inr(event.subtotal),
    Reason: event.reason ?? "",
    Phone: event.phone ?? "",
  };
}

/** Contact form ki row ("Messages" tab) */
export function messageSheetRow(message: {
  createdAt: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  handled?: boolean;
  replied?: boolean;
}): Record<string, string> {
  return {
    Timestamp: message.createdAt,
    Name: message.name,
    Email: message.email,
    Phone: message.phone ?? "",
    Subject: message.subject ?? "",
    Message: message.message,
    Status: message.replied ? "replied" : message.handled ? "handled" : "new",
  };
}

/** Newsletter subscriber ki row ("Newsletter" tab) */
export function subscriberSheetRow(email: string, at = new Date().toISOString()): Record<string, string> {
  return { Timestamp: at, Email: email };
}

/**
 * Order ki har item alag row — owner ko size/colour wise bikri dikhti hai
 * (OrderItems tab). Ek hi order ki saari items ek saath jaati hain.
 */
export function orderItemSheetRows(order: Order): Record<string, string | number>[] {
  return order.items.map((item) => ({
    Timestamp: new Date().toISOString(),
    "Order number": order.orderNumber,
    Product: item.title,
    Handle: item.handle,
    SKU: `${item.handle}-${item.size}`.toUpperCase(),
    Size: item.size,
    Colour: (item as { colour?: string }).colour ?? "",
    Quantity: item.quantity,
    Price: inr(item.price),
    "Line total": inr(item.price * item.quantity),
    Category: (item as { category?: string }).category ?? "",
    "Image URL": item.image ?? "",
    Status: order.status,
  }));
}

/** Shipment row — courier/AWB/tracking update par (Shipments tab) */
export function shipmentSheetRow(
  order: Order,
  status = "updated",
): Record<string, string | number> {
  return {
    Timestamp: new Date().toISOString(),
    "Order number": order.orderNumber,
    Courier: order.tracking?.courier ?? "",
    AWB: order.tracking?.awb ?? "",
    "Tracking URL": order.tracking?.url ?? "",
    Status: order.status || status,
    "Expected delivery": "",
    Note: "",
    "Updated by": (order as { updatedBy?: string }).updatedBy ?? "system",
  };
}

/**
 * GST invoice row (Invoices tab). Amounts **rupees** me jaate hain (sheet me
 * owner ko seedha padhne layak), paise nahi.
 */
export function invoiceSheetRow(
  invoice: {
    number: string;
    issuedAt: string;
    placeOfSupply?: string;
    interState?: boolean;
    buyer?: { name?: string; phone?: string; email?: string; address?: string; state?: string };
    totals: { taxable: number; cgst: number; sgst: number; igst: number };
  },
  order: Order,
  type = "gst",
): Record<string, string | number> {
  const buyer = invoice.buyer ?? {};
  return {
    Timestamp: invoice.issuedAt,
    "Invoice number": invoice.number,
    "Order number": order.orderNumber,
    Type: type,
    Customer: buyer.name ?? order.customerName,
    Phone: buyer.phone ?? order.phone,
    Email: buyer.email ?? order.email ?? "",
    GSTIN: "",
    Address: buyer.address ?? order.address,
    State: buyer.state ?? order.state,
    "Taxable value": inr(invoice.totals.taxable),
    CGST: inr(invoice.totals.cgst),
    SGST: inr(invoice.totals.sgst),
    IGST: inr(invoice.totals.igst),
    Shipping: inr(order.shipping),
    Discount: inr(order.discount),
    Total: inr(order.total),
    Notes: invoice.interState ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)",
  };
}
