"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkCredentials,
  createSessionToken,
} from "@/lib/auth";
import {
  appendAudit,
  createManualInvoice,
  saveOverride,
  saveSettings,
  setOrderTracking,
  updateOrderStatus,
  verifyOrderPayment,
} from "@/lib/data";
import {
  publishCatalog,
  saveCollectionOverride,
  saveProductOverride,
  setProductHidden,
} from "@/lib/catalog-admin";
import { requireSession } from "@/lib/session";
import type { OrderStatus } from "@liksha/types";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!checkCredentials(email, password)) {
    return { error: "Email ya password galat hai." };
  }

  const token = createSessionToken(email);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  appendAudit({ actor: email, action: "auth.login", target: "admin" });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function updateStockAction(formData: FormData) {
  // middleware ke saath defense-in-depth: action seedha bhi call ho sakta hai
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const inStock = formData.get("inStock") === "true";
  const actor = session.email;
  saveOverride(handle, { inStock });
  appendAudit({ actor, action: inStock ? "product.in_stock" : "product.out_of_stock", target: handle });
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function updatePriceAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const rupees = Number(formData.get("price") ?? 0);
  const actor = session.email;
  if (!Number.isFinite(rupees) || rupees <= 0) return;
  saveOverride(handle, { price: Math.round(rupees * 100) });
  appendAudit({ actor, action: "product.price_updated", target: handle, meta: { rupees } });
  revalidatePath("/products");
}

export async function updateTrackingAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const courier = String(formData.get("courier") ?? "");
  const awb = String(formData.get("awb") ?? "");
  const url = String(formData.get("url") ?? "");
  const actor = session.email;
  const updated = await setOrderTracking(orderNumber, { courier, awb, url }, actor);
  if (updated) {
    appendAudit({ actor, action: "order.tracking_updated", target: orderNumber, meta: { courier, awb } });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "") || undefined;
  const actor = session.email;
  const updated = await updateOrderStatus(orderNumber, status, actor, note);
  // invalid transition par kuch nahi likha jaata — UI refresh par purana status hi dikhega
  if (updated) {
    appendAudit({ actor, action: `order.status.${status}`, target: orderNumber, meta: note ? { note } : undefined });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath("/");
}

export async function saveSettingsAction(formData: FormData) {
  const session = await requireSession();
  const actor = session.email;
  saveSettings({
    announcement: String(formData.get("announcement") ?? ""),
    freeShipping: formData.get("freeShipping") === "on",
    upiId: String(formData.get("upiId") ?? ""),
    gstin: String(formData.get("gstin") ?? ""),
    supportPhone: String(formData.get("supportPhone") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
  });
  appendAudit({ actor, action: "settings.updated", target: "store" });
  revalidatePath("/settings");
}

/* ───────────────── product edits -> seed overrides -> publish ───────────────── */

/** Product ka poora edit (title, price, MRP, stock, description, collections, size pricing, images). */
export async function saveProductEditAction(formData: FormData) {
  const session = await requireSession();
  const actor = session.email;
  const handle = String(formData.get("handle") ?? "");
  if (!handle) return;

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const rupees = (key: string) => {
    const value = Number(formData.get(key) ?? "");
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : undefined;
  };

  const patch: Parameters<typeof saveProductOverride>[1] = {};
  const title = text("title");
  if (title) patch.title = title;

  const price = rupees("price");
  if (price) patch.price = price;

  const compareAt = rupees("compareAtPrice");
  patch.compareAtPrice = compareAt ?? null;

  patch.inStock = formData.get("inStock") === "on";
  patch.featured = formData.get("featured") === "on";

  const description = text("description");
  if (description) patch.description = description;

  const collections = formData.getAll("collections").map((value) => String(value));
  patch.collections = collections;

  // size rows: size_<SIZE> price rupees + avail_<SIZE>
  const sizePricing: Record<string, { price?: number; available?: boolean }> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("size_")) continue;
    const size = key.slice(5).replace(/_/g, " ");
    const sizePrice = Number(value);
    const available = formData.get(`avail_${size.replace(/ /g, "_")}`) === "on";
    sizePricing[size] = {
      ...(Number.isFinite(sizePrice) && sizePrice > 0 ? { price: Math.round(sizePrice * 100) } : {}),
      available,
    };
  }
  if (Object.keys(sizePricing).length) patch.sizePricing = sizePricing;

  saveProductOverride(handle, patch, actor);
  appendAudit({ actor, action: "product.edited", target: handle, meta: { price, collections } });
  revalidatePath("/products");
  revalidatePath(`/products/${handle}`);
}

export async function toggleProductVisibilityAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const hidden = formData.get("hidden") === "true";
  setProductHidden(handle, hidden, session.email);
  appendAudit({ actor: session.email, action: hidden ? "product.hidden" : "product.visible", target: handle });
  revalidatePath("/products");
}

export async function saveCollectionEditAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  saveCollectionOverride(handle, {
    title: String(formData.get("title") ?? "").trim() || undefined,
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
  });
  appendAudit({ actor: session.email, action: "collection.edited", target: handle });
  revalidatePath("/collections");
}

/** Admin ka "Publish" — catalogue rebuild, website turant naya data dikhati hai. */
export async function publishCatalogAction() {
  const session = await requireSession();
  const result = await publishCatalog();
  appendAudit({
    actor: session.email,
    action: result.ok ? "catalog.published" : "catalog.publish_failed",
    target: "website",
    meta: { log: result.log.slice(-600) },
  });
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/collections");
}

/* ───────────────────────── manual invoice (admin) ───────────────────────── */

export async function createManualInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  // items: title[] size[] qty[] price[] (blank rows skip)
  const titles = formData.getAll("itemTitle").map(String);
  const sizes = formData.getAll("itemSize").map(String);
  const quantities = formData.getAll("itemQty").map(String);
  const prices = formData.getAll("itemPrice").map(String);

  const items = titles
    .map((title, index) => ({
      title: title.trim(),
      size: (sizes[index] ?? "").trim() || undefined,
      quantity: Math.max(1, Number(quantities[index] ?? 1) || 1),
      price: Math.round((Number(prices[index] ?? 0) || 0) * 100),
    }))
    .filter((item) => item.title && item.price > 0);

  if (!items.length) return;

  const invoice = createManualInvoice({
    createdBy: session.email,
    customerName: text("customerName") || "Customer",
    phone: text("phone"),
    email: text("email") || undefined,
    address: text("address"),
    city: text("city"),
    state: text("state") || "Rajasthan",
    pincode: text("pincode"),
    items,
    notes: text("notes") || undefined,
    orderRef: text("orderRef") || undefined,
  });
  appendAudit({ actor: session.email, action: "invoice.manual_created", target: invoice.number });
  redirect(`/invoices/${encodeURIComponent(invoice.number)}`);
}

/* ───────────────────────── payments ───────────────────────── */

export async function verifyPaymentAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const amountRupees = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!orderNumber || !reference) return;
  const updated = await verifyOrderPayment(orderNumber, {
    reference,
    amount: Math.round((Number.isFinite(amountRupees) ? amountRupees : 0) * 100),
    actor: session.email,
    note: note || undefined,
  });
  if (updated) {
    appendAudit({ actor: session.email, action: "payment.verified", target: orderNumber, meta: { reference } });
  }
  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
}
