/**
 * R27 guards — owner ke is round ke asks ka code-level proof:
 *   1. Traffic counter (apna, first-party) — path/referrer/bot normalisation.
 *   2. Google Search Console verification dono tareeke se lagi ho.
 *   3. Analytics (Vercel + optional GA4) aur center-logo classes code me hon.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isBotUserAgent,
  normalisePath,
  normaliseReferrer,
} from "../../apps/web/src/lib/traffic-format";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("traffic: query/hash hata kar saaf path bachta hai", () => {
  assert.equal(normalisePath("/collections/sale?utm=1#top"), "/collections/sale");
  assert.equal(normalisePath("/products/anarkali/"), "/products/anarkali");
  assert.equal(normalisePath("/"), "/");
});

test("traffic: API/admin/internal routes count nahi hote", () => {
  assert.equal(normalisePath("/api/orders"), null);
  assert.equal(normalisePath("/_next/static/chunk.js"), null);
  assert.equal(normalisePath("/admin"), null);
  assert.equal(normalisePath("collections"), null);
});

test("traffic: referrer chhote label me badalta hai", () => {
  assert.equal(normaliseReferrer("https://www.google.com/search?q=anarkali"), "google");
  assert.equal(normaliseReferrer("https://l.instagram.com/?u=x"), "instagram");
  assert.equal(normaliseReferrer("https://wa.me/918005900581"), "whatsapp");
  assert.equal(normaliseReferrer("https://likshaclothing.com/"), "internal");
  assert.equal(normaliseReferrer(""), "direct");
  assert.equal(normaliseReferrer("kuch bhi"), "direct");
  assert.equal(normaliseReferrer("https://example.com/x"), "other");
});

test("traffic: bots aur preview traffic count nahi hota", () => {
  assert.ok(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"));
  assert.ok(isBotUserAgent(""));
  assert.ok(!isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"));
});

test("GSC verification meta tag + HTML file dono maujood hain", () => {
  const layout = read("apps/web/src/app/layout.tsx");
  assert.match(layout, /hFaqyp-9LdUXSKPA9RF011TkO2m_-7AUMasXqm_0dGI/);
  assert.match(layout, /verification\s*:/);
  const file = read("apps/web/public/googleb3b0e3defc1daa17.html");
  assert.match(file, /google-site-verification: googleb3b0e3defc1daa17\.html/);
});

test("logo header aur footer me center hai", () => {
  const header = read("apps/web/src/components/site-header.tsx");
  assert.match(header, /grid-cols-\[1fr_auto_1fr\]/);
  assert.match(header, /lg:col-start-2/);
  const footer = read("apps/web/src/components/site-footer.tsx");
  assert.match(footer, /items-center justify-center text-center/);
});

test("analytics: Vercel scripts + apna page-view beacon dono lage hain", () => {
  const analytics = read("apps/web/src/components/analytics.tsx");
  assert.match(analytics, /\/_vercel\/insights\/script\.js/);
  assert.match(analytics, /\/_vercel\/speed-insights\/script\.js/);
  assert.match(analytics, /PageViewTracker/);
  assert.match(analytics, /NEXT_PUBLIC_GA_ID/);
  const tracker = read("apps/web/src/components/page-view-tracker.tsx");
  assert.match(tracker, /sendBeacon/);
  assert.match(tracker, /\/api\/track/);
});

test("traffic table migration maujood hai (DB par data sambhalne ke liye)", () => {
  const schema = read("apps/web/src/lib/db-schema.ts");
  assert.match(schema, /0009_traffic\.sql/);
  assert.match(schema, /create table if not exists traffic_daily/);
  assert.match(schema, /create table if not exists traffic_visitors/);
});
