import {
  expectedSheetId,
  readSheetHealth,
  sheetWriteInfo,
  sheetsConfigured,
  type SheetHealth,
} from "@/lib/google-sheets";
import { sheetOrderStoreInfo } from "@/lib/orders-sheet";
import { getStoreSettings, storeSettingsInfo } from "@/lib/store-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sheet-health — **public** (bina key/token) sheet pipeline ka report card.
 *
 * R38 (owner): "order kiya, sheet me kuch show nahi ho raha — db kahan se chal
 * raha hai?" Iska jawab owner khud browser me khol kar dekh sake:
 *   • settings sheet se aa rahi hai ya nahi (source/age/upiLoaded),
 *   • Apps Script kaun sa version/sheet/token pakde hue hai (script ka `health`),
 *   • sheet par **last write** ka nateeja (orders/messages ja rahe hain ya nahi),
 *   • orders ka store (postgres/file) aur har problem ka seedha Hinglish fix.
 *
 * Privacy: sheet ka URL/token kabhi nahi jaata; deployment id bhi nahi. Script
 * health 30s module-cache me rehta hai (Apps Script quota bachane ke liye).
 */

let healthCache: { at: number; value: SheetHealth | null } | null = null;
const HEALTH_CACHE_MS = 30_000;

async function scriptHealth(): Promise<SheetHealth | null> {
  if (healthCache && Date.now() - healthCache.at < HEALTH_CACHE_MS) return healthCache.value;
  const value = await readSheetHealth();
  healthCache = { at: Date.now(), value };
  return value;
}

export async function GET() {
  const configured = sheetsConfigured();
  const started = Date.now();

  const [health, settings, info, orderStore] = await Promise.all([
    configured ? scriptHealth() : Promise.resolve(null),
    getStoreSettings().catch(() => null),
    Promise.resolve(storeSettingsInfo()),
    sheetOrderStoreInfo().catch(() => null),
  ]);

  const write = sheetWriteInfo();
  const help: string[] = [];
  /**
   * R39: probe ka timeout akela "sab fail" nahi hai — Apps Script cold start
   * 8s+ le sakta hai. Settings sheet se aa rahi hain (URL zinda hai) + last
   * write ok hai to timeout sirf warning hai, help (failure) nahi.
   */
  const warnings: string[] = [];

  if (!configured) {
    help.push("Vercel me GOOGLE_SHEETS_WEBAPP_URL set nahi — sheet pipeline band hai (docs/09-devops/google-sheets.md).");
  }
  if (health && !health.ok) {
    const probeTimedOut = /timeout|abort/i.test(String(health.error ?? ""));
    const pipelineAlive = info.source === "apps-script" && (!write || write.ok);
    if (probeTimedOut && pipelineAlive) {
      warnings.push(
        `Health probe timeout hua (${health.error}) par settings sheet se aa rahi hain aur last write ok hai — Apps Script cold start ki wajah se; dobara refresh kariye.`,
      );
    } else {
      help.push(
        `Apps Script jawab nahi de raha (${health.error ?? "unknown"}) — URL purana/dead ho sakta hai. Deploy → Manage deployments → wala /exec URL Vercel me daaliye.`,
      );
    }
  }
  if (health?.ok) {
    const major = Number(/^r(\d+)/.exec(String(health.version ?? ""))?.[1] ?? 0);
    if (major && major < 40) {
      help.push(`Script ka purana version chal raha hai (${health.version}) — r40-1 paste kariye (docs/00-overview/apps-script-code.md): Deploy → Manage deployments → ✏️ → New version → Deploy. R40 se orders **sheet me hi save hote hain** (Order JSON column) — purane script par order save nahi hoga.`);
    }
    if (health.tokenSet === false) {
      help.push("Script ka TOKEN set nahi — browser me <webapp URL>?action=set_token&token=<Vercel GOOGLE_SHEETS_TOKEN> kholiye.");
    } else if (health.tokenOk === false) {
      help.push("Vercel ka GOOGLE_SHEETS_TOKEN aur script ka token match nahi kar rahe — dono same rakhiye (set_token URL se).");
    }
    if (health.sheetFound === false) {
      help.push(
        health.sheetConfigured === false
          ? "Script ki sheet (SHEET_ID) set nahi hai — /exec URL browser me kholiye: panel ke form me apni sheet ka URL daal kar 'Sheet set karo' dabaiye (website SHEET_EXPECTED_ID env se khud bhi set kar deti hai)."
          : "Script ko sheet access nahi mili — sheet → Share → script ke account ko Editor dijiye.",
      );
    }
    if (expectedSheetId() && health.spreadsheetId && health.spreadsheetId !== expectedSheetId()) {
      help.push(`Script doosri sheet pakde hue hai (${health.spreadsheetId}); expected ${expectedSheetId()} — /exec panel ke form se sahi sheet URL set kariye (?action=sheet_set&id=…&token=…) ya SHEET_EXPECTED_ID env update kariye.`);
    }
    if (health.upiSet === false) {
      help.push("Sheet ke Settings tab me upi_id khaali hai — website par payment tab tak pause rahega. Apna UPI ID bhariye.");
    }
  }
  if (configured && !info.source) {
    help.push(`Settings sheet se padhi hi nahi ja saki${info.lastError ? ` (${info.lastError})` : ""} — script health upar dekhiye.`);
  }
  if (write && !write.ok) {
    help.push(`Sheet par last write (${write.sheets}) fail hua: ${write.error ?? "unknown"} — orders/messages sheet me nahi ja rahe; upar ka fix kariye.`);
  }
  if (!settings?.upiId) {
    help.push("Website ke paas abhi koi UPI ID nahi hai (sheet + fallback dono khaali) — payment page 'load nahi ho rahi' dikhata rahega.");
  }
  /** R40: orders ka store sheet hai — ready na ho to order save hi nahi hoga. */
  if (orderStore && orderStore.backend === "sheet" && !orderStore.ready) {
    help.push(`Orders sheet me save nahi ho payenge: ${orderStore.reason} — script r40-1 paste karke New version deploy kariye.`);
  }

  return Response.json(
    {
      ok: help.length === 0,
      time: new Date().toISOString(),
      ms: Date.now() - started,
      ordersStore: orderStore?.backend ?? "json",
      sheetOrders: orderStore
        ? { ready: orderStore.ready, reason: orderStore.reason || null, version: orderStore.version }
        : null,
      sheet: {
        configured,
        expectedSheetId: expectedSheetId() || null,
        settings: {
          source: info.source,
          ageMs: info.ageMs,
          stale: info.stale,
          lastReadMs: info.lastReadMs,
          lastError: info.lastError,
          ttlMs: info.ttlMs,
        },
        upiLoaded: Boolean(settings?.upiId),
        script: health
          ? {
              ok: health.ok,
              version: health.version ?? null,
              tokenSet: health.tokenSet ?? null,
              tokenOk: health.tokenOk ?? null,
              sheetFound: health.sheetFound ?? null,
              sheetConfigured: health.sheetConfigured ?? null,
              sheetId: health.spreadsheetId,
              spreadsheet: health.spreadsheet,
              idMatch: health.idMatch ?? null,
              bound: health.bound ?? null,
              upiSet: health.upiSet ?? null,
              rows: health.rows,
              problems: health.problems ?? null,
              error: health.error ?? null,
            }
          : null,
        lastWrite: write ? { at: new Date(write.at).toISOString(), ok: write.ok, sheets: write.sheets, error: write.error } : null,
      },
      help,
      warnings,
      note: "Ye page sirf status batata hai — sheet ka URL/token kabhi expose nahi karta.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
