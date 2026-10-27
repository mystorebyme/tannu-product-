/**
 * R44 (owner) — sheet = reviews ka DB, hidden test product, delivery estimate
 * sheet se, aur /exec panel = visual sheet control.
 *
 * Owner ke shabd: "every product ka review dikhna chiye or new koi kre kisi
 * product ka vo bi dikhna chiye or us new review ko approv krte hi vo site pr
 * product pr live ho jana chiye … review mai image bi add kr shke … 8 image hai
 * to 8 coloum honge alag url … koi bi product delet krte hi or review delet
 * krte hi vi delet ho jana chiye … price only .1 ho jo testing purpose ke liye
 * … vo kisi user ya visiter ko nhai dikhe … estimited delivery date bi sheet se
 * change honi chiye."
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  bakedReviewSeedRows,
  reviewFromSheetRow,
  reviewSubmissionErrors,
  type SheetReview,
} from "../../apps/web/src/lib/reviews-format";
import { mergeSheetCatalog, type SheetProductRow } from "../../apps/web/src/lib/catalog-merge";
import { estimatedDelivery } from "../../apps/web/src/lib/tracking";
import { normaliseSheetSettings } from "../../apps/web/src/lib/sheet-format";
import { mergeSheetTracking, type SheetTracking } from "../../apps/web/src/lib/sheet-merge";
import { trackingUpdates } from "../../apps/web/src/lib/tracking";
import type { Catalog, Order, Product } from "@liksha/types";

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

/* ───────────────────────── fixtures ───────────────────────── */

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    handle: "p-1",
    sourceHandle: "p-1",
    title: "Product One",
    price: 59900,
    compareAtPrice: null,
    images: ["https://cdn/x.jpg"],
    collections: ["c-1"],
    category: "anarkali",
    fabric: "georgette",
    color: "Red",
    sizes: ["M [38]"],
    details: [],
    description: "",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    featured: false,
    ...overrides,
  } as Product;
}

function makeCatalog(products: Product[]): Catalog {
  return {
    meta: { builtAt: "2026-10-27T00:00:00.000Z", productCount: products.length },
    products,
    collections: [{ handle: "c-1", title: "C1", description: "", image: "", productCount: products.length, sortOrder: 1 }],
    colourGroups: {},
  } as unknown as Catalog;
}

function makeSheetReview(overrides: Partial<SheetReview> = {}): SheetReview {
  return {
    id: "RV-1",
    product: "p-1",
    handle: "p-1",
    customer: "Anita",
    city: "Jaipur",
    rating: 5,
    title: "Bahut accha",
    review: "Fabric bahut accha hai, fitting perfect.",
    verified: false,
    status: "approved",
    images: [],
    orderNumber: "",
    at: "2026-10-27 10:00:00",
    updated: "",
    ...overrides,
  };
}

/* ───────────────────────── R44.1: reviews — sheet hi DB hai ───────────────────────── */

test("R44: reviewFromSheetRow — Image 1…8 alag columns se photos, rating clamp, date", () => {
  const review = reviewFromSheetRow(
    makeSheetReview({
      images: ["https://a/1.webp", "https://a/2.webp", "https://a/3.webp"],
      rating: 4,
      at: "2026-10-25 18:30:00",
    }),
  );
  assert.equal(review.author, "Anita");
  assert.equal(review.rating, 4);
  assert.deepEqual(review.photos, ["https://a/1.webp", "https://a/2.webp", "https://a/3.webp"]);
  assert.equal(review.date, "2026-10-25");
  assert.equal(review.productHandle, "p-1");
  // rating khaali (owner ki manual row) → 0 honest hai, 5 nahi
  assert.equal(reviewFromSheetRow(makeSheetReview({ rating: 0 })).rating, 0);
  assert.equal(reviewFromSheetRow(makeSheetReview({ rating: 9 })).rating, 5, "clamp 5");
});

