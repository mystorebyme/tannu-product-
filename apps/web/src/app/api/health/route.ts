import { catalogMeta } from "@/lib/store";

export const dynamic = "force-static";

export async function GET() {
  // API ke saath same envelope — monitor sirf 200 dekhta hai, clients `data` padhte hain
  return Response.json({
    data: {
      status: "ok",
      service: "liksha-web",
      catalogBuiltAt: catalogMeta.builtAt,
      products: catalogMeta.productCount,
      time: new Date().toISOString(),
    },
  });
}
