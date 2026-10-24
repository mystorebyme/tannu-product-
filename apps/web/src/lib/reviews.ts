import raw from "@/data/reviews.json";

/**
 * Reviews — live store ka Trustoo widget daily sync hota hai
 * (`scripts/reviews-sync/fetch-reviews.mjs` → `database/seeds/reviews/reviews.json`).
 * Yahan koi dummy review nahi hai: jo sync hua wahi dikhta hai.
 */

export type Review = {
  id: string;
  author: string;
  rating: number;
  title?: string;
  body: string;
  date?: string;
  verified?: boolean;
  photos?: string[];
  productHandle?: string;
  productTitle?: string;
};

export type ProductReviewBlock = {
  rating: number;
  count: number;
  reviews: Review[];
};

type ReviewsFile = {
  meta: { source?: string; shopId?: string; syncedAt?: string | null };
  shop: { rating: number; count: number };
  products: Record<string, ProductReviewBlock>;
};

const data = raw as ReviewsFile;

export const reviewsMeta = data.meta;
export const shopRating = data.shop ?? { rating: 0, count: 0 };

export function reviewsFor(handle: string): ProductReviewBlock {
  return data.products[handle] ?? { rating: 0, count: 0, reviews: [] };
}

/** Home / PDP cross-sell ke liye — sabse achhe reviews pehle. */
export function latestReviews(limit = 8): Review[] {
  const all = Object.entries(data.products).flatMap(([handle, block]) =>
    block.reviews.map((review) => ({ ...review, productHandle: handle })),
  );
  return all
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.rating - a.rating)
    .slice(0, limit);
}

export function hasReviews(): boolean {
  return latestReviews(1).length > 0;
}

/** Rating breakdown (5★→1★ bars) */
export function ratingBreakdown(block: ProductReviewBlock): { stars: number; count: number; percent: number }[] {
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = block.reviews.filter((review) => Math.round(review.rating) === stars).length;
    const percent = block.reviews.length ? Math.round((count / block.reviews.length) * 100) : 0;
    return { stars, count, percent };
  });
}