test("R44: reviewSubmissionErrors — validation rules (form + API dono isi par chalte hain)", () => {
  assert.deepEqual(
    reviewSubmissionErrors({ handle: "p-1", name: "Anita", rating: 5, body: "Bahut accha product hai", images: ["https://a/1.webp"] }),
    [],
    "sahi submission → koi error nahi",
  );
  assert.ok(reviewSubmissionErrors({ handle: "", name: "Anita", rating: 5, body: "accha hai ye" }).length, "handle zaroori");
  assert.ok(reviewSubmissionErrors({ handle: "p", name: "A", rating: 5, body: "accha hai ye product" }).length, "naam 2+ akshar");
  assert.ok(reviewSubmissionErrors({ handle: "p", name: "An", rating: 6, body: "accha hai ye product" }).length, "rating 1-5");
  assert.ok(reviewSubmissionErrors({ handle: "p", name: "An", rating: 5, body: "chhota" }).length, "body 10+ akshar");
  assert.ok(
    reviewSubmissionErrors({ handle: "p", name: "An", rating: 5, body: "theek hai product", images: ["ftp://x"] }).length,
    "image https:// se",
  );
  assert.ok(
    reviewSubmissionErrors({
      handle: "p",
      name: "An",
      rating: 5,
      body: "theek hai product",
      images: Array.from({ length: 9 }, (_, i) => `https://a/${i}.webp`),
    }).length,
    "8 se zyada image nahi",
  );
});

test("R44: bakedReviewSeedRows — purane reviews sheet-format me, sab approved, Image columns alag", () => {
  const rows = bakedReviewSeedRows();
  assert.ok(rows.length > 1000, `baked reviews seed ke liye ready (${rows.length})`);
  assert.ok(rows.length <= 3000, "cap 3000");
  assert.ok(rows.every((row) => row.Status === "approved"), "purane reviews approved seed hote hain");
  assert.ok(rows.every((row) => String(row["Review ID"]).startsWith("RV-")), "har row ka Review ID");
  assert.ok(rows.every((row) => String(row.Handle).length > 0 && String(row.Review).length > 0));
  const withPhotos = rows.find((row) => String(row["Photo URL"]).startsWith("http"));
  if (withPhotos) {
    assert.equal(withPhotos["Image 1"], withPhotos["Photo URL"], "pehli image Image 1 column me bhi");
  }
});

/* ───────────────────────── R44.2: hidden test product (₹0.10) ───────────────────────── */

test("R44: catalog.json me ₹0.10 hidden test product hai (owner ka payment test)", () => {
  const catalog = JSON.parse(read("apps/web/src/data/catalog.json")) as Catalog;
  const testProduct = catalog.products.find((product) => product.hidden === true);
  assert.ok(testProduct, "hidden test product catalog me hai");
  assert.equal(testProduct!.price, 10, "price 10 paise = ₹0.10");
  assert.equal(testProduct!.inStock, true);
});

test("R44: hidden row → product catalog me flag ke saath rehta hai (direct link khulta hai), counts/lists me nahi", () => {
  const base = makeCatalog([makeProduct({ handle: "normal" })]);
  const rows: SheetProductRow[] = [
    { Id: "normal", Status: "active" },
    { Id: "test-product-payment", Title: "Test Product", Price: 0.1, Status: "hidden" },
  ];
  const merged = mergeSheetCatalog(base, rows);
  const handles = merged.products.map((product) => product.handle);
  assert.ok(handles.includes("test-product-payment"), "hidden product catalog me hai (page direct link se khulega)");
  assert.equal(merged.products.find((product) => product.handle === "test-product-payment")?.hidden, true);
  assert.equal(merged.products.find((product) => product.handle === "normal")?.hidden, undefined);
  assert.equal(merged.meta.productCount, 1, "meta count me hidden nahi");
  // sirf hidden rows → base fallback (site khaali na ho)
  const onlyHidden = mergeSheetCatalog(base, [{ Id: "x", Title: "X", Price: 1, Status: "hidden" }]);
  assert.equal(onlyHidden, base, "sab rows hidden → baked catalog chalta rahe");
});

/* ───────────────────────── R44.3: delivery estimate sheet se ───────────────────────── */

test("R44: normaliseSheetSettings — delivery_estimate_days/text sheet keys map hote hain", () => {
  const settings = normaliseSheetSettings({
    ok: true,
    settings: { delivery_estimate_days: "7", delivery_estimate_text: "  3 se 5 din me delivery  " },
  });
  assert.equal(settings?.deliveryEstimateDays, 7);
  assert.equal(settings?.deliveryEstimateText, "3 se 5 din me delivery");
  const garbage = normaliseSheetSettings({ settings: { delivery_estimate_days: "99", delivery_estimate_text: "" } });
  assert.equal(garbage?.deliveryEstimateDays, undefined, "30 se upar accept nahi");
  assert.equal(garbage?.deliveryEstimateText, undefined, "khaali text undefined (default chalega)");
});

