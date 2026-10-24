import "server-only";

import fs from "node:fs";
import { dataFile } from "./data-dir";
import { dbEnabled } from "./db";

/**
 * Store settings — source of truth storefront hai.
 * Admin panel API se save karta hai, website runtime par padhti hai.
 */
export type StoreSettings = {
  announcement: string;
  freeShipping: boolean;
  upiId: string;
  gstin: string;
  supportPhone: string;
  supportEmail: string;
  updatedAt: string;
  updatedBy: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  announcement: "",
  freeShipping: true,
  upiId: process.env.STORE_UPI_ID ?? "likshaclothing@upi",
  gstin: process.env.SELLER_GSTIN ?? "",
  supportPhone: "9909790455",
  supportEmail: "Info.likshaclothing@gmail.com",
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
    gstin: typeof raw.gstin === "string" ? raw.gstin.trim().slice(0, 20) : base.gstin,
    supportPhone: text(raw.supportPhone, base.supportPhone, 16),
    supportEmail: text(raw.supportEmail, base.supportEmail, 120),
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

export async function getStoreSettings(options: { fresh?: boolean } = {}): Promise<StoreSettings> {
  if (!options.fresh && cache && Date.now() - cache.at < 5_000) return cache.value;
  const value = await load();
  cache = { at: Date.now(), value };
  return value;
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

  cache = { at: Date.now(), value: next };
  return next;
}
