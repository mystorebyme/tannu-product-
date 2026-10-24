import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { ensureSeeded } from "@/lib/store";
import { ProductsManager } from "@/components/admin/products-manager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; collection?: string; category?: string }>;
}) {
  await requireAdmin();
  const { q, collection, category } = await searchParams;
  await ensureSeeded();
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Products</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">
            {rows.length} items in the store · every item listed with its full image gallery
          </p>
        </div>
        <Link
          href="/admin"
          className="border border-[#ddd2c6] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] uppercase"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-5">
        <ProductsManager
          products={rows}
          initialQuery={q ?? ""}
          initialCollection={collection ?? ""}
          initialCategory={category ?? ""}
        />
      </div>
    </div>
  );
}
