import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Catalog, Product } from "@liksha/types";

const root = process.cwd(); // npm test root se chalta hai
const file = path.join(root, "database/seeds/catalog.json");
const catalog = JSON.parse(fs.readFileSync(file, "utf8")) as Catalog;
const products: Product[] = catalog.products;
const liveDir = path.join(root, "database/seeds/live");
const liveProducts: any[] = JSON.parse(fs.readFileSync(path.join(liveDir, "products.json"), "utf8")).products;
const liveMembership: Record<string, string[]> = JSON.parse(
  fs.readFileSync(path.join(liveDir, "membership.json"), "utf8"),
).collections;

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

test("price range matches the live store snapshot", () => {
  const prices = products.map((product) => product.price);
  const livePrices = liveProducts
    .flatMap((product) => (product.variants ?? []).map((variant: any) => Math.round(Number(variant.price) * 100)))
    .filter((value: number) => value > 0);
  assert.equal(Math.min(...prices), Math.min(...livePrices));
  assert.equal(Math.max(...prices), Math.max(...livePrices));
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
  for (const [handle, handles] of Object.entries(liveMembership)) {
    if (handle === "frontpage") continue; // home-page grouping, nav collection nahi
    assert.equal(counts[handle] ?? 0, handles.length, `${handle} count drifted from the live store`);
  }
  assert.equal(counts["saree"], undefined); // store par bhi khaali
});

test("every product carries the full live gallery", () => {
  const liveByHandle = new Map(liveProducts.map((product) => [product.handle, product]));
  for (const product of products) {
    const source: any = liveByHandle.get(product.sourceHandle);
    assert.ok(source, `${product.handle} missing from the live snapshot`);
    assert.equal(product.images.length, (source.images ?? []).length, `${product.handle} gallery mismatch`);
    for (const image of product.images) assert.match(image, /^https:\/\/cdn\.shopify\.com\//);
  }
});

test("live descriptions are sanitized and rendered, not dropped", () => {
  for (const product of products) {
    assert.ok(product.descriptionHtml && product.descriptionHtml.length > 3, `${product.handle} has no descriptionHtml`);
    assert.doesNotMatch(product.descriptionHtml!, /<(script|iframe|img)\b/i, `${product.handle} has unsanitized html`);
  }
});

test("every size has live pricing attached", () => {
  for (const product of products) {
    for (const size of product.sizes) {
      const pricing = product.sizePricing?.[size];
      assert.ok(pricing, `${product.handle}: ${size} has no pricing`);
      assert.equal(Number.isInteger(pricing!.price), true);
      assert.ok(pricing!.price > 0);
    }
  }
});

test("every product carries a description and details", () => {
  for (const product of products) {
    assert.ok(product.description.trim().length >= 3, `${product.handle} description missing`);
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
