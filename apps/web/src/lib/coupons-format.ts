import { formatPrice } from "./format";

/**
 * R46 (owner): "payment ke option ki jagah coupon laga dena" — coupon codes ka
 * database owner ki Google Sheet ka **Coupons tab** hai (Code, Type, Value,
 * Min order, Max uses, Used, Active, Expires).
 *
 * Ye file **pure** hai (koi network/server-only nahi) — mapping + validation
 * unit tests me seedha chalte hain. Sheet read `coupons-sheet.ts` karta hai.
 *
 * Units (sheet se): Value = percent number (type percent) ya rupees (type flat);
 * Min order = rupees. Site me paisa chalta hai, isliye yahan convert hota hai.
 */

export type SheetCoupon = {
  code: string;
  type: "percent" | "flat";
  value: number;
  /** rupees */
  minOrder: number;
  maxUses: number;
  used: number;
  active: boolean;
  /** '' = no expiry */
  expires: string;
  /** script khud bhi expiry nikal kar bhejta hai (sheet Date cells) */
  expired?: boolean;
  exhausted?: boolean;
};

export type CouponValidation =
  | { ok: true; coupon: SheetCoupon; discountPaise: number; message: string }
  | { ok: false; error: string };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Expires cell kai shape me ho sakta hai — `yyyy-MM-dd`, `dd-MMM-yyyy`,
 * `dd/MM/yyyy`. Jo samajh na aaye use expiry **nahi** maante (coupon galat
 * band na ho). Din ke ant (23:59:59) tak coupon chalta hai.
 */
export function parseExpiresDate(text: string): Date | null {
  const clean = String(text ?? "").trim();
  if (!clean) return null;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(clean);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  match = /^(\d{1,2})[/-]([A-Za-z]{3})[A-Za-z]*[/-](\d{2,4})$/.exec(clean);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (!month) return null;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, Number(match[1]), 23, 59, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  if (match) {
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function couponExpired(coupon: SheetCoupon, now = new Date()): boolean {
  if (coupon.expired === true) return true;
  const when = parseExpiresDate(coupon.expires);
  return when !== null && when.getTime() < now.getTime();
}

export function couponExhausted(coupon: SheetCoupon): boolean {
  if (coupon.exhausted === true) return true;
  return coupon.maxUses > 0 && coupon.used >= coupon.maxUses;
}

const number = (value: unknown): number => {
  const parsed = Number(typeof value === "string" ? value.trim() : value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Apps Script ke coupon row → SheetCoupon (galat row = null) */
export function couponFromSheetRow(raw: unknown): SheetCoupon | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const code = String(row.code ?? row.Code ?? "").trim().toUpperCase();
  if (!code) return null;
  const type = String(row.type ?? row.Type ?? "percent").trim().toLowerCase() === "flat" ? "flat" : "percent";
  const expires =
    typeof (row.expires ?? row.Expires) === "string"
      ? String(row.expires ?? row.Expires).trim()
      : String(row.expires ?? "");
  return {
    code,
    type,
    value: number(row.value ?? row.Value),
    minOrder: number(row.minOrder ?? row.min_order ?? row["Min order"]),
    maxUses: number(row.maxUses ?? row.max_uses ?? row["Max uses"]),
    used: number(row.used ?? row.Used),
    active: row.active === true || String(row.active ?? row.Active ?? "").trim().toLowerCase() === "yes",
    expires,
    expired: row.expired === true ? true : undefined,
    exhausted: row.exhausted === true ? true : undefined,
  };
}

/** `?action=coupons` ka JSON payload → coupons list */
export function couponsFromPayload(payload: unknown): SheetCoupon[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const list = Array.isArray(root.coupons) ? root.coupons : Array.isArray(root.data) ? root.data : [];
  return list.map(couponFromSheetRow).filter((coupon): coupon is SheetCoupon => coupon !== null);
}

/**
 * Coupon validate + discount (paisa). Messages **English** (owner rule R46:
 * customer-facing text me Hinglish nahi).
 */
export function validateCoupon(
  coupons: SheetCoupon[],
  code: string,
  subtotalPaise: number,
  now = new Date(),
): CouponValidation {
  const wanted = String(code ?? "").trim().toUpperCase();
  if (!wanted) return { ok: false, error: "Enter a coupon code." };
  const coupon = coupons.find((entry) => entry.code === wanted);
  if (!coupon) return { ok: false, error: `Coupon "${wanted}" is not valid.` };
  if (!coupon.active) return { ok: false, error: `Coupon "${wanted}" is no longer active.` };
  if (couponExpired(coupon, now)) return { ok: false, error: `Coupon "${wanted}" has expired.` };
  if (couponExhausted(coupon)) return { ok: false, error: `Coupon "${wanted}" has reached its usage limit.` };
  const minOrderPaise = Math.round(coupon.minOrder * 100);
  if (minOrderPaise > subtotalPaise) {
    return {
      ok: false,
      error: `Coupon "${wanted}" needs a minimum order of ${formatPrice(minOrderPaise)}. Add ${formatPrice(
        minOrderPaise - subtotalPaise,
      )} more to use it.`,
    };
  }
  let discountPaise = 0;
  if (coupon.type === "percent") {
    const percent = Math.min(Math.max(coupon.value, 0), 100);
    discountPaise = Math.round((subtotalPaise * percent) / 100);
  } else {
    discountPaise = Math.round(coupon.value * 100);
  }
  discountPaise = Math.min(discountPaise, subtotalPaise);
  if (discountPaise <= 0) return { ok: false, error: `Coupon "${wanted}" is not applicable to this order.` };
  return {
    ok: true,
    coupon,
    discountPaise,
    message: `Coupon "${wanted}" applied — you saved ${formatPrice(discountPaise)}.`,
  };
}
