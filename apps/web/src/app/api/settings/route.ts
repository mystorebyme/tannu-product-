import { preflight, withCors } from "@/lib/cors";
import { getStoreSettings } from "@/lib/store-settings";
import { sheetsConfigured } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

/**
 * Public settings jo UI ko chahiye (announcement, UPI, support contact).
 * Google Sheet configured hai to sheet ki value jeetti hai — owner redeploy
 * ke bina phone / email / UPI change kar sakta hai.
 */
async function handleGet() {
  const settings = await getStoreSettings({ fresh: true });
  return Response.json(
    {
      data: {
        announcement: settings.announcement,
        freeShipping: settings.freeShipping,
        upiId: settings.upiId,
        upiName: settings.upiName,
        supportPhone: settings.supportPhone,
        supportEmail: settings.supportEmail,
        whatsapp: settings.whatsapp,
        updatedAt: settings.updatedAt,
        source: sheetsConfigured() ? "google-sheet" : "admin",
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}


export async function GET(request: Request) {
  return withCors(await handleGet(), request);
}

export const OPTIONS = preflight;
