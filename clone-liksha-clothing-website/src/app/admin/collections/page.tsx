import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { collections } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { ensureSeeded } from "@/lib/store";
import { CollectionsEditor } from "@/components/admin/collections-editor";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  await requireAdmin();
  await ensureSeeded();
  const rows = await db.select().from(collections).orderBy(asc(collections.sortOrder));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Collections</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">
            {rows.length} collections · used on the home page and in the navigation
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
        <CollectionsEditor collections={rows} />
      </div>
    </div>
  );
}
