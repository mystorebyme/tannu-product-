import { headers } from "next/headers";
import { siteConfig } from "@/config/site";
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

  try {
    out.siteUrl = siteConfig.url;
    out.parsedHost = new URL(siteConfig.url).host;
  } catch (error) {
    out.siteUrlError = (error as Error).message;
  }

  try {
    const headerList = await headers();
    out.host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  } catch (error) {
    out.headersError = (error as Error).message;
  }

  try {
    const order = await getOrder(number);
    if (order) {
      const { orderWhatsAppLink } = await import("@/lib/whatsapp");
      out.whatsapp = orderWhatsAppLink(order, `https://${out.host ?? "x"}`).slice(0, 40);
      out.statusCopy = order.status;
    }
  } catch (error) {
    out.waError = (error as Error).message;
    out.waStack = (error as Error).stack?.split("\n").slice(0, 5);
  }

  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
