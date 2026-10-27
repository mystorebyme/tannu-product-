import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { applySalePricing, displayedPercent } from "../../scripts/lib/sale-pricing.mjs";
import { PROMO_HANDLES } from "../../apps/web/src/lib/promo";

/**
 * R47 (owner):
 *   1. "ye lgao yrr previous link change kro … ye dal do" — owner ki 6 nayi
 *      phototourl photo links products ban kar catalog me aayein (purani
 *      kommodo links expiring thin — owner ne khud replace ki).
 *   2. "koi aacha sa name dalna kuki ye home page pr dikhni chiye … isis se
 *      permotion aaya hai" — home par deterministic promo rail (rotation ka
 *      wait nahi).
 *   3. "name size sb add kr dena" — poora size ladder XS…3XL, sab available.
 *   4. "price vhi iska 65% discount kr dena vhi 699 tk final price ho jaye" —
 *      final ₹699, MRP ₹1999, badge exactly 65% (saleLockedPrice escape hatch —
 *      warna build har product ka MRP 70/60 slab par recompute karta hai).
 *   5. "fix kr jo bi koi images cillision issue ho" — ek photo sirf ek product
 *      par (build guard + verify), promo photos aapas me unique.
 */

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, "database/seeds/catalog.json"), "utf8")) as {
  meta: Record<string, number>;
  products: any[];
};

const OWNER_IMAGE_URLS = [
  "https://cdn.phototourl.com/member/2026-10-27-90239d8a-0ed3-4635-bca9-1eddfd49648b.jpg",
  "https://cdn.phototourl.com/member/2026-10-27-62226e5e-8013-4dc1-bd9d-77773a1c8772.jpg",
  "https://cdn.phototourl.com/member/2026-10-27-c9bbb502-ea37-47d0-8f13-6f3386617751.jpg",
  "https://cdn.phototourl.com/member/2026-10-27-6755c417-7159-40a7-a00d-54ebc0a84975.jpg",
  "https://cdn.phototourl.com/member/2026-10-27-63df45ce-cae9-439e-94d9-3945b545ffa2.jpg",
  "https://cdn.phototourl.com/member/2026-10-27-8c73809e-bd28-48a1-b759-38ddcfc0eeea.jpg",
];

const promoProducts = PROMO_HANDLES.map((handle) => catalog.products.find((product) => product.handle === handle));

/* ─────────────── 65% locked pricing (sale-pricing escape hatch) ─────────────── */

test("R47: saleLockedPrice wala product — final ₹699, MRP ₹1999, badge 65%", () => {
  const locked: any = {
    handle: "locked-promo-suit",
    price: 69_900,
    compareAtPrice: 199_900,
    saleLockedPrice: true,
    sizePricing: { "S [36]": { price: 69_900, compareAtPrice: 199_900, available: true } },
  };
  const unlocked: any = { handle: "unlocked-ladder-suit", price: 69_900, compareAtPrice: null };
  applySalePricing([locked, unlocked]);

  assert.equal(locked.price, 69_900, "locked price ₹699 rehti hai");
  assert.equal(locked.compareAtPrice, 199_900, "locked MRP override nahi hota");
  assert.equal(displayedPercent(locked.price, locked.compareAtPrice), 65, "badge 65%");
  assert.equal(locked.sizePricing["S [36]"].price, 69_900, "har size par ₹699");
  assert.equal(locked.sizePricing["S [36]"].compareAtPrice, 199_900, "har size par locked MRP");

  // bina lock ke wahi price 70/60 slab par recompute hota rahe (regression guard)
  assert.equal(unlocked.price, 69_900);
  const percent = displayedPercent(unlocked.price, unlocked.compareAtPrice);
  assert.ok(percent === 70 || percent === 60, `unlocked badge 70/60 rehna chahiye, mila ${percent}`);
});

/* ─────────────── catalog me 6 promo products ─────────────── */

test("R47: owner ki 6 phototourl links hi promo products ki images hain", () => {
  assert.equal(PROMO_HANDLES.length, 6);
  const images = promoProducts.map((product) => product?.images?.[0]).sort();
  assert.deepEqual(images, [...OWNER_IMAGE_URLS].sort());
});

