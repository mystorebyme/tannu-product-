import { listOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders — admin panel ke liye (Bearer ADMIN_API_TOKEN).
 * Customer-facing order API se alag: yahan poora detail (address, phone) aata hai.
 */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim() ?? "";
  const expected = process.env.ADMIN_API_TOKEN ?? "";
  if (!expected || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await listOrders();
  return Response.json({ orders, total: orders.length }, { headers: { "cache-control": "no-store" } });
}
