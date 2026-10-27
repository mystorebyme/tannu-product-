import { catalogMeta } from "@/lib/store";
import { catalogSheetInfo } from "@/lib/catalog-sheet";
import { dbEnabled, ensureSchema, query } from "@/lib/db";
import { ordersBackend } from "@/lib/orders-sheet";
import { isCloudflareWorkers, isEphemeralStorage } from "@/lib/fs-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health + DB check.
 *
 * `db: "up"` tabhi jab Postgres se `select 1` chala ho. Schema bootstrap bhi
 * yahin trigger hota hai (Vercel par koi migrate step nahi hota), isliye pehla
 * health call naye DB ko taiyaar kar deta hai.
 */
export async function GET() {
  let db: "off" | "up" | "error" = "off";
  let dbError: string | null = null;
  if (dbEnabled()) {
    try {
      await ensureSchema();
      await query("select 1");
      db = "up";
    } catch (error) {
      db = "error";
      dbError = error instanceof Error ? error.message.slice(0, 180) : "unknown error";
    }
  }

  const catalogInfo = catalogSheetInfo();

  return Response.json(
    {
      data: {
        status: db === "error" ? "degraded" : "ok",
        service: "liksha-web",
        // deployment identity — CI isse "mera build live hai?" check karta hai
        commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
        catalogBuiltAt: catalogMeta.builtAt,
        // R43: catalog sheet (Products tab) se live hai to count/source wahi se
        catalog: catalogInfo,
        products: catalogInfo.count || catalogMeta.productCount,
        // orders ka backend (R40): sheet (production) / postgres / json (local dev)
        ordersStore: ordersBackend(),
        db,
        dbError,
        /**
         * R34 — Cloudflare Workers check. Workers par file system read-only hai,
         * isliye durable data **Postgres** me hi jaana chahiye. `storage` =
         * "memory" ka matlab: orders sirf us isolate me hain (preview only).
         */
        runtime: isCloudflareWorkers() ? "cloudflare-workers" : "node",
        storage:
          ordersBackend() === "sheet"
            ? "sheet"
            : ordersBackend() === "postgres"
              ? "postgres"
              : isEphemeralStorage()
                ? "memory"
                : "file",
        durable: ordersBackend() !== "json" || !isEphemeralStorage(),
        time: new Date().toISOString(),
      },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
