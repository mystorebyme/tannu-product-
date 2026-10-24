import { getStoreSettings } from "@/lib/store-settings";
import { readSheetRecent, readSheetSettings, sheetsConfigured } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sheet — admin panel ka "Google Sheet" screen.
 * Sheet configured hai to live settings + last rows; nahi hai to saaf status.
 */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = sheetsConfigured();
  const current = await getStoreSettings({ fresh: true });
  if (!configured) {
    return Response.json({
      configured: false,
      settings: current,
      sheet: null,
      recent: { orders: [], payments: [], messages: [] },
      hint: "GOOGLE_SHEETS_WEBAPP_URL + GOOGLE_SHEETS_TOKEN set kariye (docs/09-devops/google-sheets.md).",
    });
  }

  const [sheetSettings, orders, payments, messages] = await Promise.all([
    readSheetSettings({ fresh: true }),
    readSheetRecent("Orders", 15),
    readSheetRecent("Payments", 10),
    readSheetRecent("Messages", 10),
  ]);

  return Response.json({
    configured: true,
    reachable: Boolean(sheetSettings),
    settings: sheetSettings ?? current,
    live: current,
    // sheet ka URL/token frontend par kabhi nahi jaata
    sheet: null,
    recent: {
      orders: orders ?? [],
      payments: payments ?? [],
      messages: messages ?? [],
    },
  });
}
