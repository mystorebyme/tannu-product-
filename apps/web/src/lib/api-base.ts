/**
 * Client-side API base.
 *
 * GitHub Pages par koi Node server nahi chalta, isliye wahan API calls live store
 * (Vercel) par jaani chahiye. `NEXT_PUBLIC_API_BASE_URL` set ho to wahi use hota
 * hai; nahi set ho to preview par hum galat host par request bhej kar "Network error"
 * nahi dikhate — seedha WhatsApp order flow dikha dete hain.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

/** Static export (GitHub Pages) build */
export const IS_STATIC_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW === "1";

/** Live store (server wala hissa: order, payment, tracking) */
export const LIVE_STORE_URL = (
  process.env.NEXT_PUBLIC_LIVE_STORE_URL ??
  API_BASE ??
  // purge: Render service dead hai — tracking/orders live Vercel store par hain
  "https://liksha-clothing.vercel.app"
).replace(/\/+$/, "");

/** API available hai ya nahi — preview par base ke bina koi call nahi */
export const API_AVAILABLE = !IS_STATIC_PREVIEW || Boolean(API_BASE);

export function apiUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${clean}`;
}
