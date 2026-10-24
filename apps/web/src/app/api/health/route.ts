import { catalogMeta } from "@/lib/store";
import { dbEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // API ke saath same envelope — monitor sirf 200 dekhta hai, clients `data` padhte hain
  return Response.json({
    data: {
      status: "ok",
      service: "liksha-web",
      catalogBuiltAt: catalogMeta.builtAt,
      products: catalogMeta.productCount,
      // orders ka backend: postgres (production) ya json (local dev)
      ordersStore: dbEnabled() ? "postgres" : "json",
      time: new Date().toISOString(),
    },
  });
}