test("R44: estimatedDelivery — default 6 din, sheet days override, exact text override", () => {
  const created = "2026-10-27T07:40:00.000Z";
  assert.equal(estimatedDelivery(created), estimatedDelivery(created, { days: 6 }), "default = 6 din");
  const three = estimatedDelivery(created, { days: 3 });
  assert.ok(three.includes("30"), `3 din baad ki date (${three})`);
  assert.equal(estimatedDelivery(created, { days: 3, text: "Diwali tak delivery" }), "Diwali tak delivery", "text jeetta hai");
  assert.equal(estimatedDelivery(created, { days: 0 }), estimatedDelivery(created), "galat days → default");
});

/* ───────────────────────── R44.4: timeline guard (payment-only sheet edit) ───────────────────────── */

test("R44: khaali-status sheet edit row se galat 'Placed' stage entry nahi banti", () => {
  const base = {
    id: "LK-1",
    orderNumber: "LK-1",
    createdAt: "2026-10-27T07:40:00.000Z",
    notes: null,
    items: [],
    paymentMethod: "prepaid",
    paymentStatus: "pending",
    payment: null,
    status: "delivered",
    audit: [],
  } as unknown as Order;
  const sheet: SheetTracking = {
    orderNumber: "LK-1",
    status: "delivered",
    step: 4,
    steps: [],
    paymentStatus: "pending",
    courier: "",
    awb: "",
    trackingUrl: "",
    note: "",
    updates: [
      // owner ne sirf Payment status badla (processing) — Order status column khaali
      { at: "2026-10-27T08:00:00.000Z", status: "", event: "order.payment_sheet", message: "", payment: "processing", notes: "" },
    ],
    readAt: Date.now(),
  };
  const merged = mergeSheetTracking(base, sheet);
  const updates = trackingUpdates(merged);
  assert.ok(
    !updates.some((update) => update.kind === "status" && update.status === "placed"),
    "payment-only edit se Placed entry nahi banti",
  );
});

/* ───────────────────────── R44.5: script r44-1 guards ───────────────────────── */

test("R44: script r44-1 — Reviews tab (Review ID + Image 1…8 + City), validations, actions, panel sections", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  assert.match(gs, /var CODE_VERSION = 'r44-1';/);
  // Reviews headers
  assert.match(gs, /'Timestamp', 'Review ID', 'Product', 'Handle', 'Customer', 'City', 'Rating',/);
  assert.match(gs, /'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5', 'Image 6', 'Image 7', 'Image 8',/);
  assert.match(gs, /Reviews: \{ Status: \['pending', 'approved', 'rejected'\], Verified: \['yes', 'no'\], Rating: \['1', '2', '3', '4', '5'\] \}/);
  // delivery estimate settings
  assert.match(gs, /\['delivery_estimate_days', '6'\]/);
  assert.match(gs, /\['delivery_estimate_text', ''\]/);
  assert.match(gs, /'delivery_estimate_days', 'delivery_estimate_text',/);
  // helpers
  for (const fn of ["function reviewId_", "function reviewRow_", "function normalizeImageList_", "function reviewsList_", "function updateReview_", "function deleteReview_", "function deleteWhere_", "function upsertProduct_", "function deleteProduct_", "function seedReviews_"]) {
    assert.ok(gs.includes(fn), `${fn} script me hai`);
  }
  // GET actions — reviews public, panel mutations token-gated
  assert.match(gs, /action === 'reviews'/);
  assert.match(gs, /action === 'settings' \|\| action === 'version' \|\| action === 'ping' \|\| action === 'health' \|\| action === 'reviews'/);
  assert.match(gs, /action === 'review_set' \|\| action === 'review_update'/);
  assert.match(gs, /action === 'review_delete'/);
  assert.match(gs, /action === 'product_delete'/);
  assert.match(gs, /action === 'message_replied'/);
  assert.match(gs, /action === 'order_set'/);
  // POST actions + form fallback
  assert.match(gs, /action === 'reviews_seed'/);
  assert.match(gs, /action === 'product_upsert'/);
  assert.match(gs, /e\.parameter\.action/, "panel ke urlencoded forms doPost me chalte hain");
  // order panel edit → Admin Note + sahi event
  assert.match(gs, /'Admin Note': text_\(body\.adminNote \|\| ''\)/);
  assert.match(gs, /hasStatus \|\| hasPayment \? 'order\.status_sheet' : \(hasNote \? 'order\.admin_note' : 'order\.updated'\)/);
  // panel sections
  for (const marker of ["ordersSection", "productsSection", "reviewsSection", "messagesSection", "settingsSection", "product_upsert", "review_set", "message_replied", "delivery_estimate_days", "Hidden/test products"]) {
    assert.ok(gs.includes(marker), `panel me ${marker}`);
  }
  // public read sirf approved
  assert.match(gs, /status: reviewsAuthed \? String\(params\.status \|\| ''\) : 'approved'/);
});

