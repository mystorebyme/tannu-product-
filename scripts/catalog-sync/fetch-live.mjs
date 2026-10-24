#!/usr/bin/env node
/**
 * Live store se raw Shopify JSON uthata hai (products + collections).
 *
 * Kyun alag script: sandbox / restricted network se likshaclothing.com reach nahi hota,
 * isliye GitHub Actions par chalaya jaata hai (.github/workflows/catalog-sync.yml) aur
 * output repo me commit ho jaata hai. Local machine par bhi seedha chal jaayega:
 *
 *   node scripts/catalog-sync/fetch-live.mjs
 *
 * Output: database/seeds/live/{products,collections}.json  (raw Shopify documents)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ORIGIN = process.env.CATALOG_ORIGIN || "https://www.likshaclothing.com";
const OUT_DIR = path.join(process.cwd(), "database", "seeds", "live");
const PAGE_SIZE = 250;
const MAX_PAGES = 20;

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      // Shopify public JSON endpoints browser UA ke saath reliable rehte hain
      "user-agent": "Mozilla/5.0 (compatible; LikshaCatalogSync/1.0)",
      accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function fetchProducts() {
  const products = [];
  let page = 1;
  for (; page <= MAX_PAGES; page += 1) {
    const url = `${ORIGIN}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    const body = await getJson(url);
    const batch = body.products ?? [];
    console.log(`page ${page}: ${batch.length} products`);
    if (batch.length === 0) break;
    products.push(...batch);
  }
  return products;
}

async function fetchCollections() {
  const body = await getJson(`${ORIGIN}/collections.json?limit=250`);
  return body.collections ?? [];
}

const [products, collections] = await Promise.all([fetchProducts(), fetchCollections()]);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  path.join(OUT_DIR, "products.json"),
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), origin: ORIGIN, products }, null, 1)}\n`,
);
await writeFile(
  path.join(OUT_DIR, "collections.json"),
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), origin: ORIGIN, collections }, null, 1)}\n`,
);

const images = products.reduce((n, p) => n + (p.images?.length ?? 0), 0);
console.log(`\nsaved ${products.length} products / ${images} images / ${collections.length} collections`);
