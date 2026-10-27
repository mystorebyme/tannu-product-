import "server-only";

import type { Catalog, Product } from "@liksha/types";

import bakedCatalog from "@/data/catalog.json";

import { runInBackground } from "./background";
import { mergeSheetCatalog, slugifyHandle, type SheetProductRow } from "./catalog-merge";
import { SHEET_READ_TIMEOUT, googleSheetsConfig, scriptGet, scriptPost } from "./google-sheets";

/**
 * R43 (owner): **Products tab = catalog ka database.**
 *
 *   • READ  — `?action=catalog` se sheet ki product rows (30s TTL + stale-while-
 *             revalidate + last-good fallback). `mergeSheetCatalog` build-time
 *             catalog par overlay karti hai: price/image/title badla → site par
 *             live; row delete → product gaya; nayi row → naya product.
 *   • SEED  — Products tab khaali mile (owner ne r43-1 abhi paste kiya) to site
 *             apna pura catalog (446 products) ek hi baar sheet me bhar deti hai
 *             (`products_seed`, 10-min rate limit). Script sirf khaali tab par
 *             likhta hai — owner ka data kabhi override nahi hota.
 *   • FALLBACK — sheet down/slow/purana script → build-time catalog chalta rehta
 *             hai (compat; customer ko kabhi error nahi dikhta).
 *
 * Workers (vinext) par module cache isolate ke saath marta hai — isliye last
 * good rows Cloudflare Cache API me bhi (settings loader wala proven pattern).
 */

const CATALOG_TTL_MS = envNumber("SHEET_CATALOG_TTL_MS", 30_000);
const CATALOG_STALE_MAX_MS = envNumber("SHEET_CATALOG_STALE_MS", 6 * 60 * 60_000);
/** Seed (446 rows) me script ko 2 minute tak ka waqt do. */
const SEED_TIMEOUT_MS = 120_000;
/** Products tab seed site tabhi maangti hai jab script r43+ ho (catalog action wala). */
export const SHEET_CATALOG_MIN_MAJOR = 43;

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
}

type CatalogCache = {
  /** last good sheet rows (null = kabhi nahi mili) */
  rows: SheetProductRow[] | null;
  /** rows se bana merged catalog (identity same rows par reuse) */
  merged: Catalog | null;
  at: number;
  failedAt: number;
  ms: number;
  count: number;
  error: string | null;
};

let cache: CatalogCache | null = null;
let inflight: Promise<SheetProductRow[] | null> | null = null;
let lastBackgroundAt = 0;
let lastSeedAt = 0;
let seedInflight = false;

const base = bakedCatalog as unknown as Catalog;

/* ───────────────────────── edge cache (Cloudflare Workers) ───────────────────────── */

const EDGE_CACHE_KEY = "https://sheet-catalog.liksha.internal/product-rows.json";

function edgeCache(): Cache | null {
  try {
    const api = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
    return api && typeof api.default?.match === "function" ? api.default : null;
  } catch {
    return null;
  }
}

async function edgeRead(): Promise<{ rows: SheetProductRow[]; at: number } | null> {
  const store = edgeCache();
  if (!store) return null;
  try {
    const response = await store.match(EDGE_CACHE_KEY, { ignoreMethod: true });
    if (!response) return null;
    const payload = (await response.json()) as { rows?: SheetProductRow[]; at?: number };
    if (!Array.isArray(payload?.rows) || typeof payload?.at !== "number") return null;
    if (Date.now() - payload.at > CATALOG_STALE_MAX_MS) return null;
    return { rows: payload.rows, at: payload.at };
  } catch {
    return null;
  }
}

function edgeWrite(rows: SheetProductRow[]) {
  const store = edgeCache();
  if (!store) return;
  void (async () => {
    try {
      await store.put(
        EDGE_CACHE_KEY,
        new Response(JSON.stringify({ rows, at: Date.now() }), {
          headers: {
            "content-type": "application/json",
            "cache-control": `public, s-maxage=${Math.round(CATALOG_STALE_MAX_MS / 1000)}`,
          },
        }),
      );
    } catch {
      /* local workerd / dev par Cache API likhne nahi deti — ignore */
    }
  })();
}

