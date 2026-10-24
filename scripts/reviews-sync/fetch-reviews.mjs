#!/usr/bin/env node
/**
 * Reviews sync — likshaclothing.com ka Trustoo reviews widget.
 *
 * Reviews client-side JS se load hote hain, isliye sandbox se nahi milte.
 * GitHub Actions (daily cron) me ye script chalta hai:
 *   1. live product page se shopId + Trustoo script nikalta hai,
 *   2. Trustoo ke public API endpoints try karta hai,
 *   3. jo mile use `database/seeds/reviews/reviews.json` me likh deta hai.
 *
 * Agar kuch na mile to file waisi hi rehti hai (koi dummy review nahi banate).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "database/seeds/reviews/reviews.json");
const STORE = "https://www.likshaclothing.com";
const UA = "Mozilla/5.0 (compatible; LikshaCatalogSync/1.0)";

const fetchText = async (url, init = {}) => {
  const response = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, ...init });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
};

const fetchJson = async (url) => JSON.parse(await fetchText(url));

const diagnostics = { steps: [], endpoints: [], scriptUrls: [] };
const note = (step, detail) => diagnostics.steps.push(`${step}: ${detail}`);

async function discoverShop() {
  const html = await fetchText(`${STORE}/collections/new-arrivals`);
  note("page", `${html.length} bytes`);
  const shopId =
    html.match(/shop_id\s*=\s*"?(\d{5,})"?/)?.[1] ??
    html.match(/shopId\\?":\s*\\?"(\d{5,})/)?.[1] ??
    "73883451696";
  const apiDomain = html.match(/api\.trustoo\.io|api2?\.trustoo\.io/)?.[0] ?? "api.trustoo.io";
  const appProxy = [...new Set([...html.matchAll(/\/apps\/[a-z0-9/_-]+/gi)].map((m) => m[0]))].slice(0, 25);
  diagnostics.appProxy = appProxy;
  // widget script se endpoint patterns nikalo
  const scriptUrls = [...new Set([...html.matchAll(/https:\/\/cdn\.shopify\.com\/extensions\/[^"'\s]*trustoo[^"'\s]*\.js/g)].map((m) => m[0]))];
  diagnostics.scriptUrls = scriptUrls.slice(0, 6);
  const scriptUrl = scriptUrls[0];
  let endpoints = [];
  if (scriptUrl) {
    try {
      const js = await fetchText(scriptUrl);
      const collected = new Set();
      for (const url of scriptUrls) {
        let body = url === scriptUrl ? js : "";
        if (!body) {
          try {
            body = await fetchText(url);
          } catch {
            continue;
          }
        }
        const patterns = [
          /["'`](\/apps\/[a-z0-9/_.?=&-]+)["'`]/gi,
          /["'`](\/(?:api\/)?v?\d?\/?[a-z0-9/_-]*review[a-z0-9/_-]*)["'`]/gi,
          /https?:\/\/(?:api2?\.)?trustoo\.io[^"'\s`]*/gi,
        ];
        for (const pattern of patterns) {
          for (const match of body.matchAll(pattern)) collected.add(match[0].replace(/^["'`]|["'`]$/g, ""));
        }
        diagnostics.urlsFound = [...collected].slice(0, 60);
      }
      endpoints = [...collected].filter((value) => value.startsWith("/")).slice(0, 25);
      diagnostics.endpoints = endpoints.slice(0, 40);
      diagnostics.scriptBytes = js.length;
      note("widget", `${scriptUrl.slice(-40)} → ${endpoints.length} endpoint hints`);
    } catch (error) {
      console.warn("widget script fetch failed:", error.message);
      note("widget-error", error.message.slice(0, 120));
    }
  }
  return { shopId, apiDomain, endpoints };
}

function normalise(review) {
  return {
    id: String(review.id ?? review._id ?? review.review_id ?? Math.random().toString(36).slice(2)),
    author: review.author ?? review.reviewer_name ?? review.name ?? review.customer_name ?? "Verified buyer",
    rating: Number(review.rating ?? review.score ?? review.star ?? review.review_rating ?? 5),
    title: review.title ?? review.review_title ?? undefined,
    body: String(review.body ?? review.content ?? review.review ?? review.message ?? "").trim(),
    date: review.created_at ?? review.date ?? review.time ?? undefined,
    verified: review.verified ?? review.is_verified ?? true,
    photos: (review.photos ?? review.images ?? review.attachments ?? []).map((photo) =>
      typeof photo === "string" ? photo : (photo?.src ?? photo?.url ?? ""),
    ).filter(Boolean),
    productHandle: review.product_handle ?? review.handle ?? review.productHandle ?? undefined,
  };
}

