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

/** Apps Script kai shapes bhej sakta hai — sabko ek hi shape me laao */
export function normaliseSheetSettings(payload: unknown): SheetSettings | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.ok === false) return null;
  const source =
    (root.settings as Record<string, unknown> | undefined) ??
    (root.data as Record<string, unknown> | undefined) ??
    root;

  const settings: SheetSettings = {
    announcement: text(source.announcement ?? source.Announcement, 180),
    supportPhone: text(source.supportPhone ?? source.support_phone ?? source.phone, 16),
    supportEmail: text(source.supportEmail ?? source.support_email ?? source.email, 120),
    whatsapp: text(source.whatsapp ?? source.whatsapp_number, 16),
    upiId: text(source.upiId ?? source.upi_id ?? source.upi, 80),
    upiName: text(source.upiName ?? source.upi_name ?? source.payee_name, 80),
    gstin: text(source.gstin ?? source.GSTIN, 20),
    freeShipping: truthy(source.freeShipping ?? source.free_shipping),
    adminUrl: text(source.adminUrl ?? source.admin_url ?? source.admin_panel, 200),
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
    const key = clean(cells[0]!).replace(/\s+/g, " ").toLowerCase().replace(/ /g, "_");
    const value = clean(cells.slice(1).join(","));
    if (!key || key === "key" || !value) continue;
    rows[key] = value;
  }
  return normaliseSheetSettings(rows);
}
