import type { Review } from "./reviews";
// relative import jaan-boojh kar: bare `tsx --test` (unit suite) me `@/` alias
// resolve nahi hota — pure helper tests bina tsconfig-path ke bhi chalne chahiye.
import rawReviews from "../data/reviews.json";

/**
 * R44: reviews ke **pure** helpers — sheet row ↔ site Review mapping,
 * submission validation aur baked→sheet seed rows. Koi server-only import
 * nahi, isliye tests aur client dono import kar sakte hain. Fetch/cache
 * `reviews-sheet.ts` me hai (server-only).
 */

/** Script ke `?action=reviews` ka ek review. */
export type SheetReview = {
  id: string;
  product: string;
  handle: string;
  customer: string;
  city: string;
  rating: number;
  title: string;
  review: string;
  verified: boolean;
  status: string;
  images: string[];
  orderNumber: string;
  at: string;
  updated: string;
};

/** Sheet ka review → site ka Review type (product page component isi se banta hai). */
export function reviewFromSheetRow(row: SheetReview): Review {
  return {
    id: row.id || `${row.handle}-${row.customer}-${row.at}`,
    author: row.customer || "Customer",
    // rating khaali/0 ho (owner ki manual row) → 0 stars honest hai, 5 nahi
    rating: Math.min(5, Math.max(0, Math.round(Number(row.rating) || 0))),
    title: row.title || undefined,
    body: row.review,
    date: (row.at || row.updated || "").slice(0, 10) || undefined,
    verified: row.verified,
    photos: row.images?.length ? row.images : undefined,
    productHandle: row.handle || row.product,
  };
}

export type ReviewSubmission = {
  handle: string;
  name: string;
  city?: string;
  rating: number;
  title?: string;
  body: string;
  images?: string[];
  orderNumber?: string;
};

/** Pure validation — tests isi par chalte hain. Khaali array = sab sahi. */
export function reviewSubmissionErrors(input: Partial<ReviewSubmission>): string[] {
  const errors: string[] = [];
  if (!String(input.handle ?? "").trim()) errors.push("product chahiye");
  const name = String(input.name ?? "").trim();
  if (name.length < 2) errors.push("naam kam se kam 2 akshar ka ho");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push("rating 1 se 5 ke beech ho");
  const body = String(input.body ?? "").trim();
  if (body.length < 10) errors.push("review kam se kam 10 akshar ka ho");
  if (body.length > 4000) errors.push("review bahut lamba hai (4000 akshar tak)");
  const images = Array.isArray(input.images) ? input.images : [];
  if (images.length > 8) errors.push("8 se zyada image link nahi");
  for (const image of images) {
    if (!/^https?:\/\/\S+$/i.test(String(image ?? "").trim())) {
      errors.push("image link https:// se shuru hona chahiye");
      break;
    }
  }
  return errors;
}

type BakedReviewsFile = { products?: Record<string, { reviews?: Review[] }> };

/**
 * Baked reviews.json (Trustoo-sync ke purane asli reviews) → Reviews tab ki
 * rows. Sab `approved` — ye live store par pehle se dikh rahe the. Script ke
 * HEADERS ke column names hi keys hain (Image 1…8 alag-alag URL columns —
 * owner: "8 image hai to 8 coloum honge unme alag url").
 */
export function bakedReviewSeedRows(): Record<string, string | number>[] {
  const file = rawReviews as unknown as BakedReviewsFile;
  const rows: Record<string, string | number>[] = [];
  for (const [handle, block] of Object.entries(file.products ?? {})) {
    for (const review of block.reviews ?? []) {
      const body = String(review.body ?? "").trim();
      if (!body) continue;
      const photos = (review.photos ?? []).slice(0, 8);
      const row: Record<string, string | number> = {
        Timestamp: String(review.date ?? ""),
        "Review ID": `RV-${String(review.id || handle).toUpperCase()}`,
        Product: handle,
        Handle: handle,
        Customer: String(review.author ?? ""),
        City: "",
        Rating: Number(review.rating) || 5,
        Title: String(review.title ?? ""),
        Review: body,
        Verified: review.verified ? "yes" : "no",
        Status: "approved",
        "Photo URL": photos[0] ?? "",
        "Order number": "",
        Updated: "",
      };
      photos.forEach((photo, index) => {
        row[`Image ${index + 1}`] = photo;
      });
      rows.push(row);
      if (rows.length >= 3000) return rows;
    }
  }
  return rows;
}
