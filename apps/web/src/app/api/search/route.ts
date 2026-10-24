import { searchProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Header ka instant search — client bundle me catalog nahi bhejna padta */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("q") ?? "";
  const limit = Math.min(12, Number(searchParams.get("limit") ?? 8) || 8);
  return Response.json(
    { query: term, results: searchProducts(term, limit) },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}
