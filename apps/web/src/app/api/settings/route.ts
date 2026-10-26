import { preflight, withCors } from "@/lib/cors";
import { getStoreSettings, settingsSheetStatus } from "@/lib/store-settings";
import { googleSheetsConfig, settingsCsvUrl } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

/**
 * Public settings jo UI ko chahiye (announcement, UPI, support contact).
 *
 * Google Sheet configured hai to **sheet ki value jeetti hai** — owner redeploy ke
 * bina phone / UPI change kar sakta hai. `sheet` field batata hai ki sheet se
 * value aayi ya nahi (R35): koi secret/URL nahi, sirf sach —
 * `{ source, stale, at, error }`.
 */
async function handleGet(request: Request) {
  /**
   * Default: 15s sheet cache (Apps Script quota bache, jawab fast rahe).
   * `?fresh=1` = abhi sheet se padho (owner/support ke verify karne ke liye).
   */
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const settings = await getStoreSettings({ fresh });
  const status = settingsSheetStatus();
  const sheetConfigured = Boolean(googleSheetsConfig() || settingsCsvUrl());
  const usedSheet = Boolean(status.source);

  return Response.json(
    {
      data: {
        announcement: settings.announcement,
        freeShipping: settings.freeShipping,
        upiId: settings.upiId,
        upiName: settings.upiName,
        supportPhone: settings.supportPhone,
        whatsapp: settings.whatsapp,
        updatedAt: settings.updatedAt,
        // "google-sheet" sirf tab jab sheet se value sach me aayi ho
        source: usedSheet ? "google-sheet" : "admin",
        sheet: {
          configured: sheetConfigured,
          readFrom: status.source,
          readAt: status.at,
          /** sheet se value nahi aayi — abhi purani (cached/default) value chal rahi hai */
          stale: sheetConfigured && !usedSheet,
          ...(status.error ? { error: status.error } : {}),
        },
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  return withCors(await handleGet(request), request);
}

export const OPTIONS = preflight;
