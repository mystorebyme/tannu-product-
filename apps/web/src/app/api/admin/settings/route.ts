import { getStoreSettings, saveStoreSettings, settingsSheetStatus } from "@/lib/store-settings";
import { googleSheetsConfig, settingsCsvUrl } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  return Boolean(process.env.ADMIN_API_TOKEN) && token === process.env.ADMIN_API_TOKEN;
}

/**
 * Admin ko settings + **sheet diagnostics** (R35).
 *
 * Owner ka sawaal: "sheet me UPI badla, site par kyun nahi aaya?" — isliye yahan
 * saaf dikhta hai ki sheet configured hai ya nahi, aakhri read kahan se aaya aur
 * fail hua to kyun (token/URL kabhi response me nahi).
 */
export async function GET(request: Request) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getStoreSettings({ fresh: true });
  const status = settingsSheetStatus();
  return Response.json({
    data: settings,
    sheet: {
      configured: Boolean(googleSheetsConfig() || settingsCsvUrl()),
      appsScript: Boolean(googleSheetsConfig()),
      publishedCsv: Boolean(settingsCsvUrl()),
      readFrom: status.source,
      readAt: status.at,
      usingSheetValue: Boolean(status.source),
      ...(status.error ? { error: status.error } : {}),
    },
  });
}

export async function PUT(request: Request) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const actor = (body as { actor?: string })?.actor?.slice(0, 120) || "admin";
  const payload = (body as { settings?: unknown })?.settings ?? body;
  return Response.json({ data: await saveStoreSettings(payload, actor) });
}
