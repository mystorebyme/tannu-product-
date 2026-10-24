import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { isAuthenticated } from "@/lib/admin-auth";
import { ensureSeeded, getProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder));
  return NextResponse.json({ products: rows });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const handle = String(body.handle ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const title = String(body.title ?? "").trim();
  if (!handle || !title) {
    return NextResponse.json({ error: "Title and handle are required." }, { status: 400 });
  }

  const price = Number(body.price) || 0;
  const compareAtPrice = body.compareAtPrice ? Number(body.compareAtPrice) : null;

  await ensureSeeded();
  const existing = await getProducts();
  if (existing.find((product) => product.handle === handle)) {
    return NextResponse.json({ error: "A product with this handle already exists." }, { status: 409 });
  }

  const inserted = await db
    .insert(products)
    .values({
      handle,
      title,
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : null,
      images: (body.images as string[] | undefined) ?? [],
      collections: (body.collections as string[] | undefined) ?? ["party-wear-gown"],
      category: String(body.category ?? "anarkali"),
      fabric: String(body.fabric ?? "Premium Georgette"),
      color: String(body.color ?? "As Shown"),
      details: (body.details as string[] | undefined) ?? [],
      sizes: (body.sizes as string[] | undefined) ?? ["Free Size"],
      description: String(body.description ?? ""),
      inStock: body.inStock === false ? false : true,
      featured: body.featured === true,
      sortOrder: Number(body.sortOrder) || existing.length,
    })
    .returning({ id: products.id });

  return NextResponse.json({ ok: true, id: inserted[0]?.id, handle });
}