/* ───────────────────────── R44.6: site wiring guards ───────────────────────── */

test("R44: site wiring — product page live reviews, /api/reviews, hidden filters, settings expose", () => {
  const productPage = read("apps/web/src/app/products/[handle]/page.tsx");
  assert.match(productPage, /liveReviewBlock\(product\.handle\)/, "product page sheet reviews padhta hai");
  assert.ok(!/from "@\/lib\/reviews";/.test(productPage), "baked-only import hat gaya");

  const reviewsRoute = read("apps/web/src/app/api/reviews/route.ts");
  assert.match(reviewsRoute, /reviewSubmissionErrors/, "API wahi pure validation use karta hai");
  assert.match(reviewsRoute, /getProduct\(handle\)/, "galat handle par sheet row nahi banti");
  assert.match(reviewsRoute, /submitReview\(/, "review sheet me pending jaata hai");
  assert.match(reviewsRoute, /429/, "throttle");

  const reviewsSheet = read("apps/web/src/lib/reviews-sheet.ts");
  assert.match(reviewsSheet, /reviews_seed/, "khaali tab par baked reviews seed");
  assert.match(reviewsSheet, /SHEET_REVIEWS_MIN_MAJOR = 44/, "purane script par seed attempt nahi");
  assert.match(reviewsSheet, /reviewsFor\(handle\)/, "sheet down → baked fallback");
  assert.match(reviewsSheet, /status: "pending"/, "naya review hamesha pending");

  const store = read("apps/web/src/lib/store.ts");
  assert.match(store, /!product\.hidden && isRepresentative/, "listings me hidden filter");
  assert.match(store, /if \(product\.hidden\) continue;/, "search suggestions me hidden skip");

  const sitemap = read("apps/web/src/app/sitemap.ts");
  assert.match(sitemap, /products\.filter\(\(product\) => !product\.hidden\)/, "sitemap me hidden nahi");

  const catalogSheet = read("apps/web/src/lib/catalog-sheet.ts");
  assert.match(catalogSheet, /Status: product\.hidden \? "hidden" : "active"/, "seed me hidden flag sheet me jaata hai");

  const settingsRoute = read("apps/web/src/app/api/settings/route.ts");
  assert.match(settingsRoute, /deliveryEstimateDays/, "delivery estimate public settings me");

  const sheetHealth = read("apps/web/src/app/api/sheet-health/route.ts");
  assert.match(sheetHealth, /reviewsSheetInfo/, "sheet-health me reviews source");
  assert.match(sheetHealth, /r44-1/, "warning latest script ki baat karta hai");

  const storeSettings = read("apps/web/src/lib/store-settings.ts");
  assert.match(storeSettings, /deliveryEstimateDays: 6/, "default 6 din");
  assert.match(storeSettings, /sheet\.deliveryEstimateDays/, "sheet jeetti hai");

  const reviewsUi = read("apps/web/src/components/product-reviews.tsx");
  assert.match(reviewsUi, /\/api\/reviews/, "form site API par submit hota hai");
  assert.match(reviewsUi, /review-image-add/, "8 tak image links add ho sakte hain");
  assert.match(reviewsUi, /readCheckoutDetails/, "naam/city prefill");

  const orderPage = read("apps/web/src/app/orders/[orderNumber]/page.tsx");
  assert.match(orderPage, /days: settings\.deliveryEstimateDays/, "order page sheet estimate use karta hai");
  assert.match(orderPage, /text: settings\.deliveryEstimateText/);
});
