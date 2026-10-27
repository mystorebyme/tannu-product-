import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  mergeSheetCatalog,
  productFromSheetRow,
  rupeesToPaiseOrNull,
  slugifyHandle,
  splitList,
  yesNo,
  type SheetProductRow,
} from "../../apps/web/src/lib/catalog-merge";
import {
  applyOwnerConfirmation,
  mergeSheetTracking,
  orderFromSheetRows,
  parseOrderState,
  type SheetTracking,
} from "../../apps/web/src/lib/sheet-merge";
import { trackingUpdates } from "../../apps/web/src/lib/tracking";
import type { Catalog, Order, Product } from "@liksha/types";

/* ───────────────────────── fixtures ───────────────────────── */

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    handle: "td-100",
    sourceHandle: "td-100",
    title: "Base Anarkali",
    price: 59900,
    compareAtPrice: 199900,
    images: ["https://cdn.shopify.com/main.jpg", "https://cdn.shopify.com/second.jpg"],
    collections: ["new-arrivals"],
    category: "anarkali",
    fabric: "Georgette",
    color: "Red",
    sizes: ["S [36]", "M [38]"],
    sizePricing: {
      "S [36]": { price: 59900, compareAtPrice: 199900, available: true },
      "M [38]": { price: 59900, compareAtPrice: 199900, available: false },
    },
    details: [],
    description: "Base description",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    featured: false,
    publishedAt: null,
    ...overrides,
  } as Product;
}

function makeCatalog(products: Product[]): Catalog {
  return {
    meta: {
      store: "Liksha Clothing",
      source: "test",
      cdn: "https://cdn.shopify.com/",
      currency: "INR",
      moneyUnit: "paise",
      builtAt: "2026-10-27T00:00:00.000Z",
      productCount: products.length,
    },
    collections: [
      { handle: "new-arrivals", title: "New Arrivals", subtitle: "", image: "", sortOrder: 1, productCount: products.length },
    ],
    colourGroups: {},
    products,
  } as unknown as Catalog;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "LK-1",
    orderNumber: "LK-1",
    createdAt: "2026-10-27T07:40:00.000Z",
    customerName: "Test",
    email: "t@e.com",
    phone: "9800000000",
    address: "addr",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    notes: null,
    items: [],
    subtotal: 59900,
    discount: 0,
    shipping: 0,
    total: 59900,
    couponCode: null,
    paymentMethod: "prepaid",
    paymentStatus: "pending",
    payment: null,
    status: "placed",
    audit: [],
    ...overrides,
  } as unknown as Order;
}

function sheetTracking(overrides: Partial<SheetTracking> = {}): SheetTracking {
  return {
    orderNumber: "LK-1",
    status: "placed",
    step: 0,
    steps: [],
    paymentStatus: "",
    courier: "",
    awb: "",
    trackingUrl: "",
    note: "",
    updates: [],
    readAt: Date.now(),
    ...overrides,
  };
}

/* ───────────────────────── R43.1: catalog merge (sheet = DB) ───────────────────────── */

test("R43: parse helpers — rupees→paise, list split, yes/no, slug", () => {
  assert.equal(rupeesToPaiseOrNull("599"), 59900);
  assert.equal(rupeesToPaiseOrNull("₹ 1,599.50"), 159950);
  assert.equal(rupeesToPaiseOrNull(599), 59900);
  assert.equal(rupeesToPaiseOrNull(""), null);
  assert.equal(rupeesToPaiseOrNull("abc"), null);
  assert.equal(rupeesToPaiseOrNull("0"), null, "0 price override nahi hoti");
  assert.deepEqual(splitList("a|b | c"), ["a", "b", "c"]);
  assert.deepEqual(splitList("XS [34]\nS [36]"), ["XS [34]", "S [36]"]);
  assert.equal(yesNo("yes", false), true);
  assert.equal(yesNo("no", true), false);
  assert.equal(yesNo("", true), true, "khaali = fallback");
  assert.equal(slugifyHandle(" My New Product!! "), "my-new-product");
});

