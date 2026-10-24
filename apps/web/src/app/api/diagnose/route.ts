import { getOrder } from "@/lib/orders";
import { getStoreSettings } from "@/lib/store-settings";
import { dbEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * TEMPORARY diagnostic (R22) — production par order page 500 ka asli error nikalne
 * ke liye. Sirf booleans/error strings deta hai, koi order data ya PII nahi.
 * Verify ke baad route delete ho jayega.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const number = url.searchParams.get("order") ?? "LK-DOESNOTEXIST";
  const out: Record<string, unknown> = { number, dbEnabled: dbEnabled() };

  try {
    const order = await getOrder(number);
    out.orderFound = Boolean(order);
    out.items = order?.items.length ?? 0;
  } catch (error) {
    out.orderError = (error as Error).message;
    out.orderStack = (error as Error).stack?.split("\n").slice(0, 6);
  }

  try {
    const settings = await getStoreSettings();
    out.settingsOk = Boolean(settings?.supportPhone);
  } catch (error) {
    out.settingsError = (error as Error).message;
    out.settingsStack = (error as Error).stack?.split("\n").slice(0, 6);
  }

  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
