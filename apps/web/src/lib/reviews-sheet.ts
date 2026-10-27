import "server-only";

import type { ProductReviewBlock } from "./reviews";
import { reviewsFor } from "./reviews";
import {
  bakedReviewSeedRows,
  reviewFromSheetRow,
  reviewSubmissionErrors,
  type ReviewSubmission,
  type SheetReview,
} from "./reviews-format";
import { runInBackground } from "./background";
import {
  SHEET_READ_TIMEOUT,
  googleSheetsConfig,
  scriptGet,
  scriptPost,
  sheetsConfigured,
} from "./google-sheets";

/**
 * R44 (owner): **"review dikhna chiye or new review ko approv krte hi vo site
 * pr product pr live ho jana chiye … review mai image bi add kr shke … review
 * delet krte hi vi delet ho jana chiye … sheet ka data hardcoded nahi hona chiye"**
 *
 * Reviews ka database = sheet ka **Reviews tab**:
 *   • READ  — `?action=reviews` (approved-only) — 30s TTL + stale-while-revalidate
 *             + last-good fallback. Sheet down → purane baked (Trustoo-sync)
 *             reviews dikhte rehte hain; customer ko kabhi error nahi.
 *   • SEED  — Reviews tab KHAALI mile (owner ne r44-1 paste kiya) to site apne
 *             purane baked reviews ek hi baar sheet me bhar deti hai (`reviews_seed`,
 *             sab `approved`) — uske baad sheet hi source of truth hai: row
 *             delete = review site se gaya.
 *   • WRITE — customer ka naya review `review_add` se `pending` jaata hai; owner
 *             panel (/exec) ya sheet me Status=approved karte hi live.
 *
 * Pure helpers (mapping/validation/seed rows) `reviews-format.ts` me hain.
 */

const REVIEWS_TTL_MS = envNumber("SHEET_REVIEWS_TTL_MS", 30_000);
const REVIEWS_STALE_MAX_MS = envNumber("SHEET_REVIEWS_STALE_MS", 6 * 60 * 60_000);
/** ~1700 reviews seed — script ko 2 minute ka waqt. */
const SEED_TIMEOUT_MS = 120_000;
/** Reviews tab seed site tabhi maangti hai jab script r44+ ho (reviews action wala). */
export const SHEET_REVIEWS_MIN_MAJOR = 44;
/** Site par ek request me zyada se zyada itne approved reviews. */
const REVIEWS_FETCH_LIMIT = 3000;

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
}

type ReviewsCache = {
  /** approved sheet reviews (null = kabhi nahi mile) */
  reviews: SheetReview[] | null;
  at: number;
  failedAt: number;
  ms: number;
  count: number;
  error: string | null;
};

let cache: ReviewsCache | null = null;
let inflight: Promise<SheetReview[] | null> | null = null;
let lastBackgroundAt = 0;
let lastSeedAt = 0;
let seedInflight = false;

/* ───────────────────────── edge cache (Cloudflare Workers) ───────────────────────── */

const EDGE_CACHE_KEY = "https://sheet-reviews.liksha.internal/reviews.json";

function edgeCache(): Cache | null {
  try {
    const api = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
    return api && typeof api.default?.match === "function" ? api.default : null;
  } catch {
    return null;
  }
}

async function edgeRead(): Promise<{ reviews: SheetReview[]; at: number } | null> {
  const store = edgeCache();
  if (!store) return null;
  try {
    const response = await store.match(EDGE_CACHE_KEY, { ignoreMethod: true });
    if (!response) return null;
    const payload = (await response.json()) as { reviews?: SheetReview[]; at?: number };
    if (!Array.isArray(payload?.reviews) || typeof payload?.at !== "number") return null;
    if (Date.now() - payload.at > REVIEWS_STALE_MAX_MS) return null;
    return { reviews: payload.reviews, at: payload.at };
  } catch {
    return null;
  }
}

function edgeWrite(reviews: SheetReview[]) {
  const store = edgeCache();
  if (!store) return;
  void (async () => {
    try {
      await store.put(
        EDGE_CACHE_KEY,
        new Response(JSON.stringify({ reviews, at: Date.now() }), {
          headers: {
            "content-type": "application/json",
            "cache-control": `public, s-maxage=${Math.round(REVIEWS_STALE_MAX_MS / 1000)}`,
          },
        }),
      );
    } catch {
      /* local workerd / dev par Cache API likhne nahi deti — ignore */
    }
  })();
}

