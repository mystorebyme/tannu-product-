import fs from "./fs-runtime";
import { dataFile } from "./data-dir";
import { dbEnabled } from "./db";
import type { SheetSettings } from "./sheet-format";

/**
 * Sheet se aayi **last achhi** settings (R35).
 *
 * Kyun: Apps Script dheema/down ho to pehle site chup-chaap env default par chali
 * jaati thi — yaani sheet me naya UPI daalne ke baad bhi purana UPI dikhta tha
 * (owner ka complaint: "sheet me change kiya, site par nahi aaya"). Ab jo aakhri
 * baar sheet se sahi value mili thi wo yaad rakhi jaati hai aur sheet fail hone
 * par **wahi** use hoti hai — galat UPI kabhi flash nahi hoti.
 *
 * Storage: Postgres (`store_settings` me id = 'sheet-cache') ya `.data/sheet-settings.json`
 * — dono jagah `fs-runtime` se, isliye Cloudflare Workers par bhi chalta hai.
 */
export type CachedSheetSettings = { settings: SheetSettings; at: string };

const FILE = "sheet-settings.json";
const DB_ID = "sheet-cache";

export async function readCachedSheetSettings(): Promise<CachedSheetSettings | null> {
  try {
    if (dbEnabled()) {
      const { query } = await import("./db");
      const rows = await query<{ payload: CachedSheetSettings }>(
        "select payload from store_settings where id = $1 limit 1",
        [DB_ID],
      );
      const payload = rows[0]?.payload;
      return payload && payload.settings ? payload : null;
    }
    const file = dataFile(FILE);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as CachedSheetSettings;
    return parsed && parsed.settings ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeCachedSheetSettings(settings: SheetSettings): Promise<void> {
  const payload: CachedSheetSettings = { settings, at: new Date().toISOString() };
  try {
    if (dbEnabled()) {
      const { query } = await import("./db");
      await query(
        `insert into store_settings (id, payload, updated_at) values ($1, $2::jsonb, now())
         on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
        [DB_ID, JSON.stringify(payload)],
      );
      return;
    }
    const file = dataFile(FILE);
    fs.mkdirSync(file.replace(/\/[^/]+$/, ""), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  } catch {
    // cache best-effort hai — iske fail hone se settings kabhi fail na hon
  }
}
