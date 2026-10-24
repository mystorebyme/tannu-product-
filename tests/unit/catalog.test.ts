import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Catalog, Product } from "@liksha/types";

const root = process.cwd(); // npm test root se chalta hai
const file = path.join(root, "database/seeds/catalog.json");
const catalog = JSON.parse(fs.readFileSync(file, "utf8")) as Catalog;
const products: Product[] = catalog.products;

test("catalogue has the full live product set", () => {
  assert.equal(products.length, 287);
  assert.equal(catalog.meta.productCount, 287);
  assert.equal(catalog.meta.moneyUnit, "paise");
  assert.equal(catalog.meta.source, "https://www.likshaclothing.com");
});

test("web and admin copies are identical to the canonical seed", () => {
  const canonical = fs.readFileSync(file, "utf8");
  for (const app of ["web", "admin"]) {
    const copy = path.join(root, `apps/${app}/src/data/catalog.json`);
    assert.equal(fs.readFileSync(copy, "utf8"), canonical, `${app} copy is stale — run npm run catalog:build`);
  }
});

test("handles are unique and url-safe", () => {
  const handles = products.map((product) => product.handle);
  assert.equal(new Set(handles).size, handles.length);
  for (const handle of handles) assert.match(handle, /^[a-z0-9-]+$/);
});

test("every product has a positive integer price in paise", () => {
  for (const product of products) {
    assert.equal(Number.isInteger(product.price), true, `${product.handle} price not integer`);
    assert.ok(product.price > 0, `${product.handle} price <= 0`);
  }
});

test("price range matches the live store (Rs. 1,499 – Rs. 4,999)", () => {
  const prices = products.map((product) => product.price);
  assert.equal(Math.min(...prices), 149_900);
  assert.equal(Math.max(...prices), 499_900);
});

test("compare-at price is always above selling price when present", () => {
  for (const product of products) {
    if (product.compareAtPrice === null) continue;
    assert.equal(Number.isInteger(product.compareAtPrice), true);
    assert.ok(
      product.compareAtPrice > product.price,
      `${product.handle}: MRP ${product.compareAtPrice} <= price ${product.price}`,
    );
  }
});

test("every product has at least one CDN image and one size", () => {
  for (const product of products) {
    assert.ok(product.images.length >= 1, `${product.handle} has no image`);
    assert.match(product.images[0]!, /^https:\/\/cdn\.shopify\.com\//);
    assert.ok(product.sizes.length >= 1, `${product.handle} has no sizes`);
  }
});

test("sizes use the store's display format", () => {
  const allowed = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|Free Size)( \[[0-9]{2}\])?$/;
  for (const product of products) {
    for (const size of product.sizes) {
      assert.match(size, allowed, `${product.handle}: unexpected size "${size}"`);
    }
  }
});

test("nine live collections exist and membership is from the real set", () => {
  const handles = catalog.collections.map((collection) => collection.handle).sort();
  assert.deepEqual(handles, [
    "lehnga-choli",
    "likshas-choice",
    "new-arrivals",
    "party-wear-gown",
    "printed-suit-set",
    "sale",
    "saree",
    "trending",
    "weddin-collection",
  ]);
  const known = new Set(handles);
  for (const product of products) {
    for (const collection of product.collections) {
      assert.ok(known.has(collection), `${product.handle} points at unknown collection ${collection}`);
    }
  }
});

test("collection counts match the live store snapshot", () => {
  const counts: Record<string, number> = {};
  for (const product of products) {
    for (const collection of product.collections) {
      counts[collection] = (counts[collection] ?? 0) + 1;
    }
  }
  assert.equal(counts["new-arrivals"], 287);
  assert.equal(counts["party-wear-gown"], 266);
  assert.equal(counts["sale"], 246);
  assert.equal(counts["likshas-choice"], 126);
  assert.equal(counts["printed-suit-set"], 38);
  assert.equal(counts["lehnga-choli"], 23);
  assert.equal(counts["weddin-collection"], 18);
  assert.equal(counts["trending"], 4);
  assert.equal(counts["saree"], undefined); // store par bhi khaali
});

test("every product carries a description and details", () => {
  for (const product of products) {
    assert.ok(product.description.trim().length >= 10, `${product.handle} description missing`);
    assert.ok(Array.isArray(product.details), `${product.handle} details missing`);
    assert.ok(product.category.length > 0, `${product.handle} category missing`);
  }
});

test("handles are ASCII slugs with the source handle kept", () => {
  for (const product of products) {
    assert.match(product.handle, /^[a-z0-9-]+$/, `${product.handle} is not an ASCII slug`);
    assert.ok(product.sourceHandle.length > 0);
  }
});
