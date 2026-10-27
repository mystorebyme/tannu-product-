import "server-only";

import type { Order } from "@liksha/types";

import { dbEnabled } from "./db";
import {
  SHEET_READ_TIMEOUT,
  appendSheetRows,
  googleSheetsConfig,
  readScriptVersion,
  scriptGet,
  sheetWriteInfo,
} from "./google-sheets";
import { orderItemSheetRows, orderSheetRow } from "./sheet-format";
import {
  groupOrdersFromRecentRows,
  parseOrderState,
  type OrderState,
  type SheetRow,
} from "./sheet-merge";

/**
 * R43 bug-fix: `order_state` timeout ho jaaye (Apps Script slow/cold) to compat
 * rows se reconstruct hota tha — items ki price Rs. 0, product link khaali,
 * image placeholder (customer ko WhatsApp message tak "Rs. 0" jaata tha). Par
 * compat rows me bhi aksar `Order JSON` snapshot maujood hota hai (site ne
 * write kiya tha) — usse utha kar parseOrderState ko do: snapshot + owner edits
 * overlay, dono mil jaate hain.
 */
function lastOrderJson(rows: SheetRow[]): string {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = String(rows[i]?.["Order JSON"] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * R40 (owner): **"Supabase par nahi chahiye — sheet me hi chahiye, only sheet."**
 *
 * Google Sheet hi orders ka database hai:
 *   • Orders tab append-only event log hai; har event row me poora order
 *     snapshot `Order JSON` column me jaata hai (audit hata kar — size chhoti).
 *   • Read = latest `Order JSON` + us order ki rows se owner ke live edits ka
 *     overlay (Order status / Admin Note / courier-AWB) — `mergeSheetTracking`
 *     wale proven rules, isliye sheet edit ~2 second me site par dikhta hai.
 *   • Purani rows (r40 se pehle, JSON column ke bina) → human columns se
 *     best-effort reconstruct (tracking page chalta rahe).
 *
 * Backend chunav (`ordersBackend`): `ORDERS_STORE` env override → sheet (agar
 * script r40+ configured) → postgres (DATABASE_URL) → json (dev/tests).
 * Production me DATABASE_URL hi nahi hai — sheet hi ek raasta hai.
 */

/** Script ka kam se kam version jo `Order JSON` + order_state samajhta hai. */
export const SHEET_ORDERS_MIN_MAJOR = 40;

export function sheetOrdersConfigured(): boolean {
  const config = googleSheetsConfig();
  return Boolean(config && config.token);
}

export type OrdersBackend = "sheet" | "postgres" | "json";

/**
 * Kaun sa backend chalega? Sheet **jeetta hai** (owner rule: only sheet) —
 * `ORDERS_STORE` env se force kar sakte hain (tests/dev ke liye `json`).
 */
export function ordersBackend(): OrdersBackend {
  const forced = (process.env.ORDERS_STORE ?? "").trim().toLowerCase();
  if (forced === "sheet" || forced === "postgres" || forced === "json") return forced;
  if (sheetOrdersConfigured()) return "sheet";
  if (dbEnabled()) return "postgres";
  return "json";
}

/**
 * R41 (owner: "abhi bi sheet mai nhai aa rha — fix kro"): script ka version
 * orders ko **block nahi karta**. Teen mode:
 *   • `full`    — script r40+: `order_state`/`orders_state` + `Order JSON` snapshot.
 *   • `compat`  — purana script (jaise live r38-1): writes = wahi append (script
 *                 unknown columns khud drop karta hai), reads = `?action=order`
 *                 (orderStory_ rows) + `?action=recent` → `orderFromSheetRows`
 *                 reconstruct. Orders sheet me TAB BHI save/read hote hain.
 *   • `none`    — sheet env hi set nahi (dev/json fallback).
 * Version padha hi na ja sake (script slow/cold) → optimistic `compat`:
 * write fail hua to honest friendly error, pehle se 503 nahi.
 */
export type SheetOrdersMode = "full" | "compat" | "none";

/** Sheet-orders ready? (configured + mode). 30s cache — version call sasta hai. */
let readyCache: { at: number; ready: boolean; reason: string; mode: SheetOrdersMode } | null = null;
export async function sheetOrdersReady(): Promise<{ ready: boolean; reason: string; mode: SheetOrdersMode }> {
  if (readyCache && Date.now() - readyCache.at < 30_000) return readyCache;
  let next: { ready: boolean; reason: string; mode: SheetOrdersMode };
  if (!sheetOrdersConfigured()) {
    next = { ready: false, mode: "none", reason: "GOOGLE_SHEETS_WEBAPP_URL/TOKEN set nahi" };
  } else {
    const version = await readScriptVersion();
    if (!version) {
      next = {
        ready: true,
        mode: "compat",
        reason: "script ka version padha nahi ja saka — compat mode (write fail hua to saaf error dikhega)",
      };
    } else if (version.major >= SHEET_ORDERS_MIN_MAJOR) {
      next = { ready: true, mode: "full", reason: "" };
    } else {
      next = {
        ready: true,
        mode: "compat",
        reason: `script ${version.version} par compat mode — orders sheet me hi save hote hain; Order JSON snapshot + dropdowns + Products catalog ke liye latest script (r43-1) paste karein`,
      };
    }
  }
  readyCache = { at: Date.now(), ...next };
  return next;
}

/** sheet-health/admin ke liye ek nazar me status. */
export async function sheetOrderStoreInfo(): Promise<{
  backend: OrdersBackend;
  configured: boolean;
  ready: boolean;
  mode: SheetOrdersMode;
  reason: string;
  version: string | null;
}> {
  const version = sheetOrdersConfigured() ? await readScriptVersion() : null;
  const { ready, reason, mode } = await sheetOrdersReady();
  return {
    backend: ordersBackend(),
    configured: sheetOrdersConfigured(),
    ready,
    mode,
    reason,
    version: version?.version ?? null,
  };
}

/* ────────────────────────────── write path ────────────────────────────── */

/**
 * Order ka event sheet me likho — **yahi primary save hai** (background nahi).
 * Ek hi append batch me: Orders row (human columns + `Order JSON` snapshot),
 * payment events par Payments row (owner log), `order.placed` par OrderItems.
 */
export async function persistOrderEvent(
  order: Order,
  event: string,
  options: { items?: boolean } = {},
): Promise<{ ok: boolean; error: string | null }> {
  if (!sheetOrdersConfigured()) return { ok: false, error: "sheet pipeline configured nahi" };
  // snapshot me audit nahi bhejte — rows khud event log hain, audit wahin se
  // banta hai (cell size chhoti rehti hai; MAX_CELL_CHARS script me 20k hai).
  const snapshot: Order = { ...order, audit: [] };
  const row = { ...orderSheetRow(order, event), "Order JSON": JSON.stringify(snapshot) };
  const appends: { sheet: Parameters<typeof appendSheetRows>[0][number]["sheet"]; row: Record<string, string | number> }[] = [
    { sheet: "Orders", row },
  ];
  if (event.startsWith("payment")) {
    appends.push({ sheet: "Payments", row: orderSheetRow(order, event) });
  }
  if (options.items || event === "order.placed" || event === "order.created") {
    orderItemSheetRows(order).forEach((itemRow) => appends.push({ sheet: "OrderItems", row: itemRow }));
  }
  const ok = await appendSheetRows(appends);
  invalidateSheetOrder(order.orderNumber);
  return { ok, error: ok ? null : (sheetWriteInfo()?.error ?? "sheet append fail hua") };
}

/* ────────────────────────────── read path ─────────────────────────────── */

const TTL_MS = Number(process.env.SHEET_TRACKING_TTL_MS ?? 2_000);
const orderCache = new Map<string, { at: number; value: Order | null }>();
let listCache: { at: number; value: Order[] } | null = null;

export function invalidateSheetOrder(orderNumber: string): void {
  orderCache.delete(orderNumber.toUpperCase());
  listCache = null;
}

export function invalidateSheetOrders(): void {
  orderCache.clear();
  listCache = null;
}

/** Ek order sheet se (2s TTL cache — write ke baad invalidate hota hai). */
export async function readSheetOrder(orderNumber: string): Promise<Order | null> {
  const wanted = orderNumber.trim().toUpperCase();
  if (!wanted) return null;
  const hit = orderCache.get(wanted);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const { mode } = await sheetOrdersReady();
  let value: Order | null = null;
  if (mode !== "none") {
    if (mode === "full") {
      const result = await scriptGet<{ order?: OrderState }>("order_state", { order: wanted }, { timeoutMs: SHEET_READ_TIMEOUT * 2 });
      if (result.ok) value = parseOrderState(result.data.order);
    }
    if (!value) {
      // compat (r38-1 jaise purane script): ?action=order → tab-wise rows
      // (orderStory_) → Orders rows se reconstruct. Full mode ka fallback bhi —
      // owner ne script downgrade kiya to bhi order page chalta rahe.
      // Dhyan rahe: findRows_ bottom-up scan karta hai → rows **newest-first**
      // aati hain; orderFromSheetRows chronological (latest last) maanta hai.
      const compat = await scriptGet<{ order?: { rows?: Record<string, SheetRow[]> } }>(
        "order",
        { order: wanted },
        { timeoutMs: SHEET_READ_TIMEOUT * 2 },
      );
      if (compat.ok) {
        const rows = [...(compat.data.order?.rows?.Orders ?? [])].reverse();
        value = rows.length
          ? parseOrderState({ orderNumber: wanted, rows, json: lastOrderJson(rows) })
          : null;
      }
    }
  }
  orderCache.set(wanted, { at: Date.now(), value });
  return value;
}

/** Saare orders newest-first (admin list) — 2s TTL cache. */
export async function readSheetOrders(limit = 200): Promise<Order[]> {
  if (listCache && Date.now() - listCache.at < TTL_MS) return listCache.value;
  const { mode } = await sheetOrdersReady();
  if (mode === "full") {
    const result = await scriptGet<{ orders?: OrderState[] }>(
      "orders_state",
      { limit: Math.min(300, Math.max(1, limit)) },
      { timeoutMs: SHEET_READ_TIMEOUT * 2 },
    );
    if (result.ok) {
      const orders = (result.data.orders ?? [])
        .map((state) => parseOrderState(state))
        .filter((order): order is Order => Boolean(order))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      listCache = { at: Date.now(), value: orders };
      return orders;
    }
  }
  if (mode !== "none") {
    // compat: ?action=recent&sheet=Orders (newest-first rows, ≤200) → group
    // by order number → chronological rows → reconstruct.
    const result = await scriptGet<{ rows?: SheetRow[] }>(
      "recent",
      { sheet: "Orders", limit: 200 },
      { timeoutMs: SHEET_READ_TIMEOUT * 2 },
    );
    if (result.ok) {
      const orders = groupOrdersFromRecentRows(result.data.rows ?? [])
        .map((group) =>
          parseOrderState({ orderNumber: group.orderNumber, rows: group.rows, json: lastOrderJson(group.rows) }),
        )
        .filter((order): order is Order => Boolean(order))
        .slice(0, Math.min(300, Math.max(1, limit)));
      listCache = { at: Date.now(), value: orders };
      return orders;
    }
  }
  return listCache?.value ?? [];
}

/** GST invoice serial — Invoices tab ki rows se (DB sequence ki zaroorat nahi). */
export async function nextInvoiceSerialSheet(): Promise<number | null> {
  const result = await scriptGet<{ rows?: SheetRow[] }>(
    "recent",
    { sheet: "Invoices", limit: 100 },
    { timeoutMs: SHEET_READ_TIMEOUT },
  );
  if (!result.ok) return null;
  let max = 0;
  for (const row of result.data.rows ?? []) {
    const match = /(\d+)\s*$/.exec(String(row["Invoice number"] ?? ""));
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  return max + 1;
}
