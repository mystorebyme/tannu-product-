import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { applySalePricing, displayedPercent } from "../../scripts/lib/sale-pricing.mjs";

/**
 * R47 (owner):
 *   1. "ye lgao yrr previous link change kro … ye dal do" — owner ki 6 nayi
 *      phototourl photo links site par aayein (purani kommodo links expiring
 *      thin — owner ne khud replace ki).
 *   2. UPDATE (owner): "jo link diye the … vo saare ek hi product ke the ok
 *      mtla vo ek hi product hai tumn alag alag list kr diya fix kro … ek mai
 *      merge kro sb ko" — chaaron links EK hi product ki gallery hain: ek
 *      listing, 6 photos (alag alag products nahi).
 *   3. "koi aacha sa name dalna kuki ye home page pr dikhni chiye … isis se
 *      permotion aaya hai" — home par deterministic promo rail (rotation ka
 *      wait nahi).
 *   4. "name size sb add kr dena" — poora size ladder XS…3XL, sab available.
 *   5. "price vhi iska 65% discount kr dena vhi 699 tk final price ho jaye" —
 *      final ₹699, MRP ₹1999, badge exactly 65% (saleLockedPrice escape hatch —
 *      warna build har product ka MRP 70/60 slab par recompute karta hai).
 *   6. "fix kr jo bi koi images cillision issue ho" — ek photo sirf ek product
 *      par (build guard + verify), gallery photos aapas me unique.
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

const PROMO_HANDLE = "noor-festive-elegance-designer-suit-set";
const promo = catalog.products.find((product) => product.handle === PROMO_HANDLE);

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

/* ─────────────── ek promo product, 6 photos ki gallery ─────────────── */

test("R47: saari 6 phototourl links EK hi product par — alag listings nahi", () => {
  assert.ok(promo, "promo product catalog me hai");
  assert.deepEqual(promo.images, OWNER_IMAGE_URLS, "poori gallery owner ke order me");

  // purani 6 alag listings gayab — unke handles catalog me nahi bachne chahiye
  const staleHandles = [
    "zarina-royale-designer-suit-set",
    "meher-grace-designer-suit-set",
    "inaya-dream-designer-suit-set",
    "aiza-luxe-designer-suit-set",
    "sana-signature-designer-suit-set",
  ];
  for (const handle of staleHandles) {
    assert.ok(
      !catalog.products.some((product) => product.handle === handle),
      `${handle}: merged product ke baad ye listing nahi rehni chahiye`,
    );
  }
  // aur koi doosra product in photos ko share na kare
  const others = catalog.products.filter(
    (product) => product.handle !== PROMO_HANDLE && (product.images ?? []).some((image: string) => OWNER_IMAGE_URLS.includes(image)),
  );
  assert.equal(others.length, 0, "gallery photos sirf promo product par");
});

test("R47: promo product — naam, ₹699/65%, sab sizes available, collections", () => {
  const expectedSizes = ["XS [34]", "S [36]", "M [38]", "L [40]", "XL [42]", "2XL [44]", "3XL [46]"];
  assert.ok(promo.title.length >= 10, "accha naam hona chahiye");
  assert.equal(promo.price, 69_900, "final ₹699");
  assert.equal(promo.compareAtPrice, 199_900, "MRP ₹1999");
  assert.equal(displayedPercent(promo.price, promo.compareAtPrice), 65, "65% off");
  assert.equal(promo.saleLockedPrice, true, "MRP locked");
  assert.deepEqual(promo.sizes, expectedSizes, "poora size ladder");
  for (const size of expectedSizes) {
    const pricing = promo.sizePricing?.[size];
    assert.ok(pricing?.available, `${size}: available`);
    assert.equal(pricing.price, 69_900, `${size}: ₹699`);
    assert.equal(pricing.compareAtPrice, 199_900, `${size}: MRP ₹1999`);
  }
  assert.equal(promo.source, "extra", "live-parity (287) se bahar");
  assert.equal(promo.featured, true, "featured");
  assert.equal(promo.inStock, true, "in stock");
  assert.equal(promo.hidden ?? false, false, "visitors ko dikhta hai");
  // R50: owner-curated merge — Noor == Aarushi Heavy Pure Cinon Silk Gown (owner:
  // "ek hi product hai … jo treanding mai hai usko rhne dena"). Aarushi ke ASLI
  // 4.8★/52 reviews family card par carry hote hain — fake review nahi, same
  // dress ka real aggregate (carry sirf upward, build-catalog pass 0).
  assert.equal(promo.rating, 4.8, "family ka asli score carry hua (R50 curated merge)");
  assert.equal(promo.reviewCount, 52, "family ke asli reviews carry hue");
  for (const collection of ["new-arrivals", "party-wear-gown", "likshas-choice", "trending"]) {
    assert.ok(promo.collections.includes(collection), `${collection} me hai`);
  }
  assert.ok(promo.description.includes("₹699"), "description me final price");
});

test("R47: image collision fix — poori catalog me ek photo sirf ek product par", () => {
  const seen = new Map<string, string>();
  for (const product of catalog.products) {
    for (const image of product.images ?? []) {
      assert.ok(!seen.has(image), `${image} shared: ${seen.get(image)} + ${product.handle}`);
      seen.set(image, product.handle);
    }
  }
  assert.equal(new Set(promo.images).size, 6, "gallery photos aapas me unique");
});

test("R47: counts — 448 products (ek promo listing judi), live parity 287 untouched", () => {
  assert.equal(catalog.products.length, 448);
  assert.equal(catalog.meta.productCount, 448);
  assert.equal(catalog.meta.liveProductCount, 287, "liksha live-store parity nahi tootni chahiye");
});

/* ─────────────── home page wiring ─────────────── */

test("R51: home se duplicate Trending rail (promo) hataya — ek hi Trending Now", () => {
  // Owner: "do do treanding aa rhe hai … jo first hai jisme 1 product hai usko
  // home page se remove kr do" — purana promo section (hardcoded "Trending Now"
  // heading + ek Noor card) gaya; asli Trending collection rail rehta hai.
  const page = fs.readFileSync(path.join(root, "apps/web/src/app/page.tsx"), "utf8");
  assert.ok(!page.includes("PromoRail"), "promo rail component home se gaya");
  assert.ok(!page.includes("promo-rail"), "promo testid home se gaya");
  assert.ok(!page.includes("PROMO_HANDLES"), "promo handles import home se gaya");
  assert.ok(!page.includes("Handpicked for the festivities"), "duplicate subtitle gayi");
  assert.ok(!page.includes("Trending Now"), "home me Trending Now heading hardcoded nahi — RAILS se aati hai");
  assert.match(page, /<ProductRail rail="trendy"/, "asli Trending collection rail home par hai");
  assert.ok(!fs.existsSync(path.join(root, "apps/web/src/lib/promo.ts")), "promo lib hi nahi bachi");
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
  assert.equal(overrides.newProducts.length, 1, "ek hi promo listing");
  const item = overrides.newProducts[0];
  assert.equal(item.handle, PROMO_HANDLE);
  assert.deepEqual(item.images, OWNER_IMAGE_URLS, "6 photos ek hi product me");
  assert.equal(item.price, 69_900);
  assert.equal(item.compareAtPrice, 199_900);
  assert.equal(item.saleLockedPrice, true);
});
