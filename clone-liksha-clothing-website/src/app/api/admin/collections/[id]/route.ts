import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { collections } from "@/db/schema";
import { isAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Partial<typeof collections.$inferInsert> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.subtitle === "string") patch.subtitle = body.subtitle;
  if (typeof body.image === "string") patch.image = body.image;
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;

  const updated = await db
    .update(collections)
    .set(patch)
    .where(eq(collections.id, Number(id)))
    .returning({ id: collections.id });

  if (updated.length === 0) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
