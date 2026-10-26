import "server-only";

import fs from "./fs-runtime";
import { dataFile } from "./data-dir";
import { dbEnabled } from "./db";
import {
  invalidateSheetSettings,
  readSheetSettingsDetailed,
  sheetSettingsStatus,
  writeSheetSettings,
} from "./google-sheets";
import type { SheetSettings } from "./sheet-format";
import { readCachedSheetSettings, writeCachedSheetSettings } from "./sheet-settings-cache";

/**
 * Store settings — source of truth storefront hai.
 * Admin panel API se save karta hai, website runtime par padhti hai.
 */
export type StoreSettings = {
  announcement: string;
  freeShipping: boolean;
  /** payment yahan aata hai — owner Google Sheet se badal sakta hai */
  upiId: string;
  upiName: string;
  gstin: string;
  /** GST invoice ka seller block — sirf admin panel se edit hota hai, public API me nahi jaata */
  sellerName: string;
  sellerAddress: string;
  sellerState: string;
  supportPhone: string;
  /** @deprecated site par kahin dikhta nahi (owner rule) — sirf internal record */
  supportEmail: string;
  whatsapp: string;
  /** Admin panel ka link (sirf admin/owner ke liye — public API me nahi jaata) */
  adminUrl: string;
  updatedAt: string;
  updatedBy: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  announcement: "Diwali Sale — Up to 70% OFF · Final price ₹499 onwards",
  freeShipping: true,
  upiId: process.env.STORE_UPI_ID ?? "dhakadgourav@fam",
  upiName: process.env.STORE_UPI_NAME ?? "Designer Clothing",
  gstin: process.env.SELLER_GSTIN ?? "",
  sellerName: process.env.SELLER_NAME ?? "Designer Clothing",
  sellerAddress: process.env.SELLER_ADDRESS ?? "",
  sellerState: process.env.SELLER_STATE ?? "Rajasthan",
  supportPhone: "8005900581",
  // Owner rule: site/API par support email nahi. Internal record ke liye ab
  // sirf env (SELLER_EMAIL) — default khaali.
  supportEmail: process.env.SELLER_EMAIL ?? "",
  whatsapp: "8005900581",
  adminUrl: process.env.ADMIN_PANEL_URL ?? "",
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
};

let cache: { at: number; value: StoreSettings } | null = null;

export function normalizeStoreSettings(input: unknown): StoreSettings {
  const base = DEFAULT_STORE_SETTINGS;
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<StoreSettings>;
  const text = (value: unknown, fallback: string, max = 240) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
  return {
    announcement: typeof raw.announcement === "string" ? raw.announcement.trim().slice(0, 180) : base.announcement,
    freeShipping: raw.freeShipping !== false,
    upiId: text(raw.upiId, base.upiId, 80),
    upiName: text(raw.upiName, base.upiName, 80),
    gstin: typeof raw.gstin === "string" ? raw.gstin.trim().toUpperCase().slice(0, 20) : base.gstin,
    sellerName: text(raw.sellerName, base.sellerName, 120),
    sellerAddress: typeof raw.sellerAddress === "string" ? raw.sellerAddress.trim().slice(0, 400) : base.sellerAddress,
    sellerState: text(raw.sellerState, base.sellerState, 60),
    supportPhone: text(raw.supportPhone, base.supportPhone, 16),
    supportEmail: text(raw.supportEmail, base.supportEmail, 120),
    whatsapp: text(raw.whatsapp, base.whatsapp, 16),
    adminUrl: text(raw.adminUrl, base.adminUrl, 200),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : base.updatedBy,
  };
}

