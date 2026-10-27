import "server-only";

import { connection } from "next/server";

import type { Catalog, Collection, ColourGroup, ColourOption, Product } from "@liksha/types";
import catalog from "@/data/catalog.json";
import { getLiveCatalog } from "@/lib/catalog-sheet";
import { sheetsConfigured } from "@/lib/google-sheets";

/**
 * Catalog do layer me hai (R43 — owner: "proper sheet se chaljaye db"):
 *
 *  1. **Build-time base** (`@/data/catalog.json`) — seed + fallback. Sheet
 *     configured nahi (dev/tests), GitHub Pages ka static export, ya sheet
 *     down — tab site isi par chalti hai (kabhi tootti nahi).
 *  2. **Live sheet overlay** — Products tab (`?action=catalog`, 30s TTL +
 *     stale-while-revalidate). Owner sheet me price/image/title badle, row
 *     add/delete kare → site par live. `mergeSheetCatalog` (catalog-merge.ts)
 *     overlay karti hai; fetch/cache `catalog-sheet.ts` me.
 *
 * Render paths sab **live** padhte hain (async getters neeche). Sync exports
 * (`products`, `collections`) sirf build-time kaam ke liye hain — sitemap aur
 * `generateStaticParams` (static export me poora catalog prerender hota hai).
 */
const data = catalog as unknown as Catalog;

/** Build-time products — SIRF sitemap/generateStaticParams (render ke liye async getters use karein). */
export const products: Product[] = data.products;
/** Build-time collections — SIRF sitemap/generateStaticParams. */
export const collections: Collection[] = data.collections;
export const catalogMeta = data.meta;
export const colourGroups: Record<string, ColourGroup> = data.colourGroups ?? {};

/**
 * Runtime catalog — sheet live ho to merged (sheet jeetti hai), warna baked.
 * `connection()` Vercel build ke prerender me route ko dynamic rakhta hai
 * (warna price sheet me badli aur static HTML purani dikhati). Static export
 * (PAGES_PREVIEW) me connection() skip — wahan poora site baked se banta hai.
 */
async function liveData(): Promise<Catalog> {
  if (process.env.PAGES_PREVIEW === "1") return data;
  if (!sheetsConfigured()) return data;
  try {
    if (typeof connection === "function") await connection();
  } catch {
    // workerd/build environment — dynamism ka faisla Next khud karega
  }
  try {
    return (await getLiveCatalog()) ?? data;
  } catch {
    return data;
  }
}

/**
 * Ek hi design ke alag colours store par alag products hain — listing par sirf
 * representative card dikhta hai (duplicate cards nahi), PDP par swatch se colour badalta hai.
 */
export function isRepresentative(product: Product, groups: Record<string, ColourGroup> = colourGroups): boolean {
  const group = product.colourGroup ? groups[product.colourGroup] : null;
  return !group || group.handle === product.handle;
}

export function listed<T extends Product>(list: T[], groups: Record<string, ColourGroup> = colourGroups): T[] {
  return list.filter((product) => isRepresentative(product, groups));
}

export function colourGroupFor(product: Product, groups: Record<string, ColourGroup> = colourGroups): ColourGroup | null {
  return product.colourGroup ? (groups[product.colourGroup] ?? null) : null;
}

/** PDP ke swatches: is product ka colour pehle, phir baaki (live prices ke saath). */
export async function colourOptionsFor(product: Product): Promise<ColourOption[]> {
  const live = await liveData();
  const group = colourGroupFor(product, live.colourGroups ?? {});
  if (!group) return [];
  const own = group.colours.find((option) => option.handle === product.handle);
  return own ? [own, ...group.colours.filter((option) => option.handle !== product.handle)] : group.colours;
}

/** listed products — colour groups ka sirf ek card */
export async function getProducts(): Promise<Product[]> {
  const live = await liveData();
  return listed(live.products, live.colourGroups ?? {});
}

/** Poora catalog (colour-group duplicates ke saath) — best-sellers jaise lookups ke liye. */
export async function allProducts(): Promise<Product[]> {
  const live = await liveData();
  return live.products;
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  const live = await liveData();
  const wanted = handle.trim().toLowerCase();
  return (
    live.products.find((product) => product.handle === wanted) ??
    live.products.find((product) => product.handle.toLowerCase() === wanted)
  );
}

