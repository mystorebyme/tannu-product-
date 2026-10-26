import "server-only";

import type { Order } from "@liksha/types";
import {
  invoiceSheetRow,
  normaliseSheetSettings,
  orderItemSheetRows,
  orderSheetRow,
  parseSettingsCsv,
  shipmentSheetRow,
  type SheetSettings,
} from "./sheet-format";

export { normaliseSheetSettings, orderItemSheetRows, orderSheetRow, parseSettingsCsv, shipmentSheetRow, invoiceSheetRow };
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

export type SheetName =
  | "Orders"
  | "OrderItems"
  | "Payments"
  | "Invoices"
  | "Shipments"
  | "Messages"
  | "Newsletter"
  | "Checkout"
  | "Reviews"
  | "Coupons"
  | "Inventory"
  | "Audit"
  | "Errors";

export type SheetAppend = {
  sheet: SheetName;
  row: Record<string, string | number | boolean | null | undefined>;
};

const READ_TIMEOUT_MS = 900;
const WRITE_TIMEOUT_MS = 6_000;
/** Sheet page load ko kabhi block na kare — 2.5s ke baad defaults/DB hi chalega. */
const CACHE_MS = 15_000;

/**
 * Google Apps Script ko browser jaisi request chahiye.
 *
 * Kyun (25 Oct 2026): bina `User-Agent` bheje Google datacenter IP (Vercel) ko
 * bot samajh kar `window['ppConfig']` wala JS challenge page lauta deta hai —
 * request script tak pahunchti hi nahi, aur owner ko "permission / HTML" problem
 * dikhti hai. Isliye har call me normal browser UA + accept headers jaate hain.
 */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const SHEET_REQUEST_HEADERS: Record<string, string> = {
  "user-agent": BROWSER_UA,
  accept: "application/json",
  "accept-language": "en-IN,en;q=0.9",
};

function sheetHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...SHEET_REQUEST_HEADERS, ...extra };
}

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

/**
 * Owner ki **published** Settings CSV (File → Share → Publish to web).
 *
 * Kyun: Apps Script ke bina bhi settings (phone, UPI ID, announcement) sheet se
 * padhi ja sakti hain — published CSV read-only hoti hai par padhne ke liye kaafi
 * hai. Isse "sheet me value badli, site par nahi aayi" wala gap band hota hai
 * jab tak naya Apps Script deployment set nahi hota.
 */
export function settingsCsvUrl(): string | null {
  const url = (process.env.GOOGLE_SHEETS_SETTINGS_CSV_URL ?? "").trim();
  if (!url) return null;
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) return null;
  return url;
}


let cache: { at: number; value: SheetSettings | null; failedAt: number } | null = null;

export function invalidateSheetSettings() {
  cache = null;
}

/** Owner ki Settings sheet padho. Fail ho to `null` (site defaults par chalti rehti hai). */
export async function readSheetSettings(options: { fresh?: boolean } = {}): Promise<SheetSettings | null> {
  const config = googleSheetsConfig();
  if (!config) return readSettingsFromCsv(options);
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
      headers: sheetHeaders(),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = normaliseSheetSettings(await response.json());
    cache = { at: now, value, failedAt: value ? 0 : now };
    return value;
  } catch (error) {
    console.warn(`[sheets] settings read failed: ${(error as Error).message}`);
    cache = { at: now, value: null, failedAt: now };
    // Apps Script down/galat ho to bhi owner ki csv (publish to web) se padho
    const csv = await readSettingsFromCsv({ fresh: true });
    if (csv) cache = { at: now, value: csv, failedAt: 0 };
    return csv;
  }
}

/** Public CSV se settings (Apps Script set na ho to bhi sheet padhi jaati hai). */
async function readSettingsFromCsv(options: { fresh?: boolean } = {}): Promise<SheetSettings | null> {
  const url = settingsCsvUrl();
  if (!url) return null;
  const now = Date.now();
  if (!options.fresh && cache && now - cache.at < CACHE_MS) return cache.value;
  if (cache && now - cache.failedAt < CACHE_MS && cache.value === null) return null;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: sheetHeaders({ accept: "text/csv" }),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = parseSettingsCsv(await response.text());
    cache = { at: now, value, failedAt: value ? 0 : now };
    return value;
  } catch (error) {
    console.warn(`[sheets] settings CSV read failed: ${(error as Error).message}`);
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
      headers: sheetHeaders({ "content-type": "text/plain;charset=utf-8" }),
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
    // Apps Script galti par bhi HTTP 200 deta hai — body check karna zaroori hai
    const body = await response.json().catch(() => null);
    if (body && body.ok === false) {
      console.warn(`[sheets] settings write rejected: ${String(body.error ?? "unknown")}`);
      return false;
    }
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
      headers: sheetHeaders(),
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
      headers: sheetHeaders({ "content-type": "text/plain;charset=utf-8" }),
      body: JSON.stringify({ token: config.token, action: "append", rows: appends }),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    /**
     * Apps Script kabhi HTTP 200 ke saath `{ok:false, error}` bhi bhejta hai
     * (galat token, sheet access, ya script me ReferenceError). Pehle hum use
     * success maan lete the — isliye "row nahi aayi" ka pata hi nahi chalta tha.
     */
    const text = await response.text();
    let payload: { ok?: boolean; written?: number; error?: string } | null = null;
    try {
      payload = JSON.parse(text) as { ok?: boolean; written?: number; error?: string };
    } catch {
      payload = null;
    }
    if (!payload) {
      /**
       * JSON hi nahi aaya = script ne jawab nahi diya (Google ka HTML error page,
       * ya galat URL). Pehle hum ise success maan lete the — isi wajah se
       * "sheet mirror: true" dikhta tha jabki sheet me kuch nahi jaata.
       */
      console.warn(
        `[sheets] append got non-JSON reply (${appends.map((a) => a.sheet).join(",")}) — script ka naya version deploy hua?`,
      );
      return false;
    }
    if (payload.ok === false) {
      console.warn(
        `[sheets] append rejected (${appends.map((a) => a.sheet).join(",")}): ${payload.error ?? "unknown error"}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[sheets] append failed (${appends.map((a) => a.sheet).join(",")}): ${(error as Error).message}`);
    return false;
  }
}

