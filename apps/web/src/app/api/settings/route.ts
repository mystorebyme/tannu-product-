import { getStoreSettings } from "@/lib/store-settings";

export const dynamic = "force-dynamic";

/** Public settings jo UI ko chahiye (announcement, free shipping, support contact). */
export async function GET() {
  const settings = await getStoreSettings();
  return Response.json(
    {
      data: {
        announcement: settings.announcement,
        freeShipping: settings.freeShipping,
        supportPhone: settings.supportPhone,
        supportEmail: settings.supportEmail,
        updatedAt: settings.updatedAt,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
