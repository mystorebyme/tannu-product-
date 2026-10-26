import { getOrder } from "@/lib/orders";
import { createPaymentLink } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Third-party payment (Razorpay Payment Link). Keys na ho to manual UPI
 * instructions return hote hain — order kabhi block nahi hota.
 */
export async function POST(request: Request) {
  let body: { orderNumber?: string };
  try {
    body = (await request.json()) as { orderNumber?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.orderNumber) return Response.json({ error: "orderNumber required" }, { status: 400 });

  const order = await getOrder(body.orderNumber);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "paid") return Response.json({ paid: true });

  try {
    const initiation = await createPaymentLink(order);
    return Response.json(initiation);
  } catch (error) {
    console.error("payment initiation failed", error);
    return Response.json({ error: "Payment link generate nahi hua." }, { status: 502 });
  }
}