/**
 * Asli sheet ka id (owner ne jo link diya) — sirf **verify** karne ke liye.
 *
 * Sheet ki id public information hai (owner ka link). Token/URL kabhi yahan nahi.
 */
export const EXPECTED_SHEET_ID = "1k8fsea04WpbrGjiyXuDrrS2Eewt9W7wx9X2lUQc5qMo";

export type SheetHealth = {
  ok: boolean;
  spreadsheet: string | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  rows: Record<string, number>;
  ms: number;
  error?: string;
};

/**
 * Apps Script se poochho: "tum kaun si sheet pakde ho?".
 *
 * Kyun zaroori: 25 Oct 2026 ko script `getActiveSpreadsheet()` ki wajah se ek
 * **copy** me likh raha tha — website ke hisaab se sab theek tha, par owner ki
 * sheet khaali. Isliye admin panel ab id match karke warning dikhata hai.
 */
export async function readSheetHealth(): Promise<SheetHealth | null> {
  const config = googleSheetsConfig();
  if (!config) return null;
  const started = Date.now();
  try {
    const endpoint = new URL(config.url);
    endpoint.searchParams.set("action", "health");
    if (config.token) endpoint.searchParams.set("token", config.token);
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: sheetHeaders(),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS * 2),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as {
      ok?: boolean;
      spreadsheet?: string;
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      sheets?: { name?: string; rows?: number }[];
    };
    if (!payload?.ok) throw new Error("script ne ok:false diya");
    const rows: Record<string, number> = {};
    for (const entry of payload.sheets ?? []) {
      if (entry?.name) rows[entry.name] = Number(entry.rows ?? 0);
    }
    return {
      ok: true,
      spreadsheet: payload.spreadsheet ?? null,
      spreadsheetId: payload.spreadsheetId ?? null,
      spreadsheetUrl: payload.spreadsheetUrl ?? null,
      rows,
      ms: Date.now() - started,
    };
  } catch (error) {
    return { ok: false, spreadsheet: null, spreadsheetId: null, spreadsheetUrl: null, rows: {}, ms: Date.now() - started, error: (error as Error).message };
  }
}

/**
 * Fire-and-forget sync — caller `await` kare to bhi 6s max.
 *
 * `order.placed` par OrderItems tab bhi bharti hai (har item alag row) — isliye
 * owner ko size/colour wise bikri ek nazar me dikhti hai. Baaki events sirf
 * timeline row likhte hain (warna items 10 baar duplicate ho jaati).
 */
export async function syncOrderToSheet(
  order: Order,
  event: string,
  extra: Record<string, string | number | null> = {},
): Promise<boolean> {
  const appends: SheetAppend[] = [
    { sheet: event.startsWith("payment") ? "Payments" : "Orders", row: orderSheetRow(order, event, extra) },
  ];
  if (event === "order.placed" || event === "order.created") {
    orderItemSheetRows(order).forEach((row) => appends.push({ sheet: "OrderItems", row }));
  }
  return appendSheetRows(appends);
}

/** Tracking/courier update — Shipments tab me alag row (owner ko dispatch list) */
export async function syncShipmentToSheet(order: Order, status = "updated"): Promise<boolean> {
  return appendSheetRows([{ sheet: "Shipments", row: shipmentSheetRow(order, status) }]);
}

/** GST invoice banne par Invoices tab me row */
export async function syncInvoiceToSheet(
  invoice: Parameters<typeof invoiceSheetRow>[0],
  order: Order,
  type = "gst",
): Promise<boolean> {
  return appendSheetRows([{ sheet: "Invoices", row: invoiceSheetRow(invoice, order, type) }]);
}
