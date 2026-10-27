import type { Catalog, ColourGroup, Product, ProductCategory } from "@liksha/types";

/**
 * R43 (owner): **"jitne bi product hai vo saare sheet me list kr do … sheet se
 * product delete ho jaye, main image change ho jaye, price change ho jaye …
 * price change krte hi site par visible ho jaye … product ki id se search kar
 * sake, koi bhi naya product add kar paye"** — Products tab = catalog ka DB.
 *
 * Ye file **pure** hai (koi network/server-only nahi) — sheet ki rows ko
 * build-time catalog par overlay karti hai:
 *   • row ka Id (handle) catalog me hai → price/image/title/sizes/… override
 *   • Id naya hai → naya product ban jaata hai (site par turant dikhta hai)
 *   • Id sheet me nahi (row delete) → product site se hat jaata hai
 *   • Status = hidden → product listings/page se chhupta hai
 *   • sheet khaali (ya script purana) → build-time catalog as-is (compat —
 *     site kabhi nahi tootti)
 *
 * Fetch + cache `catalog-sheet.ts` me hai.
 */

export type SheetProductRow = Record<string, string | number>;

const CATEGORIES: ProductCategory[] = ["anarkali", "lehnga", "printed", "saree", "gown", "sharara", "other"];

/** Sheet ka Id/Title → URL-safe handle (site ke baaki handles jaisa). */
export function slugifyHandle(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

/**
 * Sheet ki price → paise. Owner rupees me likhta hai: "599", "₹ 1,599",
 * "1599.50" sab chalta hai. Galat/khaali → null (override skip).
 */
export function rupeesToPaiseOrNull(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

/** "a|b|c" (ya newline/comma) → list. Images/Sizes/Collections isi se parse hote hain. */
export function splitList(value: unknown): string[] {
  return String(value ?? "")
    .split(/[|\n;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** yes/no dropdown → boolean (khaali = fallback). */
export function yesNo(value: unknown, fallback: boolean): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (/^(yes|y|true|1|haan|han|available|in)$/.test(text)) return true;
  if (/^(no|n|false|0|nahi|out)$/.test(text)) return false;
  return fallback;
}

function hiddenRow(row: SheetProductRow): boolean {
  return /^hidden|^hide|^no$|^draft/i.test(String(row.Status ?? "").trim().toLowerCase());
}

function firstUrl(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function descriptionHtmlFrom(text: string): string | undefined {
  const paragraphs = text
    .split(/\n{1,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!paragraphs.length) return undefined;
  const escape = (part: string) =>
    part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return paragraphs.map((part) => `<p>${escape(part)}</p>`).join("");
}

/**
 * Ek sheet row → Product. `base` = build-time catalog ka product (override);
 * base na ho to row se naya product banta hai (title+price zaroori, warna null).
 */
export function productFromSheetRow(row: SheetProductRow, base?: Product): Product | null {
  const idRaw = String(row.Id ?? row.Handle ?? "").trim();
  const id = slugifyHandle(idRaw) || (base ? slugifyHandle(base.handle) : "");
  if (!id) return null;

  const title = String(row.Title ?? "").trim();
  const price = rupeesToPaiseOrNull(row.Price ?? row["Price (₹)"]);
  const compareAtRaw = String(row["Compare-at price"] ?? "").trim();
  const compareAt = compareAtRaw ? rupeesToPaiseOrNull(compareAtRaw) : null;

  if (!base) {
    // Naya product — title aur price ke bina kuch nahi ban sakta
    if (!title || price === null) return null;
  }

  const start: Product =
    base ??
    ({
      handle: id,
      sourceHandle: id,
      title: title || id.replace(/-/g, " "),
      price: price ?? 0,
      compareAtPrice: null,
      images: [],
      collections: [],
      category: "other",
      fabric: "",
      color: "",
      sizes: ["Free Size"],
      details: [],
      description: "",
      rating: 0,
      reviewCount: 0,
      inStock: true,
      featured: false,
      publishedAt: null,
    } as Product);

  const product: Product = { ...start, handle: base ? base.handle : id };

  if (title) product.title = title;
  if (price !== null) product.price = price;
  if (compareAtRaw) product.compareAtPrice = compareAt;

  // Main image = pehli image; Images column = baaki gallery (| separated).
  // Owner ne Main image badli → purani main hat-ti hai (baaki gallery rehti hai).
  const mainImage = firstUrl(row["Main image"]);
  const extraImages = splitList(row.Images).filter((url) => /^https?:\/\//i.test(url));
  if (mainImage || extraImages.length) {
    const rest = extraImages.length
      ? extraImages
      : mainImage && base && base.images[0] !== mainImage
        ? base.images.slice(1) // nayi main ke saath purani main gayi, gallery rakhi
        : (base?.images ?? []).filter((url) => url !== mainImage);
    const images = mainImage ? [mainImage, ...rest.filter((url) => url !== mainImage)] : rest;
    product.images = images.length ? images : (base?.images ?? []);
  }

  const collections = splitList(row.Collections).map((handle) => slugifyHandle(handle)).filter(Boolean);
  if (collections.length) product.collections = collections;

  const category = slugifyHandle(row.Category);
  if (category && CATEGORIES.includes(category as ProductCategory)) {
    product.category = category as ProductCategory;
  }
  const fabric = String(row.Fabric ?? "").trim();
  if (fabric) product.fabric = fabric;
  const colour = String(row.Colour ?? row.Color ?? "").trim();
  if (colour) {
    product.color = colour;
    product.colourName = colour;
  }

  // Sizes badle → sizePricing dobara: purani availability rakho, nayi size = available,
  // sheet ki price har size par laagu (owner ek hi price likhta hai).
  const sizes = splitList(row.Sizes);
  if (sizes.length) product.sizes = sizes;
  if (sizes.length || price !== null || compareAtRaw) {
    const pricing: Product["sizePricing"] = {};
    for (const size of product.sizes) {
      const old = start.sizePricing?.[size];
      pricing[size] = {
        price: price ?? old?.price ?? product.price,
        compareAtPrice: compareAtRaw ? compareAt : (old?.compareAtPrice ?? product.compareAtPrice),
        available: old ? old.available !== false : true,
      };
    }
    product.sizePricing = pricing;
  }

  product.inStock = yesNo(row["In stock"], base ? base.inStock : true);
  product.featured = yesNo(row.Featured, base ? base.featured : false);

  const description = String(row.Description ?? "").trim();
  if (description) {
    product.description = description;
    product.descriptionHtml = descriptionHtmlFrom(description) ?? product.descriptionHtml;
  }
  if (!product.description) product.description = product.title;

  const published = String(row.Timestamp ?? "").trim();
  if (!base && published) product.publishedAt = toIsoOrNull(published) ?? product.publishedAt;

  return product;
}

function toIsoOrNull(value: string): string | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/**
 * Build-time catalog + sheet rows → live catalog (**sheet jeetti hai**).
 * Rows khaali → catalog as-is (compat: purana script / sheet down / dev).
 */
export function mergeSheetCatalog(base: Catalog, rows: SheetProductRow[] | null | undefined): Catalog {
  if (!rows || !rows.length) return base;

  const byHandle = new Map(base.products.map((product) => [product.handle, product]));
  const seen = new Set<string>();
  const fresh: Product[] = [];
  const merged: Product[] = [];

  for (const row of rows) {
    const id = slugifyHandle(String(row?.Id ?? row?.Handle ?? ""));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (hiddenRow(row)) continue; // owner ne hide kiya → site par nahi
    const existing = byHandle.get(id);
    const product = productFromSheetRow(row, existing);
    if (!product) continue;
    if (existing) merged.push(product);
    else fresh.push(product);
  }

  // Sheet me jo base-products nahi mile (owner ne row delete ki) → site se gaye.
  // Naye products sabse upar (New Arrivals/latest rails me turant dikhein).
  const products = [...fresh, ...merged];
  if (!products.length) return base; // sheet me sirf hidden/galat rows — site khaali na ho

  // Colour groups saaf: gayab handles ke swatch na dikhein; sheet se price/image
  // badla hai to swatch ka data bhi wahi dikhe (PDP colour-switch stale na lage).
  const alive = new Set(products.map((product) => product.handle));
  const byHandleNow = new Map(products.map((product) => [product.handle, product]));
  const colourGroups: Record<string, ColourGroup> = {};
  for (const [key, group] of Object.entries(base.colourGroups ?? {})) {
    const colours = (group.colours ?? [])
      .filter((option) => alive.has(option.handle))
      .map((option) => {
        const product = byHandleNow.get(option.handle);
        if (!product) return option;
        return {
          ...option,
          title: product.title,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          image: product.images[0] ?? option.image,
          images: product.images.length ? product.images : option.images,
        };
      });
    if (!colours.length) continue;
    const handle = alive.has(group.handle) ? group.handle : colours[0]!.handle;
    colourGroups[key] = { ...group, handle, colours };
  }
  for (const product of products) {
    if (product.colourGroup && !colourGroups[product.colourGroup]) product.colourGroup = null;
  }

  const collections = base.collections.map((collection) => ({
    ...collection,
    productCount: products.filter((product) => product.collections.includes(collection.handle)).length,
  }));

  return {
    ...base,
    meta: { ...base.meta, productCount: products.length },
    collections,
    colourGroups,
    products,
  };
}