test("R43: price/image/title override — sheet jeetti hai, base ka baaki data safe", () => {
  const base = makeCatalog([makeProduct()]);
  const merged = mergeSheetCatalog(base, [
    { Id: "td-100", Title: "Naya Naam", Price: "499", "Main image": "https://img.example.com/new.jpg" },
  ]);
  assert.equal(merged.products.length, 1);
  const product = merged.products[0]!;
  assert.equal(product.title, "Naya Naam");
  assert.equal(product.price, 49900, "₹499 → 49900 paise");
  assert.equal(product.images[0], "https://img.example.com/new.jpg", "main image change");
  assert.equal(product.images[1], "https://cdn.shopify.com/second.jpg", "baaki gallery rakhi");
  assert.equal(product.description, "Base description", "jo column bhara nahi, base ka raha");
  assert.equal(product.sizePricing?.["S [36]"]?.price, 49900, "nayi price har size par");
  assert.equal(product.sizePricing?.["M [38]"]?.available, false, "availability base se barkaraar");
  assert.equal(merged.meta.productCount, 1);
});

test("R43: row delete → product site se gaya; hidden → listings se chhupa (R44: flag ke saath catalog me rehta hai)", () => {
  const base = makeCatalog([makeProduct({ handle: "keep" }), makeProduct({ handle: "gone" }), makeProduct({ handle: "hide-me" })]);
  const merged = mergeSheetCatalog(base, [
    { Id: "keep", Status: "active" },
    { Id: "hide-me", Status: "hidden" },
    // "gone" ki row owner ne delete kar di
  ]);
  assert.deepEqual(merged.products.map((product) => product.handle), ["keep", "hide-me"], "row delete → product gaya");
  const hidden = merged.products.find((product) => product.handle === "hide-me");
  assert.equal(hidden?.hidden, true, "hidden row → flag (direct link ke liye product bacha rehta hai)");
  assert.equal(keep(merged).length, 1, "listings me sirf visible");
  assert.equal(merged.collections[0]!.productCount, 1, "collection count live");
  assert.equal(merged.meta.productCount, 1, "meta count me hidden nahi");
});

/** listings = jo hidden nahi (store.ts listed() ka pure equivalent) */
function keep(catalog: Catalog) {
  return catalog.products.filter((product) => !product.hidden);
}

test("R43: nayi row → naya product (sabse upar), title/price zaroori", () => {
  const base = makeCatalog([makeProduct({ handle: "old" })]);
  const merged = mergeSheetCatalog(base, [
    { Id: "old", Status: "active" },
    {
      Id: "Brand New Suit!!",
      Title: "Brand New Suit",
      Price: "1299",
      "Main image": "https://img.example.com/fresh.jpg",
      Sizes: "M [38]|L [40]",
      Collections: "new-arrivals|trending",
      Timestamp: "2026-10-27T08:00:00.000Z",
    },
    { Id: "no-title", Price: "10" }, // title nahi → skip
    { Id: "no-price", Title: "No Price" }, // price nahi → skip
  ]);
  assert.equal(merged.products[0]!.handle, "brand-new-suit", "naya product sabse pehle (latest rails me dikhe)");
  const fresh = merged.products[0]!;
  assert.equal(fresh.title, "Brand New Suit");
  assert.equal(fresh.price, 129900);
  assert.equal(fresh.images[0], "https://img.example.com/fresh.jpg");
  assert.deepEqual(fresh.sizes, ["M [38]", "L [40]"]);
  assert.deepEqual(fresh.collections, ["new-arrivals", "trending"]);
  assert.equal(fresh.sizePricing?.["L [40]"]?.available, true, "nayi sizes available");
  assert.equal(merged.products.length, 2, "bina title/price wali rows skip");
});

test("R43: sheet khaali / rows null → build-time catalog as-is (compat fallback)", () => {
  const base = makeCatalog([makeProduct()]);
  assert.equal(mergeSheetCatalog(base, []), base);
  assert.equal(mergeSheetCatalog(base, null), base);
  // sirf garbage rows → site khaali nahi honi chahiye
  assert.equal(mergeSheetCatalog(base, [{ Id: "" }, { Title: "no id" }]), base);
});

test("R43: sizes override + colour group sync (swatch par nayi price)", () => {
  const groupProduct = makeProduct({ handle: "g-red", colourGroup: "g", color: "Red" });
  const base = makeCatalog([groupProduct]);
  (base as unknown as { colourGroups: Record<string, unknown> }).colourGroups = {
    g: {
      key: "g",
      title: "Group",
      handle: "g-red",
      colours: [
        { name: "Red", handle: "g-red", title: "Base Anarkali", price: 59900, compareAtPrice: 199900, image: "https://cdn.shopify.com/main.jpg", images: [] },
        { name: "Blue", handle: "g-blue", title: "Blue", price: 59900, compareAtPrice: null, image: "", images: [] },
      ],
    },
  };
  const merged = mergeSheetCatalog(base, [
    { Id: "g-red", Price: "799", Sizes: "S [36]|M [38]|L [40]", Colour: "Maroon" },
  ]);
  const product = merged.products[0]!;
  assert.deepEqual(product.sizes, ["S [36]", "M [38]", "L [40]"]);
  assert.equal(product.color, "Maroon");
  // group ka blue colour site par nahi hai (row nahi) → swatch se gaya
  const group = merged.colourGroups.g!;
  assert.equal(group.colours.length, 1);
  assert.equal(group.colours[0]!.handle, "g-red");
  assert.equal(group.colours[0]!.price, 79900, "swatch par bhi nayi price (stale nahi)");
});