/* ───────────────────────── diagnostics ───────────────────────── */

export type CatalogSheetInfo = {
  configured: boolean;
  /** "sheet" = Products tab se live, "baked" = build-time catalog fallback */
  source: "sheet" | "baked";
  count: number;
  ageMs: number | null;
  stale: boolean;
  lastReadMs: number;
  lastError: string | null;
  ttlMs: number;
};

/** /api/sheet-health + admin: catalog abhi kahan se aa raha hai. */
export function catalogSheetInfo(): CatalogSheetInfo {
  const now = Date.now();
  const ageMs = cache?.rows ? now - cache.at : null;
  return {
    configured: Boolean(googleSheetsConfig()),
    source: cache?.rows ? "sheet" : "baked",
    count: cache?.rows ? cache.count : base.products.length,
    ageMs,
    stale: ageMs === null ? true : ageMs >= CATALOG_TTL_MS,
    lastReadMs: cache?.ms ?? 0,
    lastError: cache?.error ?? null,
    ttlMs: CATALOG_TTL_MS,
  };
}

/* ───────────────────────── read path ───────────────────────── */

/**
 * Sheet ki product rows (TTL + SWR + last-good). `null` = sheet configured
 * nahi / kabhi read nahi hui — caller build-time catalog par chala jaata hai.
 */
export async function readSheetCatalogRows(options: { fresh?: boolean } = {}): Promise<SheetProductRow[] | null> {
  if (!cache) {
    const edge = await edgeRead();
    if (edge) cache = { rows: edge.rows, merged: null, at: edge.at, failedAt: 0, ms: 0, count: edge.rows.length, error: null };
  }
  const now = Date.now();
  if (!options.fresh && cache) {
    if (cache.rows && now - cache.at < CATALOG_TTL_MS) return cache.rows;
    // haal hi me fail hua → TTL tak dobara network nahi (har page 8s na atke)
    if (cache.failedAt && now - cache.failedAt < CATALOG_TTL_MS) return cache.rows;
    if (cache.rows && now - cache.at < CATALOG_STALE_MAX_MS) {
      revalidateCatalogInBackground();
      return cache.rows;
    }
  }
  if (!googleSheetsConfig()) return cache?.rows ?? null;
  return readCatalogNow();
}

function revalidateCatalogInBackground() {
  const now = Date.now();
  if (inflight || now - lastBackgroundAt < 1_000) return;
  lastBackgroundAt = now;
  runInBackground(() => readCatalogNow().catch(() => undefined));
}

function readCatalogNow(): Promise<SheetProductRow[] | null> {
  if (inflight) return inflight;
  const run = fetchCatalogRows().finally(() => {
    inflight = null;
  });
  inflight = run;
  return run;
}

async function fetchCatalogRows(): Promise<SheetProductRow[] | null> {
  const startedAt = Date.now();
  const result = await scriptGet<{ products?: SheetProductRow[]; version?: string }>(
    "catalog",
    {},
    { timeoutMs: SHEET_READ_TIMEOUT * 2 },
  );
  if (!result.ok) {
    const previous = cache?.rows ?? null;
    cache = {
      rows: previous,
      merged: cache?.merged ?? null,
      at: previous ? (cache?.at ?? 0) : 0,
      failedAt: Date.now(),
      ms: Date.now() - startedAt,
      count: previous?.length ?? 0,
      error: result.error,
    };
    console.warn(`[catalog] sheet read failed (${Date.now() - startedAt}ms): ${result.error}`);
    return previous;
  }
  const rows = Array.isArray(result.data.products) ? result.data.products : [];
  if (!rows.length) {
    // Tab khaali — owner ne r43-1 paste kiya par catalog abhi sheet me nahi.
    // Site apna catalog khud seed kar deti hai (ek baar, background me).
    const major = Number(/^r(\d+)/.exec(String(result.data.version ?? ""))?.[1] ?? 0);
    maybeSeedCatalog(major);
    const previous = cache?.rows ?? null;
    cache = {
      rows: previous,
      merged: cache?.merged ?? null,
      at: previous ? (cache?.at ?? 0) : 0,
      failedAt: Date.now(),
      ms: Date.now() - startedAt,
      count: previous?.length ?? 0,
      error: previous ? null : "Products tab khaali — seed ho raha hai",
    };
    return previous;
  }
  cache = { rows, merged: null, at: Date.now(), failedAt: 0, ms: Date.now() - startedAt, count: rows.length, error: null };
  edgeWrite(rows);
  return rows;
}