export async function getCollections(): Promise<Collection[]> {
  const live = await liveData();
  return [...live.collections].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Purane/short URLs jo live store par circulate ho chuke — clean handle par
 * resolve hote hain. Route dono par khulta hai, canonical sirf clean handle.
 */
export const COLLECTION_ALIASES: Record<string, string> = {
  "wedding-collection": "weddin-collection",
};

export function resolveCollectionHandle(handle: string): string {
  return COLLECTION_ALIASES[handle] ?? handle;
}

/**
 * Catalog me purana typo handle (`weddin-collection`) hai kyunki live store ne
 * wahi use kiya. Public/canonical URL clean spelling par rehta hai, taaki
 * Google ko ek hi page na do baar mile (duplicate content nahi).
 */
export const COLLECTION_CANONICAL: Record<string, string> = {
  "weddin-collection": "wedding-collection",
};

/** Canonical (clean) handle — dono spellings par page khulta hai, canonical ek. */
export function canonicalCollectionHandle(handle: string): string {
  return COLLECTION_CANONICAL[handle] ?? handle;
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  const canonical = resolveCollectionHandle(handle);
  const live = await liveData();
  return live.collections.find((collection) => collection.handle === canonical);
}

export async function getProductsByCollection(handle: string, limit?: number): Promise<Product[]> {
  const canonical = resolveCollectionHandle(handle);
  const live = await liveData();
  const list = listed(
    live.products.filter((product) => product.collections.includes(canonical)),
    live.colourGroups ?? {},
  );
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export async function getFeatured(limit = 8): Promise<Product[]> {
  const live = await liveData();
  return listed(live.products, live.colourGroups ?? {}).filter((product) => product.featured).slice(0, limit);
}

export async function getLatest(limit = 12): Promise<Product[]> {
  const live = await liveData();
  return listed(live.products, live.colourGroups ?? {}).slice(0, limit);
}

export async function getRelated(handle: string, limit = 8): Promise<Product[]> {
  const live = await liveData();
  const all = listed(live.products, live.colourGroups ?? {});
  const current = live.products.find((product) => product.handle === handle);
  if (!current) return all.slice(0, limit);
  const sameCategory = all.filter(
    (product) => product.handle !== handle && product.category === current.category,
  );
  const sameColor = sameCategory.filter((product) => product.color === current.color);
  return [...sameColor, ...sameCategory.filter((p) => !sameColor.includes(p))].slice(0, limit);
}

/**
 * R43 (owner): "product ki id se product ko search kar sake" — handle/Id ab
 * search haystack me hai (exact-id match sabse pehle aata hai).
 */
export async function searchProducts(term: string, limit = 8) {
  const query = term.trim().toLowerCase();
  if (query.length < 2) return [];
  const live = await liveData();
  const matches = listed(live.products, live.colourGroups ?? {}).filter((product) => {
    const haystack =
      `${product.handle} ${product.title} ${product.color} ${product.fabric} ${product.category} ${product.productType ?? ""}`.toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
  });
  const exactId = query.replace(/\s+/g, "");
  matches.sort((a, b) => {
    const aId = a.handle.replace(/-/g, "") === exactId ? 0 : 1;
    const bId = b.handle.replace(/-/g, "") === exactId ? 0 : 1;
    return aId - bId;
  });
  return matches.slice(0, limit).map((product) => ({
    handle: product.handle,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: product.images,
    color: product.color,
    fabric: product.fabric,
  }));
}

/** Search box ke "search suggestions" — curated phrases + live catalog se colours/categories. */
const CURATED_SEARCH_PHRASES = [
  "anarkali suit set",
  "designer anarkali",
  "wedding anarkali",
  "georgette anarkali",
  "silk anarkali",
  "printed suit set",
  "lehenga choli",
  "party wear gown",
  "sharara suit set",
  "saree",
  "sale",
];

let suggestionCache: { key: Product[]; phrases: string[] } | null = null;

function allSearchPhrases(all: Product[], collectionList: Collection[]): string[] {
  if (suggestionCache && suggestionCache.key === all) return suggestionCache.phrases;
  const colours = new Set<string>();
  const fabrics = new Set<string>();
  const categories = new Set<string>();
  for (const product of all) {
    if (product.color && product.color !== "As Shown") colours.add(product.color.toLowerCase());
    if (product.fabric && product.fabric !== "As Shown") fabrics.add(product.fabric.toLowerCase());
    if (product.category) categories.add(product.category.replace(/-/g, " "));
  }
  const collectionTitles = collectionList
    .filter((collection) => collection.handle !== "saree")
    .map((collection) => collection.title.toLowerCase());
  const phrases = Array.from(
    new Set([
      ...CURATED_SEARCH_PHRASES,
      ...collectionTitles,
      ...Array.from(colours).map((colour) => `${colour} anarkali`),
      ...Array.from(fabrics).map((fabric) => `${fabric} suit set`),
      ...Array.from(categories),
    ]),
  );
  suggestionCache = { key: all, phrases };
  return phrases;
}

/** Typeahead terms — "ana" par "anarkali suit set", "anarkali suit set georgette" etc. */
export async function searchSuggestions(term: string, limit = 6): Promise<string[]> {
  const query = term.trim().toLowerCase();
  if (query.length < 2) return [];
  const live = await liveData();
  const words = query.split(/\s+/).filter(Boolean);
  return allSearchPhrases(live.products, live.collections)
    .filter((phrase) => words.every((word) => phrase.includes(word)))
    .filter((phrase) => phrase !== query)
    .sort((a, b) => a.length - b.length)
    .slice(0, limit);
}

/** Search page ke liye "recommended" picks — trending pehle, phir Liksha's choice. */
export async function recommendedProducts(limit = 8): Promise<Product[]> {
  const live = await liveData();
  const all = listed(live.products, live.colourGroups ?? {});
  const trending = all.filter((product) => product.collections.includes("trending"));
  const picks = all.filter((product) => product.collections.includes("likshas-choice"));
  const newest = [...all].sort((a, b) =>
    String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")),
  );
  const merged: Product[] = [];
  for (const product of [...trending, ...picks, ...newest]) {
    if (merged.length >= limit) break;
    if (!merged.some((item) => item.handle === product.handle)) merged.push(product);
  }
  return merged;
}

export const SORT_KEYS = ["featured", "price-low", "price-high", "discount", "new", "title-asc"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value) && (SORT_KEYS as readonly string[]).includes(value as string);
}

export function sortProducts(list: Product[], key: SortKey = "featured"): Product[] {
  const copy = [...list];
  switch (key) {
    case "price-low":
      return copy.sort((a, b) => a.price - b.price);
    case "price-high":
      return copy.sort((a, b) => b.price - a.price);
    case "discount":
      return copy.sort(
        (a, b) =>
          (b.compareAtPrice ?? b.price) - b.price - ((a.compareAtPrice ?? a.price) - a.price),
      );
    case "new":
      return copy;
    case "title-asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return getRelated(product.handle, limit);
}