test("R43: productFromSheetRow — naya product defaults ke saath", () => {
  const row: SheetProductRow = { Id: "fresh-1", Title: "Fresh One", Price: "899", Description: "Line one\nLine two" };
  const product = productFromSheetRow(row);
  assert.ok(product);
  assert.equal(product!.handle, "fresh-1");
  assert.equal(product!.price, 89900);
  assert.deepEqual(product!.sizes, ["Free Size"], "sizes na di → Free Size default");
  assert.equal(product!.category, "other");
  assert.equal(product!.inStock, true);
  assert.match(product!.descriptionHtml ?? "", /<p>Line one<\/p><p>Line two<\/p>/);
  assert.equal(productFromSheetRow({ Id: "x" }), null, "bina title/price naya product nahi");
});

/* ───────────────────────── R43.2: owner confirm = payment verify ───────────────────────── */

test("R43: applyOwnerConfirmation — prepaid + confirmed/packed/shipped/delivered → paid (store verified)", () => {
  for (const status of ["confirmed", "packed", "shipped", "delivered"] as const) {
    const derived = applyOwnerConfirmation(makeOrder({ status, paymentStatus: "pending" }));
    assert.equal(derived.paymentStatus, "paid", `${status} → paid`);
    assert.equal(derived.payment?.verifiedBy, "store");
  }
  // processing/failed bhi owner-confirm se settle
  assert.equal(applyOwnerConfirmation(makeOrder({ status: "confirmed", paymentStatus: "processing" })).paymentStatus, "paid");
  assert.equal(applyOwnerConfirmation(makeOrder({ status: "confirmed", paymentStatus: "failed" })).paymentStatus, "paid");
});

test("R43: applyOwnerConfirmation — COD, placed, refunded, paid ko chhoo nahi", () => {
  assert.equal(
    applyOwnerConfirmation(makeOrder({ status: "confirmed", paymentStatus: "pending", paymentMethod: "cod" })).paymentStatus,
    "pending",
    "COD par pending sahi hai (paisa delivery par)",
  );
  assert.equal(applyOwnerConfirmation(makeOrder({ status: "placed", paymentStatus: "pending" })).paymentStatus, "pending");
  assert.equal(applyOwnerConfirmation(makeOrder({ status: "confirmed", paymentStatus: "refunded" })).paymentStatus, "refunded");
  assert.equal(applyOwnerConfirmation(makeOrder({ status: "confirmed", paymentStatus: "paid" })).paymentStatus, "paid");
  assert.equal(applyOwnerConfirmation(makeOrder({ status: "cancelled", paymentStatus: "pending" })).paymentStatus, "pending");
});

