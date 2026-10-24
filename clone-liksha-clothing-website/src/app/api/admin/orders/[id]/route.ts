import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isAuthenticated } from "@/lib/admin-auth";
import { sendTrackingEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const status = typeof body.status === "string" ? body.status : existing.status;
  const courier = typeof body.courier === "string" ? body.courier : existing.courier;
  const trackingId =
    typeof body.trackingId === "string" && body.trackingId.trim()
      ? body.trackingId.trim().toUpperCase()
      : existing.trackingId;

  const now = new Date();
  const patch: Partial<typeof orders.$inferInsert> = { status, courier, trackingId };

  if (status === "shipped" && !existing.shippedAt) patch.shippedAt = now;
  if ((status === "completed" || status === "delivered") && !existing.completedAt) {
    patch.completedAt = now;
    patch.shippedAt = patch.shippedAt ?? now;
  }

  const updated = await db.update(orders).set(patch).where(eq(orders.id, orderId)).returning();
  const order = updated[0];

  const shouldNotify =
    (body.sendEmail === undefined || body.sendEmail === true) &&
    !!order.trackingId &&
    ["shipped", "delivered", "completed"].includes(order.status);

  let email;
  if (shouldNotify) {
    const result = await sendTrackingEmail(order);
    email = { status: result.status, provider: result.provider };
  }

  return NextResponse.json({ ok: true, order, email });
}