test("R47: promo products — naam, ₹699/65%, sab sizes available, collections", () => {
  const expectedSizes = ["XS [34]", "S [36]", "M [38]", "L [40]", "XL [42]", "2XL [44]", "3XL [46]"];
  for (const [index, product] of promoProducts.entries()) {
    assert.ok(product, `promo product catalog me missing: ${PROMO_HANDLES[index]}`);
    assert.ok(product.title.length >= 10, `${product.handle}: accha naam hona chahiye`);
    assert.equal(product.price, 69_900, `${product.handle}: final ₹699`);
    assert.equal(product.compareAtPrice, 199_900, `${product.handle}: MRP ₹1999`);
    assert.equal(displayedPercent(product.price, product.compareAtPrice), 65, `${product.handle}: 65% off`);
    assert.equal(product.saleLockedPrice, true, `${product.handle}: MRP locked`);
    assert.deepEqual(product.sizes, expectedSizes, `${product.handle}: poora size ladder`);
    for (const size of expectedSizes) {
      const pricing = product.sizePricing?.[size];
      assert.ok(pricing?.available, `${product.handle}/${size}: available`);
      assert.equal(pricing.price, 69_900, `${product.handle}/${size}: ₹699`);
      assert.equal(pricing.compareAtPrice, 199_900, `${product.handle}/${size}: MRP ₹1999`);
    }
    assert.equal(product.source, "extra", `${product.handle}: live-parity (287) se bahar`);
    assert.equal(product.featured, true, `${product.handle}: featured`);
    assert.equal(product.inStock, true, `${product.handle}: in stock`);
    assert.equal(product.hidden ?? false, false, `${product.handle}: visitors ko dikhta hai`);
    assert.equal(product.rating, 0, `${product.handle}: koi fake review nahi`);
    assert.equal(product.reviewCount, 0, `${product.handle}: koi fake review nahi`);
    for (const collection of ["new-arrivals", "party-wear-gown", "likshas-choice", "trending"]) {
      assert.ok(product.collections.includes(collection), `${product.handle}: ${collection} me hai`);
    }
    assert.ok(product.description.includes("₹699"), `${product.handle}: description me final price`);
  }
});

test("R47: image collision fix — poori catalog me ek photo sirf ek product par", () => {
  const seen = new Map<string, string>();
  for (const product of catalog.products) {
    for (const image of product.images ?? []) {
      assert.ok(!seen.has(image), `${image} shared: ${seen.get(image)} + ${product.handle}`);
      seen.set(image, product.handle);
    }
  }
  const promoImages = promoProducts.map((product) => product?.images?.[0]);
  assert.equal(new Set(promoImages).size, 6, "promo photos aapas me unique");
});

test("R47: counts — 453 products, live parity 287 untouched", () => {
  assert.equal(catalog.products.length, 453);
  assert.equal(catalog.meta.productCount, 453);
  assert.equal(catalog.meta.liveProductCount, 287, "liksha live-store parity nahi tootni chahiye");
});

/* ─────────────── home page wiring ─────────────── */

test("R47: home par deterministic promo rail — rotating rails se pehle", () => {
  const page = fs.readFileSync(path.join(root, "apps/web/src/app/page.tsx"), "utf8");
  assert.match(page, /PROMO_HANDLES/, "page promo handles use karta hai");
  assert.match(page, /data-testid="promo-rail"/, "promo section testid ke saath");
  const promoAt = page.indexOf("promoPicks.length > 0");
  const trendyAt = page.indexOf('<ProductRail rail="trendy"');
  assert.ok(promoAt > -1 && trendyAt > -1 && promoAt < trendyAt, "promo rail sabse pehle dikhta hai");
});

test("R47: duplicate-key error fix — announcements dedupe + index-based keys", () => {
  const header = fs.readFileSync(path.join(root, "apps/web/src/components/site-header.tsx"), "utf8");
  assert.match(header, /item !== announcement/, "sheet announcement fallback se dedupe hota hai");
  assert.match(header, /key=\{`\$\{index\}-\$\{item\}`\}/, "dots ki key index-based");
  const bar = fs.readFileSync(path.join(root, "apps/web/src/components/announcement-bar.tsx"), "utf8");
  assert.match(bar, /message\.text !== announcement/, "bar me bhi dedupe");
});

test("R47: admin newProducts path wired — overrides.json build me merge hota hai", () => {
  const build = fs.readFileSync(path.join(root, "scripts/build-catalog.mjs"), "utf8");
  assert.match(build, /newProducts: parsed\.newProducts \?\? \[\]/, "adminOverrides newProducts lauta hai");
  const overrides = JSON.parse(
    fs.readFileSync(path.join(root, "database/seeds/admin/overrides.json"), "utf8"),
  ) as { newProducts: any[] };
  assert.equal(overrides.newProducts.length, 6);
  for (const item of overrides.newProducts) {
    assert.equal(item.price, 69_900);
    assert.equal(item.compareAtPrice, 199_900);
    assert.equal(item.saleLockedPrice, true);
  }
});
