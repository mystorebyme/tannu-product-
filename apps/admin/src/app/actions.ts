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
import { appendAudit, saveOverride, saveSettings, updateOrderStatus } from "@/lib/data";
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

export async function updateOrderStatusAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "") || undefined;
  const actor = session.email;
  const updated = updateOrderStatus(orderNumber, status, actor, note);
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
    codLimit: Math.round(Number(formData.get("codLimit") ?? 3500) * 100),
    codFee: Math.round(Number(formData.get("codFee") ?? 50) * 100),
    freeShipping: formData.get("freeShipping") === "on",
    upiId: String(formData.get("upiId") ?? ""),
    gstin: String(formData.get("gstin") ?? ""),
    supportPhone: String(formData.get("supportPhone") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
  });
  appendAudit({ actor, action: "settings.updated", target: "store" });
  revalidatePath("/settings");
}