/** Merged live catalog — sheet rows + build-time base. null = fallback chalu. */
export async function getLiveCatalog(options: { fresh?: boolean } = {}): Promise<Catalog | null> {
  const rows = await readSheetCatalogRows(options);
  if (!rows || !rows.length) return null;
  if (cache && cache.rows === rows && cache.merged) return cache.merged;
  const merged = mergeSheetCatalog(base, rows);
  if (cache && cache.rows === rows) cache.merged = merged;
  return merged;
}

/* ───────────────────────── seed path ───────────────────────── */

/** Products tab khaali + script r43+ → build-time catalog sheet me bhar do. */
function maybeSeedCatalog(scriptMajor: number) {
  if (scriptMajor < SHEET_CATALOG_MIN_MAJOR) return; // purana script — products_seed action hi nahi
  const now = Date.now();
  if (seedInflight || now - lastSeedAt < 10 * 60_000) return;
  lastSeedAt = now;
  seedInflight = true;
  runInBackground(() =>
    seedCatalogToSheet()
      .catch((error: Error) => console.warn(`[catalog] seed failed: ${error.message}`))
      .finally(() => {
        seedInflight = false;
      }),
  );
}

/** Build-time catalog ka ek product → Products tab ki row (owner-friendly format). */
export function catalogSeedRows(products: Product[] = base.products): SheetProductRow[] {
  const rupees = (paise: number) => {
    const value = Math.round(paise) / 100;
    return Number.isInteger(value) ? value : Number(value.toFixed(2));
  };
  return products.map((product) => ({
    Timestamp: product.publishedAt ?? base.meta.builtAt,
    Id: product.handle,
    Title: product.title,
    Price: rupees(product.price),
    "Compare-at price": product.compareAtPrice ? rupees(product.compareAtPrice) : "",
    "Main image": product.images[0] ?? "",
    Images: product.images.slice(1).join("|"),
    Collections: product.collections.join("|"),
    Category: product.category ?? "other",
    Fabric: product.fabric ?? "",
    Colour: product.color ?? "",
    Sizes: product.sizes.join("|"),
    "In stock": product.inStock ? "yes" : "no",
    Featured: product.featured ? "yes" : "no",
    // R44: hidden test product sheet me bhi hidden hi seed ho (visitors ko na dikhe)
    Status: product.hidden ? "hidden" : "active",
    // cell limit (script 20k par truncate karta hai) se pehle khud chhota kar lo
    Description: (product.description ?? "").slice(0, 8_000),
    Source: "site",
    "Updated by": "site-seed",
  }));
}

/** Ek hi POST me pura catalog (script sirf khaali tab par likhta hai). */
export async function seedCatalogToSheet(): Promise<boolean> {
  const config = googleSheetsConfig();
  if (!config) return false;
  const rows = catalogSeedRows();
  if (!rows.length) return false;
  console.info(`[catalog] Products tab khaali — ${rows.length} products seed ho rahe hain…`);
  const result = await scriptPost<{ seeded?: number; skipped?: boolean }>(
    "products_seed",
    { products: rows, actor: "site-auto" },
    { timeoutMs: SEED_TIMEOUT_MS },
  );
  if (result.ok) {
    console.info(`[catalog] seed ok (${result.data.seeded ?? 0} rows${result.data.skipped ? ", skipped" : ""})`);
    return true;
  }
  console.warn(`[catalog] seed failed: ${result.error}`);
  return false;
}

/** Admin "refresh" jaisa reset — cache hatao, agli read sheet se fresh aayegi. */
export function invalidateSheetCatalog() {
  cache = null;
}

/** Id (handle) sheet me slug ban jaata hai — search/routing ke liye normalizer. */
export { slugifyHandle };
