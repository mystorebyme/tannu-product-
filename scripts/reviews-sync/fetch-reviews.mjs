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
const UA = "Mozilla/5.0 (compatible; LikshaReviewsSync/1.0)";

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
  if (productEntries[0]) diagnostics.probes.push(`sample product ${JSON.stringify(productEntries[0]).slice(0, 300)}`);

  // 2) har product ke reviews
  const products = {};
  let total = 0;
  let reviewedProducts = 0;
  for (const entry of productEntries) {
    const productId = String(entry.product_id ?? entry.productId ?? entry.id ?? "");
    const handle = handles.get(productId);
    if (!productId || !handle) continue;

    let reviews = [];
    for (const query of [
      `product_id=${productId}&page=1&limit=50`,
      `product_id=${productId}&page=1&limit=50&sort=newest`,
    ]) {
      try {
        const payload = await fetchJson(`${proxy}/get_reviews?shop_id=${shopId}&${query}`);
        reviews = asList(payload).map(normaliseReview).filter((review) => review.body);
        if (reviews.length) break;
      } catch (error) {
        diagnostics.probes.push(`reviews ${handle} → ${error.message.slice(0, 50)}`);
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
