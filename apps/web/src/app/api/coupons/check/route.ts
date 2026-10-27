import { checkCouponCode } from "@/lib/coupons-sheet";

export const dynamic = "force-dynamic";

/**
 * GET /api/coupons/check?code=DEMO50&subtotal=120000
 *
 * R46: checkout ka "Apply coupon" — validation **sheet ke Coupons tab** se
 * (server-side; client par bharosa nahi). `subtotal` paisa me. Jawab English me
 * (owner rule: customer-facing text strictly English).
 *
 * Order create me wahi validation dobara chalta hai — ye endpoint sirf turant
 * feedback ke liye hai (discount summary me dikhane ke liye).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase().slice(0, 24);
  const subtotalRaw = Number(url.searchParams.get("subtotal") ?? "0");
  const subtotal = Number.isFinite(subtotalRaw)
    ? Math.min(Math.max(Math.round(subtotalRaw), 0), 100_000_000)
    : 0;

  const result = await checkCouponCode(code, subtotal);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    {
      ok: true,
      code: code || undefined,
      discountPaise: result.discountPaise,
      totalPaise: Math.max(0, subtotal - result.discountPaise),
      message: result.message,
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
