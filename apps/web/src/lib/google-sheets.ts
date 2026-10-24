import "server-only";

import type { Order } from "@liksha/types";
import { normaliseSheetSettings, orderSheetRow, type SheetSettings } from "./sheet-format";

export { normaliseSheetSettings, orderSheetRow };
export type { SheetSettings };

/**
 * Google Sheets bridge (owner ki sheet = settings ka source of truth).
 *
 * Do kaam:
 *   1. READ  — owner ki "Settings" sheet se phone, email, UPI ID, announcement,
 *              GSTIN, free shipping — website runtime par padhti hai (15s cache,
 *              `no-store` fetch), isliye sheet me value badalte hi site par badal jaati hai.
 *   2. WRITE — har order / payment / message / subscriber ek row ban ke owner ki
 *              "Orders" / "Payments" / "Messages" sheet me chala jaata hai. Append-only
 *              log hai, isliye owner ko poora history + latest status dono dikhte hain.
 *
 * Setup: Google Sheet → Extensions → Apps Script → `scripts/google-apps-script/liksha-sheets.gs`
 * deploy → Web app URL + token env me. Poora guide: docs/09-devops/google-sheets.md
 *
 * Sheets optional hai: configure nahi hai to site Postgres/JSON par chalti hai
 * (koi feature band nahi hota) — sirf owner edits sheet se nahi honge.
 */

export type SheetName = "Orders" | "Payments" | "Messages" | "Newsletter" | "Checkout" | "Audit";

export type SheetAppend = {
  sheet: SheetName;
  row: Record<string, string | number | boolean | null | undefined>;
};

const READ_TIMEOUT_MS = 5_000;
const WRITE_TIMEOUT_MS = 6_000;
const CACHE_MS = 15_000;

export function googleSheetsConfig(): { url: string; token: string } | null {
  const url = (process.env.GOOGLE_SHEETS_WEBAPP_URL ?? "").trim();
  if (!url) return null;
  // Apps Script URL hi hona chahiye — warna token kisi unknown host par na jaye
  if (!/^https:\/\/script\.google\.com\//.test(url)) return null;
  return { url, token: (process.env.GOOGLE_SHEETS_TOKEN ?? "").trim() };
}

export function sheetsConfigured(): boolean {
  return Boolean(googleSheetsConfig());
}

let cache: { at: number; value: SheetSettings | null; failedAt: number } | null = null;

export function invalidateSheetSettings() {
  cache = null;
}

/** Owner ki Settings sheet padho. Fail ho to `null` (site defaults par chalti rehti hai). */
export async function readSheetSettings(options: { fresh?: boolean } = {}): Promise<SheetSettings | null> {
  const config = googleSheetsConfig();
  if (!config) return null;
  const now = Date.now();
  if (!options.fresh && cache && now - cache.at < CACHE_MS) return cache.value;
  // network down hai to har page par 5s wait na karo
  if (cache && now - cache.failedAt < CACHE_MS && cache.value === null) return null;

  try {
    const endpoint = new URL(config.url);
    endpoint.searchParams.set("action", "settings");
    if (config.token) endpoint.searchParams.set("token", config.token);
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = normaliseSheetSettings(await response.json());
    cache = { at: now, value, failedAt: value ? 0 : now };
    return value;
  } catch (error) {
    console.warn(`[sheets] settings read failed: ${(error as Error).message}`);
    cache = { at: now, value: null, failedAt: now };
    return null;
  }
}

/** Admin settings → Google Sheet (owner ki sheet hamesha latest rahe). */
export async function writeSheetSettings(settings: {
  announcement?: string;
  supportPhone?: string;
  supportEmail?: string;
  whatsapp?: string;
  upiId?: string;
  upiName?: string;
  gstin?: string;
  freeShipping?: boolean;
  adminUrl?: string;
}): Promise<boolean> {
  const config = googleSheetsConfig();
  if (!config) return false;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "text/plain;charset=utf-8", accept: "application/json" },
      body: JSON.stringify({
        token: config.token,
        action: "settings_save",
        settings: {
          announcement: settings.announcement ?? "",
          support_phone: settings.supportPhone ?? "",
          support_email: settings.supportEmail ?? "",
          whatsapp: settings.whatsapp ?? "",
          upi_id: settings.upiId ?? "",
          upi_name: settings.upiName ?? "",
          gstin: settings.gstin ?? "",
          free_shipping: settings.freeShipping !== false,
          ...(settings.adminUrl ? { admin_url: settings.adminUrl } : {}),
        },
      }),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    invalidateSheetSettings();
    return true;
  } catch (error) {
    console.warn(`[sheets] settings write failed: ${(error as Error).message}`);
    return false;
  }
}

export type SheetRecentRow = Record<string, string | number>;

/** Sheet ki last N rows (admin panel me dikhane ke liye). */
export async function readSheetRecent(
  sheet: "Orders" | "Payments" | "Messages" | "Newsletter" | "Checkout",
  limit = 20,
): Promise<SheetRecentRow[] | null> {
  const config = googleSheetsConfig();
  if (!config) return null;
  try {
    const endpoint = new URL(config.url);
    endpoint.searchParams.set("action", "recent");
    endpoint.searchParams.set("sheet", sheet);
    endpoint.searchParams.set("limit", String(Math.min(100, Math.max(1, limit))));
    if (config.token) endpoint.searchParams.set("token", config.token);
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { ok?: boolean; rows?: SheetRecentRow[] };
    if (!payload?.ok || !Array.isArray(payload.rows)) return null;
    return payload.rows;
  } catch (error) {
    console.warn(`[sheets] recent read failed: ${(error as Error).message}`);
    return null;
  }
}

/** Sheet me rows append karo. Best-effort — order kabhi isliye fail nahi hota. */
export async function appendSheetRows(appends: SheetAppend[]): Promise<boolean> {
  const config = googleSheetsConfig();
  if (!config || !appends.length) return false;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      cache: "no-store",
      // Apps Script preflight (OPTIONS) handle nahi karta — isliye simple request
      // `text/plain` bhejte hain, script body ko JSON.parse karti hai. CORS error nahi aata.
      headers: { "content-type": "text/plain;charset=utf-8", accept: "application/json" },
      body: JSON.stringify({ token: config.token, action: "append", rows: appends }),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.warn(`[sheets] append failed (${appends.map((a) => a.sheet).join(",")}): ${(error as Error).message}`);
    return false;
  }
}

const inr = (paise: number) => Math.round(paise) / 100;

/** Fire-and-forget sync — caller `await` kare to bhi 6s max. */
export async function syncOrderToSheet(
  order: Order,
  event: string,
  extra: Record<string, string | number | null> = {},
): Promise<boolean> {
  return appendSheetRows([
    { sheet: event.startsWith("payment") ? "Payments" : "Orders", row: orderSheetRow(order, event, extra) },
  ]);
}
