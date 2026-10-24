import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { isAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof products.$inferInsert> = {};

  if (typeof body.title === "string") patch.title = body.title.trim();
  if (body.price !== undefined) patch.price = Number(body.price) || 0;
  if (body.compareAtPrice !== undefined) {
    const compare = Number(body.compareAtPrice) || 0;
    patch.compareAtPrice = compare > (patch.price ?? 0) ? compare : null;
  }
  if (Array.isArray(body.images)) patch.images = body.images.map(String).filter(Boolean);
  if (Array.isArray(body.collections)) patch.collections = body.collections.map(String);
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.fabric === "string") patch.fabric = body.fabric;
  if (typeof body.color === "string") patch.color = body.color;
  if (Array.isArray(body.details)) patch.details = body.details.map(String).filter(Boolean);
  if (Array.isArray(body.sizes)) patch.sizes = body.sizes.map(String).filter(Boolean);
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.inStock === "boolean") patch.inStock = body.inStock;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;

  const updated = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, productId))
    .returning({ id: products.id });

  if (updated.length === 0) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<Params> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await db.delete(products).where(eq(products.id, productId));
  return NextResponse.json({ ok: true });
}