/* ───────────────────────── diagnostics ───────────────────────── */

export type ReviewsSheetInfo = {
  configured: boolean;
  /** "sheet" = Reviews tab se live, "baked" = build-time reviews fallback */
  source: "sheet" | "baked";
  count: number;
  ageMs: number | null;
  stale: boolean;
  lastReadMs: number;
  lastError: string | null;
  ttlMs: number;
};

/** /api/sheet-health: reviews abhi kahan se aa rahe hain. */
export function reviewsSheetInfo(): ReviewsSheetInfo {
  const now = Date.now();
  const ageMs = cache?.reviews ? now - cache.at : null;
  return {
    configured: Boolean(googleSheetsConfig()),
    source: cache?.reviews ? "sheet" : "baked",
    count: cache?.reviews?.length ?? 0,
    ageMs,
    stale: ageMs === null ? true : ageMs >= REVIEWS_TTL_MS,
    lastReadMs: cache?.ms ?? 0,
    lastError: cache?.error ?? null,
    ttlMs: REVIEWS_TTL_MS,
  };
}

/* ───────────────────────── read path ───────────────────────── */

/**
 * Sheet ke approved reviews (TTL + SWR + last-good). `null` = sheet configured
 * nahi / kabhi read nahi hui — caller baked reviews par chala jaata hai.
 */
export async function readSheetReviews(options: { fresh?: boolean } = {}): Promise<SheetReview[] | null> {
  if (!cache) {
    const edge = await edgeRead();
    if (edge) cache = { reviews: edge.reviews, at: edge.at, failedAt: 0, ms: 0, count: edge.reviews.length, error: null };
  }
  const now = Date.now();
  if (!options.fresh && cache) {
    if (cache.reviews && now - cache.at < REVIEWS_TTL_MS) return cache.reviews;
    // haal hi me fail hua → TTL tak dobara network nahi (har page atke na)
    if (cache.failedAt && now - cache.failedAt < REVIEWS_TTL_MS) return cache.reviews;
    if (cache.reviews && now - cache.at < REVIEWS_STALE_MAX_MS) {
      revalidateReviewsInBackground();
      return cache.reviews;
    }
  }
  if (!googleSheetsConfig()) return cache?.reviews ?? null;
  return readReviewsNow();
}

function revalidateReviewsInBackground() {
  const now = Date.now();
  if (inflight || now - lastBackgroundAt < 1_000) return;
  lastBackgroundAt = now;
  runInBackground(() => readReviewsNow().catch(() => undefined));
}

function readReviewsNow(): Promise<SheetReview[] | null> {
  if (inflight) return inflight;
  const run = fetchReviews().finally(() => {
    inflight = null;
  });
  inflight = run;
  return run;
}

async function fetchReviews(): Promise<SheetReview[] | null> {
  const startedAt = Date.now();
  const result = await scriptGet<{
    reviews?: SheetReview[];
    empty?: boolean;
    version?: string;
  }>("reviews", { limit: String(REVIEWS_FETCH_LIMIT) }, { timeoutMs: SHEET_READ_TIMEOUT * 2 });
  if (!result.ok) {
    const previous = cache?.reviews ?? null;
    cache = {
      reviews: previous,
      at: previous ? (cache?.at ?? 0) : 0,
      failedAt: Date.now(),
      ms: Date.now() - startedAt,
      count: previous?.length ?? 0,
      error: result.error,
    };
    console.warn(`[reviews] sheet read failed (${Date.now() - startedAt}ms): ${result.error}`);
    return previous;
  }
  const reviews = Array.isArray(result.data.reviews) ? result.data.reviews : [];
  if (result.data.empty) {
    // Reviews tab khaali — owner ne r44-1 paste kiya par reviews abhi sheet me
    // nahi. Site apne purane (Trustoo-sync) reviews khud seed kar deti hai (ek
    // baar, background me). Tab tak baked reviews dikhte rehte hain.
    const major = Number(/^r(\d+)/.exec(String(result.data.version ?? ""))?.[1] ?? 0);
    maybeSeedReviews(major);
    const previous = cache?.reviews ?? null;
    cache = {
      reviews: previous,
      at: previous ? (cache?.at ?? 0) : 0,
      failedAt: Date.now(),
      ms: Date.now() - startedAt,
      count: previous?.length ?? 0,
      error: previous ? null : "Reviews tab khaali — seed ho raha hai",
    };
    return previous;
  }
  cache = { reviews, at: Date.now(), failedAt: 0, ms: Date.now() - startedAt, count: reviews.length, error: null };
  edgeWrite(reviews);
  return reviews;
}

