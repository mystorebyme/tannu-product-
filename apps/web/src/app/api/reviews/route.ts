import { getProduct } from "@/lib/store";
import { reviewSubmissionErrors, submitReview, type ReviewSubmission } from "@/lib/reviews-sheet";

export const dynamic = "force-dynamic";

/**
 * R44 (owner): "new koi kre kisi product ka review vo bi dikhna chiye or us
 * new review ko approv krte hi vo site pr product pr live ho jana chiye".
 *
 * Customer ka review → sheet ke Reviews tab me `pending` row. Owner /exec panel
 * (ya sheet me Status column) se approve karta hai → product page par live.
 * Moderation ke bina kuch publish nahi hota. Sheet down ho to friendly error —
 * customer ko technical baatein nahi dikhtin (R41 rule).
 */

/** Simple in-memory throttle — ek IP se ghante me zyada se zyada 5 review. */
const HOURLY_LIMIT = 5;
const submissions = new Map<string, { count: number; hour: number }>();

function throttled(key: string): boolean {
  const hour = Math.floor(Date.now() / 3_600_000);
  const entry = submissions.get(key);
  if (!entry || entry.hour !== hour) {
    submissions.set(key, { count: 1, hour });
    return false;
  }
  entry.count += 1;
  return entry.count > HOURLY_LIMIT;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "We could not read the request — please try again." }, { status: 400 });
  }
  const input = (body ?? {}) as Partial<ReviewSubmission>;
  const handle = String(input.handle ?? "").trim().toLowerCase();

  const errors = reviewSubmissionErrors({ ...input, handle });
  if (errors.length) {
    return Response.json({ ok: false, error: errors[0] }, { status: 400 });
  }

  // product live catalog (sheet) me hona chahiye — galat handle par row na bane
  const product = await getProduct(handle);
  if (!product) {
    return Response.json({ ok: false, error: "This product is not available right now." }, { status: 404 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(`${ip}:${handle}`)) {
    return Response.json(
      { ok: false, error: "Too many reviews submitted at once — please try again after a while." },
      { status: 429 },
    );
  }

  try {
    const result = await submitReview({
      handle,
      name: String(input.name ?? "").trim(),
      city: String(input.city ?? "").trim(),
      rating: Number(input.rating),
      title: String(input.title ?? "").trim(),
      body: String(input.body ?? "").trim(),
      images: Array.isArray(input.images) ? input.images.map((image) => String(image).trim()).filter(Boolean) : [],
    });
    if (!result.ok) {
      console.warn(`[reviews] submit failed for ${handle}: ${result.error}`);
      return Response.json(
        { ok: false, error: "Your review could not be submitted right now — please try again in a little while." },
        { status: 502 },
      );
    }
    return Response.json(
      {
        ok: true,
        duplicate: Boolean(result.duplicate),
        message: result.duplicate
          ? "We have already received this review — thank you!"
          : "Thank you! We have received your review — it will appear on the product page once our team approves it.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[reviews] submit error", error instanceof Error ? error.message : error);
    return Response.json(
      { ok: false, error: "Your review could not be submitted right now — please try again in a little while." },
      { status: 502 },
    );
  }
}
