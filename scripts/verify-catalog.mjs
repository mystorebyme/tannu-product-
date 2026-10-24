#!/usr/bin/env node
/**
 * verify-catalog.mjs — catalogue ko ship karne se pehle sanity check.
 * Errors par exit 1 (CI gate). Warnings sirf print hote hain.
 *
 *   node scripts/verify-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "database/seeds/catalog.json");
const LIVE_COLLECTIONS = [
  "new-arrivals",
  "party-wear-gown",
  "saree",
  "likshas-choice",
  "lehnga-choli",
  "printed-suit-set",
  "weddin-collection",
  "trending",
  "sale",
];

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}
function warn(message) {
  warnings.push(message);
}

if (!fs.existsSync(FILE)) {
  console.error("catalog.json missing — run npm run catalog:build");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(FILE, "utf8"));
const products = catalog.products ?? [];

if (products.length !== 287) fail(`expected 287 products, found ${products.length}`);
if (catalog.meta?.moneyUnit !== "paise") fail("meta.moneyUnit must be 'paise'");
if (catalog.meta?.source !== "https://www.likshaclothing.com") fail("meta.source must be the live store");

const handles = new Set();
const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL)( \[[0-9]{2}\])?$|^Free Size$/;

for (const product of products) {
  if (!/^[a-z0-9-]+$/.test(product.handle)) fail(`${product.handle}: handle is not an ASCII slug`);
  if (handles.has(product.handle)) fail(`${product.handle}: duplicate handle`);
  handles.add(product.handle);

  if (!Number.isInteger(product.price) || product.price <= 0) {
    fail(`${product.handle}: price must be a positive integer (paise)`);
  }
  if (product.compareAtPrice !== null) {
    if (!Number.isInteger(product.compareAtPrice) || product.compareAtPrice <= product.price) {
      fail(`${product.handle}: compareAtPrice must be > price`);
    }
  }
  if (!product.images?.length) fail(`${product.handle}: no image`);
  if (!product.sizes?.length) fail(`${product.handle}: no sizes`);
  for (const size of product.sizes ?? []) {
    if (!sizePattern.test(size)) fail(`${product.handle}: bad size "${size}"`);
  }
  for (const collection of product.collections ?? []) {
    if (!LIVE_COLLECTIONS.includes(collection)) fail(`${product.handle}: unknown collection "${collection}"`);
  }
  if (!product.description || product.description.length < 10) {
    warn(`${product.handle}: description is very short`);
  }
}

const handlesInCatalog = (catalog.collections ?? []).map((collection) => collection.handle);
for (const handle of LIVE_COLLECTIONS) {
  if (!handlesInCatalog.includes(handle)) fail(`missing collection "${handle}"`);
}

const counts = {};
for (const product of products) {
  for (const collection of product.collections ?? []) counts[collection] = (counts[collection] ?? 0) + 1;
}

console.log(`products: ${products.length}`);
console.log(
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([handle, count]) => `  ${handle}: ${count}`)
    .join("\n"),
);

const singleImage = products.filter((product) => (product.images ?? []).length === 1).length;
if (singleImage) {
  warnings.push(
    `${singleImage} products have only the primary image — run "npm run catalog:sync-live" with internet to pull full galleries + exact descriptions`,
  );
}

for (const message of [...new Set(warnings)]) console.warn(`warn: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`error: ${message}`);
  process.exit(1);
}
console.log("catalog ok");
