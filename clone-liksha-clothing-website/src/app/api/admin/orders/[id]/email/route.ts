import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isAuthenticated } from "@/lib/admin-auth";
import { sendTrackingEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function POST(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const trackingId =
    typeof body.trackingId === "string" && body.trackingId.trim()
      ? body.trackingId.trim().toUpperCase()
      : existing.trackingId;

  if (!trackingId) {
    return NextResponse.json({ error: "A tracking ID is required to send the tracking email." }, { status: 400 });
  }

  const [order] = await db
    .update(orders)
    .set({
      trackingId,
      courier: typeof body.courier === "string" ? body.courier : existing.courier,
    })
    .where(eq(orders.id, orderId))
    .returning();

  const result = await sendTrackingEmail(order);
  return NextResponse.json({ ok: true, email: { status: result.status, provider: result.provider } });
}
