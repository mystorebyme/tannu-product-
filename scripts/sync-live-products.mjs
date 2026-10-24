#!/usr/bin/env node
/**
 * sync-live-products.mjs — likshaclothing.com se EXACT product data pull karta hai.
 *
 * Har product ka `/products/<handle>.js` (Shopify public JSON) padhta hai aur catalog.json me
 * yeh fields live values se replace karta hai:
 *   title, description (body_html), images (poora gallery), sizes/variants,
 *   price, compareAtPrice (paise), tags, productType
 *
 * Collections, category, fabric, color, featured, rating — local curation, waisi hi rehti hai.
 *
 * Usage:
 *   node scripts/sync-live-products.mjs                 # saare 287
 *   node scripts/sync-live-products.mjs --limit 20      # pehle 20 (test run)
 *   node scripts/sync-live-products.mjs --only <handle> # ek product
 *   node scripts/sync-live-products.mjs --dry-run       # likho mat, sirf report
 *
 * Network chahiye (sandbox me outbound block ho sakta hai — apni machine par chalao).
 * Idempotent: dobara chalane par wahi data likhta hai. Fail hone par purana data safe rehta hai.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeSizes } from "./lib/sizes.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = "https://www.likshaclothing.com";
const FILE = path.join(ROOT, "database/seeds/catalog.json");
const COPIES = ["apps/web/src/data/catalog.json", "apps/admin/src/data/catalog.json"];
const CONCURRENCY = 6;
const RETRIES = 3;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const onlyArg = args.indexOf("--only");
const limit = limitArg !== -1 ? Number(args[limitArg + 1]) : Infinity;
const only = onlyArg !== -1 ? args[onlyArg + 1] : null;

const catalog = JSON.parse(fs.readFileSync(FILE, "utf8"));

async function fetchProduct(handle) {
  const url = `${SOURCE}/products/${encodeURIComponent(handle)}.js`;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "liksha-catalog-sync/1.0" } });
      if (response.status === 404) return { handle, missing: true };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { handle, product: await response.json() };
    } catch (error) {
      if (attempt === RETRIES) return { handle, error: String(error) };
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  return { handle, error: "unreachable" };
}

/** Shopify price string "2,999.00" -> 299900 paise */
function toPaise(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function merge(product, live) {
  const variants = live.variants ?? [];
  const prices = variants.map((variant) => toPaise(variant.price)).filter((price) => Number.isFinite(price));
  const compares = variants
    .map((variant) => toPaise(variant.compare_at_price))
    .filter((price) => Number.isFinite(price) && price > 0);
  const options = variants.flatMap((variant) => [variant.option1, variant.option2, variant.option3]).filter(Boolean);

  return {
    ...product,
    title: live.title?.trim() || product.title,
    description: live.body_html?.trim() || product.description,
    images: (live.images ?? []).map((image) => image.src).filter(Boolean).length
      ? (live.images ?? []).map((image) => image.src)
      : product.images,
    sizes: normalizeSizes(options.length ? options : product.sizes),
    price: prices.length ? Math.min(...prices) : product.price,
    compareAtPrice: compares.length ? Math.max(...compares) : product.compareAtPrice,
    tags: Array.isArray(live.tags) ? live.tags : [],
    productType: live.product_type || null,
    vendor: live.vendor || null,
    publishedAt: live.published_at || null,
    syncedAt: new Date().toISOString(),
  };
}

async function main() {
  const targets = catalog.products.slice(0, Number.isFinite(limit) ? limit : undefined).filter((product) => !only || product.sourceHandle === only);

  console.log(`sync: ${targets.length} products from ${SOURCE}${dryRun ? " (dry run)" : ""}`);

  let queueIndex = 0;
  const results = [];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queueIndex < targets.length) {
      const index = queueIndex;
      queueIndex += 1;
      const product = targets[index];
      const result = await fetchProduct(product.sourceHandle ?? product.handle);
      results.push({ product, ...result });
      process.stdout.write(`\r  ${results.length}/${targets.length}`);
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");

  const stats = { updated: 0, missing: 0, failed: 0 };
  for (const { product, product: live, missing, error } of results) {
    if (missing) {
      stats.missing += 1;
      console.warn(`missing on store: ${product.sourceHandle ?? product.handle}`);
      continue;
    }
    if (error || !live) {
      stats.failed += 1;
      console.warn(`failed: ${product.handle} — ${error}`);
      continue;
    }
    const merged = merge(product, live);
    const index = catalog.products.findIndex((item) => item.handle === product.handle);
    catalog.products[index] = merged;
    stats.updated += 1;
  }

  catalog.meta.syncedAt = new Date().toISOString();
  catalog.meta.productCount = catalog.products.length;

  if (!dryRun && stats.updated > 0) {
    const json = JSON.stringify(catalog, null, 2);
    fs.writeFileSync(FILE, json);
    for (const copy of COPIES) {
      fs.mkdirSync(path.dirname(path.join(ROOT, copy)), { recursive: true });
      fs.writeFileSync(path.join(ROOT, copy), json);
    }
  }

  console.log(`done — updated ${stats.updated}, missing ${stats.missing}, failed ${stats.failed}`);
  if (stats.failed) {
    console.warn("failed products ka purana data safe hai; dobara chalao (script idempotent hai)");
    process.exitCode = 1;
  }
  console.log("ab `npm run catalog:verify` aur `npm run build:web` chalao");
}

main();
