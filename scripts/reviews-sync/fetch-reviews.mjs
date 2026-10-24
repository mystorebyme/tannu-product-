#!/usr/bin/env node
/**
 * Reviews sync — likshaclothing.com ka Trustoo reviews widget.
 *
 * Reviews client-side JS se load hote hain, isliye sandbox se direct nahi milte.
 * GitHub Actions (roz 02:30 IST) me ye script chalta hai:
 *   1. storefront se Trustoo app-proxy endpoint dhundhta hai,
 *   2. `/apps/trustoo/api/v1/reviews/get_product_list` se review-wale products,
 *   3. har product ke reviews,
 *   4. Shopify product_id → hamare handle (live snapshot se) map karke
 *      `database/seeds/reviews/reviews.json` likhta hai.
 *
 * Kuch na mile to purani file waisi hi rehti hai (koi dummy review nahi).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "database/seeds/reviews/reviews.json");
const LIVE = path.join(ROOT, "database/seeds/live/products.json");
const STORE = "https://www.likshaclothing.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Trustoo ka known asset base — storefront block ho jaye to yahan se endpoints milte hain */
const KNOWN_BUNDLES = [
  "https://cdn.shopify.com/extensions/01a15e0a-e410-7740-a068-d265bda59b79/cwilltrustoo-reviews-292/assets/swiper-reviews.min.js",
  "https://cdn.shopify.com/extensions/01a15e0a-e410-7740-a068-d265bda59b79/cwilltrustoo-reviews-292/assets/trustoo-sign.min.js",
  "https://cdn.shopify.com/extensions/01a15e0a-e410-7740-a068-d265bda59b79/cwilltrustoo-reviews-292/assets/seal-review.min.js",
];

const diagnostics = { steps: [], probes: [], at: new Date().toISOString() };
const note = (step, detail) => diagnostics.steps.push(`${step}: ${detail}`);

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": UA, accept: "application/json,text/html" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchJson(url) {
  const body = await fetchText(url);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`not json (${body.slice(0, 40)})`);
  }
}

/** product_id → handle (live snapshot se) */
function handleMap() {
  if (!fs.existsSync(LIVE)) return new Map();
  const live = JSON.parse(fs.readFileSync(LIVE, "utf8"));
  const map = new Map();
  for (const product of live.products ?? []) map.set(String(product.id), product.handle);
  return map;
}

const asList = (payload) =>
  payload?.data?.list ??
  payload?.data?.reviews ??
  payload?.data?.items ??
  payload?.data ??
  payload?.list ??
  payload?.reviews ??
  [];

function normaliseReview(raw) {
  const photos = (raw.photos ?? raw.images ?? raw.attachments ?? raw.review_images ?? [])
    .map((photo) => (typeof photo === "string" ? photo : (photo?.src ?? photo?.url ?? "")))
    .filter(Boolean)
    .map((src) => (src.startsWith("//") ? `https:${src}` : src));
  return {
    id: String(raw.id ?? raw.review_id ?? raw._id ?? Math.random().toString(36).slice(2)),
    author: raw.author ?? raw.reviewer_name ?? raw.customer_name ?? raw.name ?? "Verified buyer",
    rating: Number(raw.rating ?? raw.score ?? raw.star ?? raw.review_rating ?? 5),
    title: raw.title ?? raw.review_title ?? undefined,
    body: String(raw.body ?? raw.content ?? raw.review ?? raw.message ?? raw.comment ?? "").trim(),
    date: raw.created_at ?? raw.date ?? raw.time ?? raw.review_date ?? undefined,
    verified: raw.verified ?? raw.is_verified ?? true,
    photos,
  };
}