test("R43: sheet me confirm karte hi order page ka payment 'paid' — CTA hat jaata hai", () => {
  // live bug (LK-QDM2EXQMGO): owner ne sheet me Order status=confirmed kiya,
  // site "Payment pending — Complete payment" dikhata raha.
  const base = makeOrder({ status: "placed", paymentStatus: "pending" });
  const sheet = sheetTracking({
    status: "confirmed",
    step: 1,
    updates: [
      { at: "2026-10-27T07:41:30.000Z", status: "confirmed", event: "order.status_sheet", message: "Sheet se status update (owner)", notes: "" },
      { at: "2026-10-27T07:40:48.000Z", status: "placed", event: "order.placed", message: "", notes: "" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.status, "confirmed");
  assert.equal(merged.paymentStatus, "paid", "owner confirm = payment verified");
  // order page ka CTA condition: paymentStatus !== "paid" → ab button nahi dikhega
  assert.ok(merged.paymentStatus === "paid" || merged.paymentStatus === "refunded");
});

test("R43: compat reconstruct me bhi owner-confirm rule chalta hai", () => {
  const order = orderFromSheetRows("LK-C2", [
    { Timestamp: "2026-10-27T07:40:00.000Z", Event: "order.placed", "Order number": "LK-C2", "Order status": "placed", "Payment status": "pending", "Payment method": "prepaid", Total: "599", Customer: "Test" },
    { Timestamp: "2026-10-27T07:42:00.000Z", Event: "order.status_sheet", "Order number": "LK-C2", "Order status": "confirmed", "Payment status": "pending", Source: "sheet-edit", Notes: "Sheet se status update (owner)" },
  ]);
  assert.ok(order);
  assert.equal(order!.status, "confirmed");
  assert.equal(order!.paymentStatus, "paid", "sheet-row reconstruct par bhi store-verified");
});

/* ───────────────────────── R43.3: owner ka comment har jagah dikhe ───────────────────────── */

test("R43: Admin Note edit → timeline me 'Team update' comment (note_updated mapping)", () => {
  const base = makeOrder();
  const sheet = sheetTracking({
    status: "confirmed",
    step: 1,
    adminNote: "Gift wrap kar dena",
    updates: [
      { at: "2026-10-27T07:45:00.000Z", status: "confirmed", event: "order.admin_note", message: "Gift wrap kar dena", notes: "" },
      { at: "2026-10-27T07:41:00.000Z", status: "confirmed", event: "order.status_sheet", message: "Sheet se status update (owner)", notes: "" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.statusNote?.text, "Gift wrap kar dena", "note-box me owner ka comment");
  const updates = trackingUpdates(merged);
  const noteEntry = updates.find((update) => update.kind === "note" && update.text === "Gift wrap kar dena");
  assert.ok(noteEntry, "timeline me comment dikha");
  // admin_note ab stage-entry nahi banata (pehle order.status.confirmed banta tha)
  const confirmedEntries = updates.filter((update) => update.kind === "status" && update.status === "confirmed");
  assert.ok(confirmedEntries.every((entry) => entry.text !== "Gift wrap kar dena"), "comment stage entry me dabta nahi");
});

test("R43: Notes column me likha owner comment bhi dikhta hai (snapshot ke customer-note se alag)", () => {
  // live bug: owner ne comment Notes column me likha — site par kahin nahi dikha
  const base = makeOrder({ notes: "customer ka note" });
  const sheet = sheetTracking({
    status: "confirmed",
    step: 1,
    updates: [
      { at: "2026-10-27T07:50:00.000Z", status: "confirmed", event: "order.owner_note", message: "Parcel bhej diya hai", notes: "Parcel bhej diya hai" },
      { at: "2026-10-27T07:40:00.000Z", status: "placed", event: "order.placed", message: "customer ka note", notes: "customer ka note" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.statusNote?.text, "Parcel bhej diya hai", "owner ka Notes comment note-box me");
  const updates = trackingUpdates(merged);
  assert.ok(updates.some((update) => update.text === "Parcel bhej diya hai"), "timeline me bhi");
});

test("R43: Admin Note jeetta hai Notes-override par; customer note untouched", () => {
  const base = makeOrder({ notes: "customer ka note" });
  const sheet = sheetTracking({
    adminNote: "Admin Note wala comment",
    updates: [
      { at: "2026-10-27T07:50:00.000Z", status: "placed", event: "order.owner_note", message: "Notes wala comment", notes: "Notes wala comment" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.statusNote?.text, "Admin Note wala comment");
  assert.equal(merged.notes, "customer ka note", "customer ka note override nahi hota");
});

test("R43: owner ne sheet se Payment status=paid kiya → timeline 'Payment received' + comment", () => {
  const base = makeOrder();
  const sheet = sheetTracking({
    updates: [
      { at: "2026-10-27T08:00:00.000Z", status: "placed", event: "order.payment_sheet", message: "Sheet se payment update (owner)", payment: "paid", notes: "Sheet se payment update (owner)" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  const updates = trackingUpdates(merged);
  const payment = updates.find((update) => update.kind === "payment");
  assert.ok(payment, "payment entry bani");
  assert.equal(payment!.label, "Payment received");
  assert.equal(payment!.text, "Sheet se payment update (owner)");
});

test("R43: site ke apne sheet-rows apne event ke saath — claim 'Delivered' label ke neeche nahi (live LK-QDM2EXQMGO bug)", () => {
  // owner ka live screenshot: order sheet me Delivered, par timeline me claim ka
  // message "Delivered · Payment confirm request mili" dikh raha tha — kyunki
  // mergeSheetWins HAR row ko order.status.<slug> bana deta tha.
  const base = makeOrder();
  const sheet = sheetTracking({
    status: "delivered",
    step: 4,
    updates: [
      { at: "2026-10-27T07:50:00.000Z", status: "delivered", event: "order.status_sheet", message: "Sheet se status update (owner)", notes: "" },
      { at: "2026-10-27T07:41:00.000Z", status: "delivered", event: "payment.claimed", message: "Payment confirm request mili — team UPI statement se verify kar rahi hai.", notes: "" },
      { at: "2026-10-27T07:40:00.000Z", status: "placed", event: "order.placed", message: "Order mil gaya — payment ka intezaar hai.", notes: "" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.status, "delivered");
  assert.equal(merged.paymentStatus, "paid", "owner-confirm rule: delivered → paid");

  const updates = trackingUpdates(merged);
  const claim = updates.find((update) => update.text?.includes("Payment confirm request"));
  assert.ok(claim, "claim entry dikhti hai");
  assert.equal(claim!.kind, "payment", "claim ab payment-kind entry hai");
  assert.equal(claim!.label, "Payment claim");
  const deliveredStatuses = updates.filter((update) => update.kind === "status" && update.status === "delivered");
  assert.ok(
    deliveredStatuses.every((entry) => !entry.text?.includes("Payment confirm")),
    "claim ka message Delivered stage label ke neeche nahi",
  );
  // owner ke status-edit row se Delivered stage entry banti rahe
  assert.ok(deliveredStatuses.length >= 1, "sheet status-edit ki Delivered entry");
  // site ka order.placed row ab "Placed" dikhata hai (pehle status-mapping me dubara placed banta tha)
  const placed = updates.find((update) => update.kind === "status" && update.status === "placed");
  assert.ok(placed, "placed entry hai");
  assert.equal(placed!.label, "Placed");
  assert.equal(placed!.text, "Order mil gaya — payment ka intezaar hai.");
});

test("R43: default Admin Note 'Waiting for confirmation' owner ke Notes-comment ko chhupa nahi sakta", () => {
  const base = makeOrder();
  const sheet = sheetTracking({
    adminNote: "Waiting for confirmation", // sheet me default hi likha reh gaya
    updates: [
      { at: "2026-10-27T07:50:00.000Z", status: "placed", event: "", message: "", notes: "Parcel nikal gaya hai — kal tak mil jayega" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.statusNote?.text, "Parcel nikal gaya hai — kal tak mil jayega");
});

test("R43: site ke canned-message rows owner-comment na banein (rowNote sirf owner rows se)", () => {
  const base = makeOrder();
  const sheet = sheetTracking({
    updates: [
      { at: "2026-10-27T07:50:00.000Z", status: "delivered", event: "order.status_sheet", message: "Sheet se status update (owner)", notes: "Sheet se status update (owner)" },
      { at: "2026-10-27T07:41:00.000Z", status: "placed", event: "payment.claimed", message: "Payment confirm request mili", notes: "Payment confirm request mili" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  assert.equal(merged.statusNote?.text ?? "", "", "note-box me canned message owner-comment bankar nahi dikhega");
});

test("R43: payment.failed / reference_submitted rows ke apne labels", () => {
  const base = makeOrder();
  const sheet = sheetTracking({
    updates: [
      { at: "2026-10-27T07:50:00.000Z", status: "placed", event: "payment.reference_submitted", message: "", notes: "" },
      { at: "2026-10-27T07:45:00.000Z", status: "placed", event: "payment.failed", message: "Payment verify nahi ho paya", notes: "" },
    ],
  });
  const merged = mergeSheetTracking(base, sheet);
  const updates = trackingUpdates(merged);
  const failed = updates.find((update) => update.label === "Payment failed");
  assert.ok(failed, "failed entry dikhti hai");
  assert.equal(failed!.text, "Payment verify nahi ho paya");
  const ref = updates.find((update) => update.label === "Payment reference");
  assert.ok(ref, "reference entry dikhti hai");
});

/* ───────────────────────── R43.4: Order JSON restore (items Rs. 0 bug) ───────────────────────── */

test("R43: rows me Order JSON ho to compat path bhi snapshot se items/price lauta hai", () => {
  // live bug (LK-QDM2EXQMGO): order_state timeout → compat reconstruct me
  // items Rs. 0 / khaali link / placeholder image. Fix: rows ke Order JSON se parse.
  const snapshot = makeOrder({
    items: [{ handle: "td-100", title: "Anarkali", size: "M [38]", quantity: 1, price: 59900, image: "https://cdn.shopify.com/main.jpg" }],
  });
  const rows = [
    {
      Timestamp: "2026-10-27T07:40:00.000Z",
      Event: "order.placed",
      "Order number": "LK-J1",
      "Order status": "placed",
      "Payment status": "pending",
      "Item details": "Anarkali (M [38]) x1",
      "Order JSON": JSON.stringify(snapshot),
    },
  ];
  const parsed = parseOrderState({ orderNumber: "LK-J1", rows });
  assert.ok(parsed);
  assert.equal(parsed!.items[0]!.price, 59900, "price snapshot se (Rs. 0 nahi)");
  assert.equal(parsed!.items[0]!.handle, "td-100", "product link snapshot se");
  assert.equal(parsed!.items[0]!.image, "https://cdn.shopify.com/main.jpg");
});

/* ───────────────────────── R43.5: source guards (wiring) ───────────────────────── */

test("R43: script r43-1 — Products tab, catalog/products_seed actions, onEdit watchers", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  assert.match(gs, /var CODE_VERSION = 'r4\d-\d+';/);
  assert.match(gs, /Products: \[\n    'Timestamp', 'Id', 'Title', 'Price'/, "Products HEADERS");
  assert.match(gs, /action === 'catalog' \|\| action === 'products'/, "GET catalog action");
  assert.match(gs, /action === 'products_seed'/, "POST seed action");
  assert.match(gs, /function seedProducts_/);
  assert.match(gs, /sheet\.getLastRow\(\) >= 2/, "seed sirf khaali tab par (owner data safe)");
  assert.match(gs, /Event: 'order\.owner_note'/, "onEdit Notes watcher");
  assert.match(gs, /Event: 'order\.payment_sheet'/, "onEdit Payment status watcher");
  assert.match(gs, /Products: \{\n    Status: \['active', 'hidden'\]/, "Products dropdowns");
});

test("R43: site wiring — loader, seed trigger, store live data, dynamicParams", () => {
  const loader = read("apps/web/src/lib/catalog-sheet.ts");
  assert.match(loader, /SHEET_CATALOG_MIN_MAJOR = 43/, "seed r43+ script par hi");
  assert.match(loader, /products_seed/, "seed POST");
  assert.match(loader, /10 \* 60_000/, "seed rate limit");
  assert.match(loader, /mergeSheetCatalog/, "merge loader me");
  assert.match(loader, /edgeRead|EDGE_CACHE_KEY/, "workerd cold isolate ke liye edge cache");

  const sheets = read("apps/web/src/lib/google-sheets.ts");
  assert.match(sheets, /healMajor >= 43/, "health probe se catalog read/seed trigger");

  const store = read("apps/web/src/lib/store.ts");
  assert.match(store, /PAGES_PREVIEW === "1"/, "static export me baked (GH Pages safe)");
  assert.match(store, /connection\(\)/, "Vercel par pages dynamic rehte hain (live price)");
  assert.match(store, /getLiveCatalog/, "sheet overlay");
  assert.match(store, /\$\{product\.handle\}/, "search me product id/handle (owner: id se search)");

  const productPage = read("apps/web/src/app/products/[handle]/page.tsx");
  assert.match(productPage, /dynamicParams = true/, "sheet ka naya product bina rebuild khule");

  const ordersSheet = read("apps/web/src/lib/orders-sheet.ts");
  assert.match(ordersSheet, /lastOrderJson/, "compat fallback me Order JSON restore");

  const health = read("apps/web/src/app/api/sheet-health/route.ts");
  assert.match(health, /catalogSheetInfo/, "owner /api/sheet-health par catalog source dekh sake");

  // checkout sheet ki price charge kare — build-time catalog ki nahi
  const orders = read("apps/web/src/lib/orders.ts");
  assert.match(orders, /const products = await allProducts\(\);/, "createOrder live catalog se price recompute karta hai");
  assert.ok(!orders.includes('import { products } from "./store"'), "sync baked catalog import gaya");

  const searchPage = read("apps/web/src/app/search/page.tsx");
  assert.match(searchPage, /\$\{product\.handle\} \$\{product\.title\}/, "search page par id/handle se search");

  const preview = read("scripts/pages/build-preview.mjs");
  assert.match(preview, /dynamicParams = false/, "GH Pages export ke dauraan dynamicParams swap");
});
