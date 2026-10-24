import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { isAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { read?: boolean };
  await db
    .update(contactMessages)
    .set({ read: body.read === true })
    .where(eq(contactMessages.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  await db.delete(contactMessages).where(eq(contactMessages.id, Number(id)));
  return NextResponse.json({ ok: true });
}