/* ───────────────────────── product page block ───────────────────────── */

/**
 * Product page ka live review block:
 *   • sheet live → sirf sheet ke approved reviews (row delete = review gaya)
 *   • sheet down/khaali/purana script → baked Trustoo-sync reviews (compat)
 */
export async function liveReviewBlock(handle: string): Promise<ProductReviewBlock> {
  if (process.env.PAGES_PREVIEW === "1") return reviewsFor(handle);
  if (!sheetsConfigured()) return reviewsFor(handle);
  let reviews: SheetReview[] | null = null;
  try {
    reviews = await readSheetReviews();
  } catch {
    reviews = null;
  }
  if (!reviews) return reviewsFor(handle);
  const wanted = handle.trim().toLowerCase();
  const forHandle = reviews
    .filter((row) => String(row.handle || row.product).trim().toLowerCase() === wanted && String(row.review || "").trim())
    .map(reviewFromSheetRow);
  if (!forHandle.length) return { rating: 0, count: 0, reviews: [] };
  const rating = forHandle.reduce((sum, review) => sum + review.rating, 0) / forHandle.length;
  return {
    rating: Math.round(rating * 10) / 10,
    count: forHandle.length,
    reviews: forHandle,
  };
}

/* ───────────────────────── seed path ───────────────────────── */

/** Reviews tab khaali + script r44+ → baked reviews sheet me bhar do. */
function maybeSeedReviews(scriptMajor: number) {
  if (scriptMajor < SHEET_REVIEWS_MIN_MAJOR) return; // purana script — reviews_seed action hi nahi
  const now = Date.now();
  if (seedInflight || now - lastSeedAt < 10 * 60_000) return;
  lastSeedAt = now;
  seedInflight = true;
  runInBackground(() =>
    seedReviewsToSheet()
      .catch((error: Error) => console.warn(`[reviews] seed failed: ${error.message}`))
      .finally(() => {
        seedInflight = false;
      }),
  );
}

/** Baked reviews.json → Reviews tab ki rows (sab approved — purane asli reviews). */
export async function seedReviewsToSheet(): Promise<boolean> {
  const config = googleSheetsConfig();
  if (!config) return false;
  const rows = bakedReviewSeedRows();
  if (!rows.length) return false;
  console.info(`[reviews] Reviews tab khaali — ${rows.length} reviews seed ho rahe hain…`);
  const result = await scriptPost<{ seeded?: number; skipped?: boolean }>(
    "reviews_seed",
    { reviews: rows, actor: "site-auto" },
    { timeoutMs: SEED_TIMEOUT_MS },
  );
  if (result.ok) {
    console.info(`[reviews] seed ok (${result.data.seeded ?? 0} rows${result.data.skipped ? ", skipped" : ""})`);
    return true;
  }
  console.warn(`[reviews] seed failed: ${result.error}`);
  return false;
}

/* ───────────────────────── write path (customer ka naya review) ───────────────────────── */

export { reviewFromSheetRow, reviewSubmissionErrors, type ReviewSubmission, type SheetReview };

/**
 * Customer ka review sheet me `pending` likho — owner approve karte hi live.
 * Site kabhi directly publish nahi karti (owner rule: moderation sheet/panel se).
 */
export async function submitReview(input: ReviewSubmission): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const images = (input.images ?? []).map((image) => String(image).trim()).filter(Boolean).slice(0, 8);
  const result = await scriptPost<{ ok?: boolean; duplicate?: boolean; id?: string }>(
    "review_add",
    {
      product: input.handle,
      handle: input.handle,
      customer: input.name.trim(),
      city: (input.city ?? "").trim(),
      rating: Number(input.rating),
      title: (input.title ?? "").trim().slice(0, 140),
      review: input.body.trim().slice(0, 4000),
      images,
      verified: false,
      status: "pending",
      orderNumber: (input.orderNumber ?? "").trim(),
      actor: "website",
    },
    { timeoutMs: 20_000 },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, duplicate: Boolean(result.data.duplicate) };
}
