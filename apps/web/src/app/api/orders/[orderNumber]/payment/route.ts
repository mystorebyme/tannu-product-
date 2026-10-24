import { paymentStatusFor } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/orders/:orderNumber/payment
 *
 * Payment page ise har 8 second me poll karta hai — "pending → processing →
 * paid / failed" live dikhta hai (page refresh ki zarurat nahi).
 *
 * Security: sirf status/metadata jaata hai (koi address, item ya phone nahi).
 * Order number random `LK-XXXXXXXX` hai, aur yahi page customer ko dikhta hai.
 * `cache-control: no-store` — status kabhi purana na dikhe.
 */
export async function GET(_request: Request, context: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await context.params;
  const status = await paymentStatusFor(orderNumber);
  if (!status) {
    return Response.json({ error: "Order not found" }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  return Response.json(status, { headers: { "cache-control": "no-store" } });
}