async function main() {
  const html = await fetchText(`${STORE}/collections/new-arrivals`);
  const shopId =
    html.match(/shop_id\s*=\s*"?(\d{5,})"?/)?.[1] ??
    html.match(/shopId\\?":\s*\\?"(\d{5,})/)?.[1] ??
    "73883451696";
  const proxy = `${STORE}/apps/trustoo/api/v1/reviews`;
  note("page", `${html.length} bytes, shop ${shopId}`);

  const handles = handleMap();
  note("catalog", `${handles.size} product ids`);

  // 1) review-wale products
  const productEntries = [];
  for (let page = 1; page <= 6; page += 1) {
    let payload;
    try {
      payload = await fetchJson(`${proxy}/get_product_list?shop_id=${shopId}&page=${page}&limit=50`);
    } catch (error) {
      diagnostics.probes.push(`product_list p${page} → ${error.message.slice(0, 60)}`);
      break;
    }
    const list = asList(payload);
    if (!list.length) {
      if (page === 1) diagnostics.probes.push(`product_list shape ${JSON.stringify(payload).slice(0, 300)}`);
      break;
    }
    productEntries.push(...list);
    const totalPages = payload?.data?.page?.total_page ?? 1;
    if (page >= totalPages) break;
  }
  note("products-with-reviews", productEntries.length);
  if (productEntries[0]) diagnostics.probes.push(`sample product ${JSON.stringify(productEntries[0]).slice(0, 700)}`);

  // 1b) bundle se saare review endpoints nikaal ke probe karo (shape samajhne ke liye)
  const endpointNames = new Set();
  const bundleUrls = [
    ...new Set([
      ...KNOWN_BUNDLES,
      ...[...html.matchAll(/https:\/\/cdn\.shopify\.com\/extensions\/[^"'\s]*trustoo[^"'\s]*\.js/g)].map((m) => m[0]),
    ]),
  ];
  for (const bundleUrl of bundleUrls) {
    try {
      const js = await fetchText(bundleUrl);
      for (const match of js.matchAll(/api\/v1\/reviews\/([a-z0-9_]+)/gi)) endpointNames.add(match[1]);
    } catch {
      /* ignore */
    }
  }
  // bundles me sirf 4 endpoints milte hain — baaki naam guess karke probe karte hain
  for (const name of PROBE_NAMES) endpointNames.add(name);
  diagnostics.endpointNames = [...endpointNames];
  const PROBE_NAMES = [
    "get_product_reviews",
    "get_reviews",
    "product_reviews",
    "review_list",
    "get_review_list",
    "get_product_detail",
    "get_product",
    "get_all_reviews",
    "get_shop_reviews",
    "get_store_reviews",
    "reviews",
    "get_review",
    "get_product_review",
    "get_reviews_by_product",
  ];
  for (const name of PROBE_NAMES) endpointNames.add(name);
  const PROBE_PREFIXES = ["reviews", "review"];
  diagnostics.endpointNames = [...endpointNames];

  const sampleProductId = String(productEntries[0]?.id ?? "");
  diagnostics.probes = [];
  const probeUrls = [];
  for (const prefix of PROBE_PREFIXES) {
    for (const name of [...endpointNames].slice(0, 24)) {
      probeUrls.push(`${STORE}/apps/trustoo/api/v1/${prefix}/${name}`);
    }
  }
  for (const name of [...endpointNames].slice(0, 24)) {
    probeUrls.push(`${STORE}/apps/trustoo/api/v1/reviews/${name}`);
  }
  for (const base of probeUrls.slice(0, 40)) {
    const url = `${base}?shop_id=${shopId}&product_id=${sampleProductId}&page=1&limit=20`;
    try {
      const payload = await fetchJson(url);
      const snippet = JSON.stringify(payload).slice(0, 220);
      if (!/404|not found/i.test(snippet)) diagnostics.probes.push(`${base.replace(STORE, "")} → ${snippet}`);
    } catch (error) {
      if (!error.message.startsWith("404")) diagnostics.probes.push(`${base.replace(STORE, "")} → ${error.message.slice(0, 50)}`);
    }
  }
  note("probed-endpoints", endpointNames.size);

  // 2) har product ke reviews
  const products = {};
  let total = 0;
  let reviewedProducts = 0;
  for (const entry of productEntries) {
    const productId = String(entry.product_id ?? entry.productId ?? entry.id ?? "");
    const handle = handles.get(productId);
    if (!productId || !handle) continue;

    let reviews = [];
    const reviewEndpoints = [...endpointNames].filter((name) => !/product_list|collect/.test(name));
    for (const name of reviewEndpoints.slice(0, 6)) {
      if (reviews.length) break;
      try {
        const payload = await fetchJson(`${proxy}/${name}?shop_id=${shopId}&product_id=${productId}&page=1&limit=50`);
        reviews = asList(payload).map(normaliseReview).filter((review) => review.body);
      } catch {
        /* next endpoint */
      }
    }
    if (!reviews.length) continue;

    // ek hi product par duplicate reviews na aayein
    const seen = new Set();
    reviews = reviews.filter((review) => {
      const key = `${review.author}-${review.body.slice(0, 60)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    products[handle] = {
      rating: Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10,
      count: reviews.length,
      reviews,
    };
    reviewedProducts += 1;
    total += reviews.length;
  }

  const aggregates = {};
  for (const entry of productEntries) {
    const productId = String(entry.product_id ?? entry.productId ?? entry.id ?? "");
    const handle = handles.get(productId);
    if (!handle) continue;
    const rating = Number(entry.rating ?? entry.avg_rating ?? entry.average_rating ?? entry.star ?? 0);
    const count = Number(entry.review_count ?? entry.count ?? entry.total ?? entry.reviews_count ?? 0);
    if (rating > 0 && count > 0) aggregates[handle] = { rating: Math.round(rating * 10) / 10, count };
  }
  fs.writeFileSync(
    path.join(ROOT, "database/seeds/reviews/aggregates.json"),
    `${JSON.stringify({ syncedAt: new Date().toISOString(), products: aggregates }, null, 1)}\n`,
  );
  note("aggregates", Object.keys(aggregates).length);

  const all = Object.values(products).flatMap((block) => block.reviews);
  fs.writeFileSync(
    path.join(ROOT, "database/seeds/reviews/last-sync.json"),
    `${JSON.stringify({ ...diagnostics, reviewedProducts, total }, null, 1)}\n`,
  );

  if (!total) {
    console.warn("reviews nahi mile — purani file waisi hi rahegi");
    console.log(diagnostics.probes.slice(-6));
    return;
  }

  const file = {
    meta: {
      source: "trustoo",
      shopId,
      syncedAt: new Date().toISOString(),
      note: "scripts/reviews-sync/fetch-reviews.mjs (GitHub Actions daily) is file ko likhta hai — haath se edit na karein.",
    },
    shop: {
      rating: Math.round((all.reduce((sum, review) => sum + review.rating, 0) / all.length) * 10) / 10,
      count: all.length,
    },
    products,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);
  console.log(`saved ${total} reviews across ${reviewedProducts} products`);
}

await main();
