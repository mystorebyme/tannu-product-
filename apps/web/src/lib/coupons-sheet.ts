import "server-only";

import { runInBackground } from "./background";
import { couponsFromPayload, validateCoupon, type CouponValidation, type SheetCoupon } from "./coupons-format";
import { SHEET_READ_TIMEOUT, scriptGet, scriptPost, sheetsConfigured } from "./google-sheets";

/**
 * R46 (owner): coupon codes **sheet ke Coupons tab se** — checkout me payment
 * option ki jagah coupon field hai. Flow:
 *   • READ  — `?action=coupons` (public, sirf active) — 30s TTL + last-good.
 *   • CHECK — `/api/coupons/check` customer ka "Apply" validate karta hai.
 *   • ORDER — order create me server dobara validate karta hai (client par
 *             bharosa nahi); discount wahin se aata hai.
 *   • USE   — order banne ke baad background me `coupon_use` → sheet me
 *             `Used +1` (owner ko use-count sheet me hi track hoti hai).
 *
 * Sheet configured hi nahi (dev/CI) → coupons "unavailable": order rukta nahi,
 * coupon simply discount nahi deta. Sheet configured hai par code galat → 400.
 * `next dev` (sandbox preview) me sheet ke bina demo coupons chalte hain taaki
 * owner flow dekh sake — production me ye kabhi active nahi hote.
 */

const COUPONS_TTL_MS = 30_000;

type CouponsCache = {
  coupons: SheetCoupon[];
  at: number;
  error: string | null;
};

let cache: CouponsCache | null = null;
let inflight: Promise<SheetCoupon[] | null> | null = null;

/** sandbox/dev preview ke liye — production build me kabhi nahi (NODE_ENV gate). */
function devDemoCoupons(): SheetCoupon[] | null {
  if (process.env.NODE_ENV !== "development" || sheetsConfigured()) return null;
  return [
    { code: "DEMO50", type: "flat", value: 50, minOrder: 499, maxUses: 100, used: 0, active: true, expires: "31-Dec-2026" },
    { code: "DIWALI10", type: "percent", value: 10, minOrder: 999, maxUses: 500, used: 0, active: true, expires: "31-Dec-2026" },
  ];
}

async function fetchCoupons(): Promise<SheetCoupon[] | null> {
  if (!sheetsConfigured()) return null;
  const result = await scriptGet<{ coupons?: unknown }>("coupons", {}, { timeoutMs: SHEET_READ_TIMEOUT });
  if (!result.ok) {
    console.warn(`[coupons] sheet read failed: ${result.error}`);
    return null;
  }
  return couponsFromPayload(result.data);
}

/** Active coupons (TTL + last-good). `null` = pipeline available nahi. */
export async function readCoupons(options: { fresh?: boolean } = {}): Promise<SheetCoupon[] | null> {
  const demo = devDemoCoupons();
  if (demo) return demo;
  if (!sheetsConfigured()) return null;
  if (!options.fresh && cache && Date.now() - cache.at < COUPONS_TTL_MS) return cache.coupons;
  if (inflight) {
    const value = await inflight;
    return value ?? cache?.coupons ?? [];
  }
  inflight = fetchCoupons().finally(() => {
    inflight = null;
  });
  const coupons = await inflight;
  if (coupons) {
    cache = { coupons, at: Date.now(), error: null };
    return coupons;
  }
  // read fail — last good chalta rahe (order/coupon flow sheet downtime par na ruke)
  return cache?.coupons ?? [];
}

export type CouponCheck =
  | { ok: true; discountPaise: number; message: string; coupon: SheetCoupon | null }
  | { ok: false; error: string };

/**
 * Order/check API ka single validation point.
 * Sheet unavailable → lenient (discount 0, order nahi rukta); available → strict.
 */
export async function checkCouponCode(code: string, subtotalPaise: number): Promise<CouponCheck> {
  const wanted = String(code ?? "").trim().toUpperCase();
  if (!wanted) return { ok: false, error: "Enter a coupon code." };
  const demo = devDemoCoupons();
  const coupons = demo ?? (sheetsConfigured() ? await readCoupons() : null);
  if (!coupons) {
    // pipeline available nahi — coupon ignore, order aage (customer ko honest message)
    return {
      ok: true,
      discountPaise: 0,
      coupon: null,
      message: "Coupon could not be verified right now — your order will continue without a discount.",
    };
  }
  const result: CouponValidation = validateCoupon(coupons, wanted, subtotalPaise);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, discountPaise: result.discountPaise, message: result.message, coupon: result.coupon };
}

/** Order banne ke baad — sheet me Used +1 (background, order ko kabhi rokta nahi). */
export function reportCouponUse(code: string): void {
  const clean = String(code ?? "").trim().toUpperCase();
  if (!clean || !sheetsConfigured()) return;
  runInBackground(() =>
    scriptPost("coupon_use", { code: clean }).then((result) => {
      if (!result.ok) console.warn(`[coupons] coupon_use failed for ${clean}: ${result.error}`);
    }),
  );
}
