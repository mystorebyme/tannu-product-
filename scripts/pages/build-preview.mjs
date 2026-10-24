#!/usr/bin/env node
/**
 * GitHub Pages static preview.
 *
 * Pages par Node server nahi chalta, isliye yahan sirf "dekhne layak" static build
 * banti hai: home, collections, product pages, cart/wishlist UI, policies.
 * Server wale hisse (API, order tracking, checkout submission) Render par chalte hain.
 *
 * Script build ke dauraan kuch files temporarily hataata hai aur build ke baad
 * hamesha wapas rakh deta hai (fail ho jaye to bhi).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const APP = path.join(ROOT, "apps/web");
const APP_DIR = path.join(APP, "src/app");
const TMP = path.join(ROOT, ".pages-preview-tmp");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "";

const moved = [];
function moveAway(relative) {
  const from = path.join(APP_DIR, relative);
  if (!fs.existsSync(from)) return;
  const to = path.join(TMP, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  moved.push({ from, to });
}

function restoreAll() {
  for (const { from, to } of moved.reverse()) {
    if (fs.existsSync(to)) {
      fs.mkdirSync(path.dirname(from), { recursive: true });
      fs.renameSync(to, from);
    }
  }
  moved.length = 0;
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  // server-only routes: Pages par nahi chal sakte
  moveAway("api");
  moveAway("orders");

  // search ko static client version se replace karo
  moveAway("search");
  fs.mkdirSync(path.join(APP_DIR, "search"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "scripts/pages/preview-search.tsx"),
    path.join(APP_DIR, "search/page.tsx"),
  );

  // client-side search ke liye chhota catalogue index
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "database/seeds/catalog.json"), "utf8"));
  const index = catalog.products
    .filter((product) => product.images?.length)
    .map((product) => ({
      handle: product.handle,
      title: product.title,
      price: product.price,
      image: `${product.images[0]}?width=400`,
      color: product.color ?? "",
      fabric: product.fabric ?? "",
      category: product.category ?? "",
    }));
  fs.mkdirSync(path.join(APP, "public"), { recursive: true });
  fs.writeFileSync(path.join(APP, "public/catalog-index.json"), JSON.stringify(index));

  // wishlist / compare static preview par bhi chalein — poora product (chhota shape)
  const lite = catalog.products.map((product) => ({
    handle: product.handle,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    images: product.images ?? [],
    sizes: product.sizes ?? [],
    sizePricing: product.sizePricing ?? {},
    inStock: product.inStock !== false,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    colourName: product.colourName ?? null,
    color: product.color ?? "",
    fabric: product.fabric ?? "",
    category: product.category ?? "anarkali",
    collections: product.collections ?? [],
    description: product.description ?? "",
  }));
  fs.writeFileSync(path.join(APP, "public/catalog-lite.json"), JSON.stringify(lite));

  execSync("npm run build --workspace @liksha/web", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      PAGES_PREVIEW: "1",
      PAGES_BASE_PATH: BASE_PATH,
      NEXT_PUBLIC_PAGES_BASE_PATH: BASE_PATH,
      NEXT_PUBLIC_PREVIEW: "1",
    },
  });

  const out = path.join(APP, "out");
  const dist = path.join(ROOT, "dist");
  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(out, dist, { recursive: true });
  // GitHub Pages Jekyll ko bypass kare
  fs.writeFileSync(path.join(dist, ".nojekyll"), "");
  console.log(`static preview ready: ${dist} (${BASE_PATH || "/"})`);
} finally {
  fs.rmSync(path.join(APP_DIR, "search"), { recursive: true, force: true });
  restoreAll();
  fs.rmSync(path.join(APP, "public/catalog-index.json"), { force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
}
