#!/usr/bin/env node
/**
 * build-catalog.mjs — live store snapshot se canonical catalogue banao.
 *
 * Inputs (repo me committed, GitHub Actions se refresh hote hain):
 *   database/seeds/live/products.json      — Shopify /products.json (288 products, full galleries)
 *   database/seeds/live/collections.json   — Shopify /collections.json
 *   database/seeds/live/membership.json    — har collection ke andar ke product handles (paginated)
 *
 * Outputs:
 *   database/seeds/catalog.json            — canonical
 *   apps/web/src/data/catalog.json         — web runtime copy
 *   apps/admin/src/data/catalog.json       — admin copy
 *
 * Rule: app ke andar data edit mat karo — yahan edit karke `npm run catalog:build` chalao.
 * Snapshot refresh: `node scripts/catalog-sync/fetch-live.mjs` (ya GitHub Actions → Catalog sync).
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeSizes, canonicalSize } from "./lib/sizes.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CDN = "https://cdn.shopify.com/s/files/1/0738/8345/1696/";
const SOURCE = "https://www.likshaclothing.com";
const LIVE = path.join(ROOT, "database/seeds/live");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p, data) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p), data);
};

/** "2999.00" -> 299900 paise. float kabhi nahi. */
function paise(value) {
  if (value === null || value === undefined || value === "") return null;
  const [rupees, fraction = ""] = String(value).split(".");
  const whole = Number(rupees.replace(/[^0-9]/g, "")) || 0;
  const cents = Number(`${fraction}00`.slice(0, 2)) || 0;
  return whole * 100 + cents;
}

/** Shopify handles me emoji bhi hote hain — URL ke liye ASCII slug, original `sourceHandle` me. */
function asciiHandle(handle) {
  return String(handle)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const FABRICS = [
  "vichitra silk", "rangoli silk", "banarasi silk", "fendy silk", "chinon silk", "dola silk",
  "tissue silk", "silk", "georgette", "velvet", "maslin", "muslin", "chanderi", "organza",
  "net", "cotton", "rayon", "crepe", "satin", "jacquard", "seqiun", "sequin", "brocade", "lycra",
];

const COLORS = [
  "off white", "rani pink", "sky blue", "blush pink", "sea green", "baby pink", "rani",
  "black", "white", "ivory", "red", "maroon", "wine", "pink", "green", "olive", "pista", "mint",
  "blue", "navy", "purple", "lavender", "violet", "yellow", "mustard", "orange", "peach", "rust",
  "brown", "grey", "gray", "gold", "mehandi", "aqua", "multi", "nude", "teal", "beige", "cream",
];

const titleCase = (value) => value.replace(/\b\w/g, (c) => c.toUpperCase());

function detectFabric(product) {
  const haystack = `${product.title} ${product.body_html ?? ""} ${(product.tags ?? []).join(" ")}`.toLowerCase();
  for (const fabric of FABRICS) if (haystack.includes(fabric)) return titleCase(fabric);
  return "As Shown";
}

function detectColor(product) {
  const haystack = `${product.title} ${(product.tags ?? []).join(" ")}`.toLowerCase();
  for (const color of COLORS) {
    const pattern = new RegExp(`\\b${color}\\b`);
    if (pattern.test(haystack)) return titleCase(color);
  }
  return "As Shown";
}

function detectCategory(product) {
  // title sabse reliable hai (product_type me aksar "Clothing" hota hai, tags me purani lines)
  const haystack = `${product.title} ${product.product_type ?? ""} ${(product.tags ?? []).join(" ")}`.toLowerCase();
  const title = String(product.title ?? "").toLowerCase();
  const type = String(product.product_type ?? "").toLowerCase();
  const score = (needles) => needles.reduce((n, needle) => n + (title.includes(needle) ? 2 : 0) + (type.includes(needle) ? 2 : 0) + (haystack.includes(needle) ? 1 : 0), 0);
  const candidates = [
    ["saree", ["saree", "sari"]],
    ["lehnga", ["lehenga", "lehnga", "ghagra", "choli"]],
    ["gown", ["gown"]],
    ["sharara", ["sharara", "palazzo", "sharara suit"]],
    ["printed", ["printed", "print"]],
    ["anarkali", ["anarkali"]],
  ];
  const best = candidates
    .map(([name, needles]) => [name, score(needles)])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "other";
}

/**
 * Description: live `body_html` hi asli text hai. Sirf safe tags rakhte hain —
 * script/iframe/style/img/on* attributes hata dete hain (XSS + duplicate gallery images).
 */
function sanitizeHtml(html) {
  if (!html) return "";
  let out = String(html);
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<(script|style|iframe|noscript|form|input|object|embed)[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<(img|source|picture|video)[^>]*>/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\s(href|src)\s*=\s*"(?!https?:|\/)[^"]*"/gi, "");
  const allowed = new Set(["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "span", "h3", "h4", "h5", "div", "table", "tbody", "tr", "td", "th"]);
  out = out.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, tag, attrs) => {
    const name = tag.toLowerCase();
    if (!allowed.has(name)) return "";
    if (match.startsWith("</")) return `</${name}>`;
    const cleanAttrs = /^(span|div)$/.test(name) ? "" : "";
    return `<${name}${cleanAttrs}>`;
  });
  return out.trim();
}

function htmlToLines(html) {
  if (!html) return [];
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[3-5])>/gi, "\n");
  const text = withBreaks
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 1);
}

