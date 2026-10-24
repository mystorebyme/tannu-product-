#!/usr/bin/env node
/**
 * build-catalog.mjs
 * ----------------------------------------------------------------
 * Single source of truth banao: database/seeds/catalog.json
 *
 * Inputs:
 *   - clone-liksha-clothing-website/src/lib/catalog.ts  (scraped product metadata: title, price, sizes, details)
 *   - scripts/data/image-map.tsv                        (handle -> real Shopify CDN image path, sitemap se)
 *
 * Outputs:
 *   - database/seeds/catalog.json                       (canonical)
 *   - apps/web/src/data/catalog.json                    (web copy, runtime read)
 *   - apps/admin/src/data/catalog.json                  (admin copy)
 *
 * Run: npm run catalog:build
 * Rule: app ke andar data edit mat karo, yahan edit karke script chalao.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeSizes } from "./lib/sizes.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CDN = "https://cdn.shopify.com/s/files/1/0738/8345/1696/";
const SOURCE = "https://www.likshaclothing.com";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, data) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p), data);
};

/** base metadata: clone catalog.ts se array nikalo (safe eval, sirf literal) */
function loadBase() {
  const src = read("clone-liksha-clothing-website/src/lib/catalog.ts");
  const start = src.indexOf("export const catalog");
  const startBracket = src.indexOf("[", start);
  const end = src.lastIndexOf("];");
  const literal = src.slice(startBracket, end + 1);
  // eslint-disable-next-line no-new-func
  const parsed = new Function(`return ${literal};`)();
  const collectionsStart = src.indexOf("export const collections");
  const cStart = src.indexOf("[", collectionsStart);
  const cEnd = src.indexOf("];", cStart);
  const collectionLiteral = src.slice(cStart, cEnd + 1);
  const collections = new Function(`return ${collectionLiteral};`)();
  return { products: parsed, collections };
}

function loadMembership() {
  const file = path.join(ROOT, "scripts/data/collection-membership.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8")).collections ?? {};
}

function loadImageMap() {
  const map = new Map();
  for (const line of read("scripts/data/image-map.tsv").trim().split("\n")) {
    const [handle, imagePath] = line.trim().split("|");
    if (!handle || !imagePath) continue;
    map.set(decodeURIComponent(handle), CDN + imagePath);
  }
  return map;
}

/** Shopify handles me emoji bhi aa jaate hain — URL ke liye ASCII slug, original record rakhte hain */
function asciiHandle(handle) {
  return String(handle)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function slugColor(title, fallback) {
  if (fallback && fallback !== "As Shown") return fallback;
  const t = title.toLowerCase();
  const colors = [
    "black", "white", "off white", "ivory", "red", "maroon", "wine", "rani pink", "pink", "blush pink",
    "green", "olive", "pista", "mint", "blue", "sky blue", "navy", "purple", "lavender", "violet",
    "yellow", "mustard", "orange", "peach", "rust", "brown", "grey", "gold", "mehandi", "aqua", "multi",
  ];
  for (const color of colors) if (t.includes(color)) return color.replace(/\b\w/g, (c) => c.toUpperCase());
  return fallback || "As Shown";
}

(function main() {
  const { products: baseProducts, collections: baseCollections } = loadBase();
  const imageMap = loadImageMap();
  const membership = loadMembership();

  const products = [];
  const missing = [];

  for (const p of baseProducts) {
    if (!imageMap.has(p.handle)) {
      missing.push(p.handle);
      continue;
    }
    products.push({
      handle: asciiHandle(p.handle),
      sourceHandle: p.handle,
      title: p.title,
      price: Math.round(p.price),
      compareAtPrice: p.compareAtPrice ? Math.round(p.compareAtPrice) : null,
      images: [imageMap.get(p.handle)],
      collections: p.collections,
      category: p.category,
      fabric: p.fabric,
      color: slugColor(p.title, p.color),
      sizes: normalizeSizes(p.sizes),
      details: p.details,
      description: p.description,
      rating: p.rating,
      reviewCount: p.reviewCount,
      inStock: p.inStock !== false,
      featured: Boolean(p.featured),
    });
  }

  // curated membership (live store se verified) — jahan base scraper chuka ho
  for (const [collectionHandle, handles] of Object.entries(membership)) {
    const known = new Set(products.map((p) => p.handle));
    const unknown = handles.filter((h) => !known.has(h));
    if (unknown.length) {
      console.warn(`membership: ${collectionHandle} me unknown products:`, unknown);
    }
    for (const p of products) {
      if (!handles.includes(p.handle)) continue;
      if (!p.collections.includes(collectionHandle)) p.collections.push(collectionHandle);
    }
  }

  // naye products jo image map me hain lekin base me nahi (future scrape gap) -> warn
  const knownHandles = new Set(baseProducts.map((p) => p.handle));
  const extra = [...imageMap.keys()].filter((h) => !knownHandles.has(h));

  const imageFor = (handleList) => {
    for (const h of handleList) if (imageMap.has(h)) return imageMap.get(h);
    return products[0]?.images[0];
  };

  const collections = baseCollections.map((c) => {
    const overrides = {
      "party-wear-gown": imageFor(["premium-designer-velvet-suit-set-rajwadi"]),
      "new-arrivals": imageFor(["tridha-fendy-silk-blush-pink-anarkali-premium-suit-set"]),
      "likshas-choice": imageFor(["green-bandhej-maslin-anarkali-suit-set-td-141-copy"]),
      "lehnga-choli": imageFor(["pink-lehenga-choli-lc-249"]),
      "printed-suit-set": imageFor(["nikita-digital-printed-anarkali-suit-set"]),
      saree: imageFor(["bandhani-mehandi-color-anarkali-suit-set-td-141"]),
      sale: imageFor(["luxury-mustard-embroidered-georgette-anarkali-suit"]),
      "weddin-collection": imageFor(["shahi-gulzar-heavy-embroidered-lehenga-suit-set"]),
    };
    return { ...c, image: overrides[c.handle] ?? c.image };
  });

  if (!collections.some((c) => c.handle === "trending")) {
    collections.push({
      handle: "trending",
      title: "Trending",
      subtitle: "What everyone is wearing this week",
      image: imageFor(["yellow-trendy-anarkali-suit-set"]),
      sortOrder: collections.length + 1,
    });
  }

  const catalog = {
    meta: {
      store: "Liksha Clothing",
      source: SOURCE,
      cdn: CDN,
      currency: "INR",
      moneyUnit: "paise",
      builtAt: new Date().toISOString(),
      productCount: products.length,
    },
    collections,
    products,
  };

  const json = JSON.stringify(catalog, null, 2);
  write("database/seeds/catalog.json", json);
  write("apps/web/src/data/catalog.json", json);
  write("apps/admin/src/data/catalog.json", json);

  console.log(`catalog built: ${products.length} products, ${collections.length} collections`);
  if (missing.length) console.warn(`no image (skipped ${missing.length}):`, missing.slice(0, 10));
  if (extra.length) console.warn(`image map has ${extra.length} products missing metadata:`, extra.slice(0, 10));
})();