async function load(): Promise<StoreSettings> {
  if (dbEnabled()) {
    const { query } = await import("./db");
    const rows = await query<{ payload: StoreSettings }>(
      "select payload from store_settings where id = 'default' limit 1",
    );
    return rows[0] ? normalizeStoreSettings(rows[0].payload) : DEFAULT_STORE_SETTINGS;
  }
  const file = dataFile("settings.json");
  if (!fs.existsSync(file)) return DEFAULT_STORE_SETTINGS;
  try {
    return normalizeStoreSettings(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

/** Sheet me jo mila use stored settings par chadhao (sheet jeetti hai). */
export function mergeSheetSettings(stored: StoreSettings, sheet: SheetSettings | null): StoreSettings {
  if (!sheet) return stored;
  return normalizeStoreSettings({
    ...stored,
    ...(sheet.announcement ? { announcement: sheet.announcement } : {}),
    ...(sheet.supportPhone ? { supportPhone: sheet.supportPhone } : {}),
    ...(sheet.supportEmail ? { supportEmail: sheet.supportEmail } : {}),
    ...(sheet.whatsapp ? { whatsapp: sheet.whatsapp } : {}),
    ...(sheet.upiId ? { upiId: sheet.upiId } : {}),
    ...(sheet.upiName ? { upiName: sheet.upiName } : {}),
    ...(sheet.gstin ? { gstin: sheet.gstin } : {}),
    ...(typeof sheet.freeShipping === "boolean" ? { freeShipping: sheet.freeShipping } : {}),
    ...(sheet.adminUrl ? { adminUrl: sheet.adminUrl } : {}),
    ...(sheet.announcement || sheet.upiId || sheet.supportPhone
      ? { updatedAt: new Date().toISOString(), updatedBy: "google-sheet" }
      : {}),
  });
}

/**
 * Sheet fail ho to last-known-good par chalo — env/default par nahi.
 *
 * Owner ne sheet me UPI badla aur Apps Script ne ek baar timeout diya to pehle
 * site purana UPI dikha deti thi. Ab: stored settings + aakhri sahi sheet value.
 */
async function storedWithLastGoodSheet(): Promise<StoreSettings> {
  const stored = await load();
  const cached = await readCachedSheetSettings();
  return mergeSheetSettings(stored, cached?.settings ?? null);
}

/**
 * Settings = database/file ke defaults + owner ki Google Sheet (sheet jeetti hai).
 * Sheet me jo cell bhara hua hai wahi site par jaata hai — 15s cache.
 * Sheet fail ho to aakhri sahi sheet value (stale) use hoti hai, env default nahi.
 */
export async function getStoreSettings(options: { fresh?: boolean } = {}): Promise<StoreSettings> {
  if (!options.fresh && cache && Date.now() - cache.at < 5_000) return cache.value;

  const stored = await load();
  const read = await readSheetSettingsDetailed({ fresh: options.fresh });
  const value = read.settings
    ? mergeSheetSettings(stored, read.settings)
    : mergeSheetSettings(stored, (await readCachedSheetSettings())?.settings ?? null);

  // sheet se sahi value mili → agle fail ke liye sambhal ke rakho
  if (read.settings) await writeCachedSheetSettings(read.settings);

  cache = { at: Date.now(), value };
  return value;
}

/**
 * Payment/tracking page ke liye settings — **time budget ke saath**.
 *
 * Sheet (Apps Script) 0.3–5s le sakti hai. Budget khatam ho to pehle jaisa
 * hardcoded default nahi — ab **stored + last-known-good sheet** laut-ta hai
 * (yaani wahi UPI jo owner ne sheet me set kiya tha), aur request background me
 * cache garam kar deti hai.
 */
export async function getStoreSettingsFast(budgetMs = 1_200): Promise<StoreSettings> {
  // 5s se purana cache payment page par nahi — sheet ka naya UPI turant dikhe
  if (cache && Date.now() - cache.at < 5_000) return cache.value;

  const slow = getStoreSettings({ fresh: true }).catch(() => DEFAULT_STORE_SETTINGS);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), budgetMs);
    if (typeof timer === "object" && typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as { unref: () => void }).unref();
    }
  });
  const fast = await Promise.race([slow, timeout]);
  if (timer) clearTimeout(timer);
  if (fast) return fast;
  // background me poora ho jaaye (agle request par cache ready milega)
  void slow;
  try {
    return await storedWithLastGoodSheet();
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

/** Tests ke liye — memory cache saaf (5s TTL wala). */
export function resetStoreSettingsCache(): void {
  cache = null;
}

/** Owner/support diagnostics — sheet se aakhri read ka sach (koi secret nahi). */
export function settingsSheetStatus(): ReturnType<typeof sheetSettingsStatus> {
  return sheetSettingsStatus();
}

export async function saveStoreSettings(input: unknown, actor: string): Promise<StoreSettings> {
  const next = normalizeStoreSettings({
    ...(input as StoreSettings),
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  });

  if (dbEnabled()) {
    const { query } = await import("./db");
    await query(
      `insert into store_settings (id, payload, updated_at) values ('default', $1::jsonb, now())
       on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
      [JSON.stringify(next)],
    );
  } else {
    const file = dataFile("settings.json");
    fs.mkdirSync(file.replace(/\/[^/]+$/, ""), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
  }

  // sheet configured hai to admin ka edit seedha sheet me bhi (owner ko wahi dikhe)
  await writeSheetSettings(next).catch(() => false);

  /**
   * R35: admin save ke baad purani sheet value 15s tak wapas na aaye, aur sheet
   * fail ho to bhi owner ka **abhi ka** edit rahe (purana UPI na laute).
   */
  invalidateSheetSettings();
  await writeCachedSheetSettings({
    announcement: next.announcement,
    supportPhone: next.supportPhone,
    supportEmail: next.supportEmail,
    whatsapp: next.whatsapp,
    upiId: next.upiId,
    upiName: next.upiName,
    gstin: next.gstin,
    freeShipping: next.freeShipping,
    adminUrl: next.adminUrl,
  });

  cache = { at: Date.now(), value: next };
  return next;
}
