import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { syncCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const count = await syncCatalog();
    return NextResponse.json({ ok: true, products: count });
  } catch (error) {
    console.error("resync failed", error);
    return NextResponse.json({ error: "Catalogue sync failed." }, { status: 500 });
  }
}