/** primary image per size — variant.featured_image se (warna pehli image) */
function variantImage(variant, images) {
  const src = variant.featured_image?.src;
  if (src) return src.split("?")[0];
  return images[0] ?? null;
}

(function main() {
  const liveProducts = readJson(path.join(LIVE, "products.json")).products;
  const liveCollections = readJson(path.join(LIVE, "collections.json")).collections;
  const membership = readJson(path.join(LIVE, "membership.json")).collections;

  // handle -> collections (live membership hi source of truth)
  const collectionOf = new Map();
  for (const [collectionHandle, handles] of Object.entries(membership)) {
    for (const handle of handles) {
      if (!collectionOf.has(handle)) collectionOf.set(handle, new Set());
      collectionOf.get(handle).add(collectionHandle);
    }
  }

  const usedHandles = new Set();
  const products = [];
  const stats = { images: 0, sizes: new Set(), noImage: [] };

  for (const source of liveProducts) {
    if (!source.handle || !source.title) continue;
    const images = (source.images ?? []).map((image) => image.src.split("?")[0]).filter(Boolean);
    const liveCollectionsForProduct = collectionOf.get(source.handle) ?? new Set();
    // COD/partial-payment jaisi internal "products" storefront par nahi jaati
    if (!images.length && liveCollectionsForProduct.size === 0) continue;
    if (!images.length) stats.noImage.push(source.handle);

    const variants = (source.variants ?? []).map((variant) => ({
      size: canonicalSize(variant.option1 || variant.title) ?? "Free Size",
      sku: variant.sku ?? null,
      price: paise(variant.price) ?? 0,
      compareAtPrice: paise(variant.compare_at_price),
      available: Boolean(variant.available),
      image: variantImage(variant, images),
    }));

    const prices = variants.map((v) => v.price).filter((n) => n > 0);
    const price = prices.length ? Math.min(...prices) : 0;
    const compareAts = variants.map((v) => v.compareAtPrice).filter((n) => n && n > price);
    const compareAtPrice = compareAts.length ? Math.max(...compareAts) : null;

    // per-size map: same size ke duplicate variants (colour options) me sabse kam price jeetta hai
    const bySize = new Map();
    for (const variant of variants) {
      const existing = bySize.get(variant.size);
      if (!existing || variant.price < existing.price) bySize.set(variant.size, variant);
    }

    const sizes = normalizeSizes([...bySize.keys()]);
    for (const size of sizes) stats.sizes.add(size);

    let handle = asciiHandle(source.handle) || `product-${source.id}`;
    if (usedHandles.has(handle)) handle = `${handle}-${source.id}`;
    usedHandles.add(handle);

    const descriptionHtml = sanitizeHtml(source.body_html) || `<p>${source.title.trim()}</p>`;
    const details = htmlToLines(descriptionHtml).slice(0, 14);
    // `frontpage` live store ka home-page grouping hai (nav collection nahi) — featured flag me jaata hai
    const collections = [...liveCollectionsForProduct].filter((handle) => handle !== "frontpage").sort();

    products.push({
      handle,
      sourceHandle: source.handle,
      title: source.title.trim(),
      price,
      compareAtPrice,
      images,
      collections,
      category: detectCategory(source),
      productType: source.product_type || null,
      fabric: detectFabric(source),
      color: detectColor(source),
      sizes,
      sizePricing: Object.fromEntries(
        [...bySize.entries()].map(([size, variant]) => [
          size,
          { price: variant.price, compareAtPrice: variant.compareAtPrice, available: variant.available },
        ]),
      ),
      details,
      description: (details.join(" ").trim() || source.title.trim()).slice(0, 400),
      descriptionHtml,
      rating: 0,
      reviewCount: 0,
      inStock: variants.some((variant) => variant.available) || variants.length === 0,
      featured: collections.includes("frontpage") || collections.includes("trending"),
      publishedAt: source.published_at ?? null,
    });
    stats.images += images.length;
  }

  // live collections order + titles, jaisa store me hai
  const COLLECTION_COPY = {
    "new-arrivals": { title: "New Arrivals", subtitle: "Freshly dropped festive favourites", sortOrder: 1 },
    "party-wear-gown": { title: "Anarkali Suit", subtitle: "Designer Anarkali Suits", sortOrder: 2 },
    "likshas-choice": { title: "Liksha's Choice", subtitle: "Handpicked by our stylists", sortOrder: 3 },
    "lehnga-choli": { title: "Lehenga Choli", subtitle: "Our Range of Designer Lehenga Choli", sortOrder: 4 },
    "printed-suit-set": { title: "Printed Suit Set", subtitle: "Everyday ethnic ease", sortOrder: 5 },
    "trending": { title: "Trending", subtitle: "Top view in this week", sortOrder: 6 },
    "weddin-collection": { title: "Wedding Collection", subtitle: "Bridal & trousseau edit", sortOrder: 7 },
    "sale": { title: "Sale", subtitle: "Limited-time festive prices", sortOrder: 8 },
    "saree": { title: "Saree", subtitle: "Timeless six yards", sortOrder: 9 },
  };

  const collections = [];
  for (const live of liveCollections) {
    const copy = COLLECTION_COPY[live.handle];
    if (!copy) continue; // frontpage = home ka internal collection, nav me nahi
    const firstProduct = products.find((product) => product.collections.includes(live.handle) && product.images.length);
    collections.push({
      handle: live.handle,
      title: copy.title,
      subtitle: copy.subtitle,
      image: firstProduct?.images[0] ?? products[0]?.images[0] ?? "",
      sortOrder: copy.sortOrder,
      productCount: products.filter((product) => product.collections.includes(live.handle)).length,
    });
  }
  collections.sort((a, b) => a.sortOrder - b.sortOrder);

  const catalog = {
    meta: {
      store: "Liksha Clothing",
      source: SOURCE,
      cdn: CDN,
      currency: "INR",
      moneyUnit: "paise",
      builtAt: new Date().toISOString(),
      snapshotAt: readJson(path.join(LIVE, "products.json")).fetchedAt ?? null,
      productCount: products.length,
      imageCount: stats.images,
    },
    collections,
    products,
  };

  const json = JSON.stringify(catalog, null, 1);
  write("database/seeds/catalog.json", json);
  write("apps/web/src/data/catalog.json", json);
  write("apps/admin/src/data/catalog.json", json);

  console.log(`catalog built: ${products.length} products, ${collections.length} collections, ${stats.images} images`);
  console.log(`sizes: ${[...stats.sizes].sort().join(" · ")}`);
  for (const collection of collections) {
    console.log(`  ${collection.handle.padEnd(18)} ${String(collection.productCount).padStart(3)}`);
  }
  if (stats.noImage.length) console.warn(`no image (${stats.noImage.length}):`, stats.noImage.slice(0, 8));
})();