async function main() {
  const { shopId, apiDomain, endpoints } = await discoverShop();
  console.log({ shopId, apiDomain, endpoints: endpoints.slice(0, 8) });

  const proxyCandidates = (diagnostics.appProxy ?? []).map(
    (proxy) => `${STORE}${proxy}?shop=${shopId}&shop_id=${shopId}&page=1&limit=100`,
  );
  const candidates = [
    ...proxyCandidates,
    `${STORE}/apps/trustoo/api/v1/reviews/get_product_list?shop=${shopId}&shop_id=${shopId}&page=1&limit=100`,
    `${STORE}/apps/trustoo/api/v1/reviews/get_product_list?shop_id=${shopId}&limit=100`,
    `${STORE}/apps/trustoo/api/v1/reviews/list?shop_id=${shopId}&page=1&limit=100`,
    `https://${apiDomain}/api/v1/reviews/get_product_list?shop_id=${shopId}&limit=100`,
    `https://${apiDomain}/api/v1/reviews/collect?shop_id=${shopId}&limit=100`,
    `https://${apiDomain}/api/v1/reviews?shop_id=${shopId}&page=1&limit=100`,
    `https://${apiDomain}/api/reviews?shop_id=${shopId}&page=1&limit=100`,
    `https://${apiDomain}/v1/reviews?shop_id=${shopId}&limit=100`,
    `https://${apiDomain}/api/v1/review?shop_id=${shopId}`,
    ...endpoints.map((endpoint) => `https://${apiDomain}${endpoint}${endpoint.includes("?") ? "&" : "?"}shop_id=${shopId}`),
  ];

  let found = [];
  for (const url of candidates) {
    try {
      const payload = await fetchJson(url);
      const list = payload?.reviews ?? payload?.data?.reviews ?? payload?.data ?? payload?.list ?? [];
      if (Array.isArray(list) && list.length) {
        console.log("hit:", url, "→", list.length, "reviews");
        found = list;
        break;
      }
      diagnostics.probes = [
        ...(diagnostics.probes ?? []),
        `${url.slice(0, 110)} → 200 ${JSON.stringify(payload).slice(0, 220)}`,
      ].slice(-12);
    } catch (error) {
      console.log("miss:", url, error.message.slice(0, 80));
      diagnostics.probes = [...(diagnostics.probes ?? []), `${url.slice(0, 110)} → ${error.message.slice(0, 40)}`].slice(-12);
    }
  }

  const products = {};
  let total = 0;
  for (const item of found.map(normalise)) {
    if (!item.body || !item.productHandle) continue;
    const block = products[item.productHandle] ?? { rating: 0, count: 0, reviews: [] };
    block.reviews.push(item);
    block.count = block.reviews.length;
    block.rating =
      Math.round((block.reviews.reduce((sum, review) => sum + review.rating, 0) / block.count) * 10) / 10;
    products[item.productHandle] = block;
    total += 1;
  }

  const all = Object.values(products).flatMap((block) => block.reviews);
  const file = {
    meta: {
      source: "trustoo",
      shopId,
      syncedAt: new Date().toISOString(),
      note: "scripts/reviews-sync/fetch-reviews.mjs (GitHub Actions daily) is file ko likhta hai — haath se edit na karein.",
    },
    shop: {
      rating: all.length ? Math.round((all.reduce((sum, review) => sum + review.rating, 0) / all.length) * 10) / 10 : 0,
      count: all.length,
    },
    products,
  };

  fs.writeFileSync(
    path.join(ROOT, "database/seeds/reviews/last-sync.json"),
    `${JSON.stringify({ ...diagnostics, found: found.length, saved: total, at: new Date().toISOString() }, null, 1)}\n`,
  );

  if (!total) {
    console.warn("reviews nahi mile — purani file waisi hi rahegi");
    return;
  }
  fs.writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);
  console.log(`saved ${total} reviews across ${Object.keys(products).length} products`);
}

await main();
