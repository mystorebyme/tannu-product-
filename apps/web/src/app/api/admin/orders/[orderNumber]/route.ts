import type { OrderStatus } from "@liksha/types";
import { getOrder, OrderError, setTracking, updateOrderStatus } from "@/lib/orders";
import { confirmPayment, failPayment } from "@/lib/orders";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim() ?? "";
  const expected = process.env.ADMIN_API_TOKEN ?? "";
  return Boolean(expected) && token === expected;
}

/** GET /api/admin/orders/[orderNumber] — single order, full detail */
export async function GET(request: Request, context: { params: Promise<{ orderNumber: string }> }) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { orderNumber } = await context.params;
  const order = await getOrder(decodeURIComponent(orderNumber));
  if (!order) return Response.json({ error: "Order nahi mila" }, { status: 404 });
  return Response.json({ order }, { headers: { "cache-control": "no-store" } });
}

/**
 * PATCH /api/admin/orders/[orderNumber]
 *
 * Body ek hi action le sakta hai:
 *   { action: "status", status, note? }      → status machine ke hisaab se
 *   { action: "tracking", courier, awb, url }→ courier/AWB customer ko dikhta hai
 *   { action: "payment", reference, amount, note? } → manual UPI verify
 *   { action: "payment_failed", reason }     → payment fail mark
 */
export async function PATCH(request: Request, context: { params: Promise<{ orderNumber: string }> }) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { orderNumber: raw } = await context.params;
  const orderNumber = decodeURIComponent(raw);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const actor = String(body.actor ?? "admin");
  const action = String(body.action ?? "");

  try {
    if (action === "status") {
      const status = String(body.status ?? "") as OrderStatus;
      const order = updateOrderStatus(orderNumber, status, actor, body.note ? String(body.note) : undefined);
      return Response.json({ order });
    }

    if (action === "tracking") {
      const order = setTracking(
        orderNumber,
        {
          courier: body.courier ? String(body.courier) : null,
          awb: body.awb ? String(body.awb) : null,
          url: body.url ? String(body.url) : null,
        },
        actor,
      );
      return Response.json({ order });
    }

    if (action === "payment") {
      const result = await confirmPayment(orderNumber, {
        gateway: String(body.gateway ?? "manual-upi"),
        reference: body.reference ? String(body.reference) : null,
        amount: Number(body.amount ?? 0),
        actor,
      });
      if (!result) return Response.json({ error: "Order nahi mila" }, { status: 404 });
      return Response.json({ order: result.order, alreadyPaid: result.alreadyPaid });
    }

    if (action === "payment_failed") {
      const order = await failPayment(orderNumber, {
        gateway: String(body.gateway ?? "manual-upi"),
        reference: body.reference ? String(body.reference) : null,
        reason: String(body.reason ?? "admin marked failed"),
      });
      if (!order) return Response.json({ error: "Order nahi mila" }, { status: 404 });
      return Response.json({ order });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("admin order patch failed", error);
    return Response.json({ error: "Update nahi hua." }, { status: 500 });
  }
}
