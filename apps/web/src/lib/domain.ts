/**
 * Domain switch — R33 (26 Oct 2026).
 *
 * Owner ne apna domain khareed liya: **https://designerclothing.fashion**
 * (pehle sirf Vercel ka temporary URL `liksha-clothing.vercel.app` tha).
 *
 * Sab jagah `siteConfig.url` / `NEXT_PUBLIC_SITE_URL` se hi URL banta hai, isliye
 * ek hi jagah badalna kaafi hai. Ye file do kaam karti hai:
 *   1. `CANONICAL_ORIGIN` — production ka pakka origin (fallback + tests).
 *   2. `isOwnHost()` — kaun se host "apne" hain (traffic tracking me internal).
 *
 * Note: `www.likshaclothing.com` **hamari site nahi** hai (wo reference store
 * hai) — isliye us par kabhi canonical nahi banate.
 */

/** Production ka canonical origin (no trailing slash). */
export const CANONICAL_ORIGIN = "https://designerclothing.fashion";

/** Admin panel ka subdomain. */
export const CANONICAL_ADMIN_ORIGIN = "https://admin.designerclothing.fashion";

/** Purane/temporary hosts — SEO me canonical nahi, sirf pehchan ke liye. */
const LEGACY_HOSTS = ["liksha-clothing.vercel.app", "liksha-admin.vercel.app"];

/** Host apna hai? (www hata kar compare, case-insensitive) */
export function isOwnHost(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let host = raw.trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname.toLowerCase();
  } catch {
    return false;
  }
  host = host.replace(/^www\./, "");
  if (!host) return false;
  return host === "designerclothing.fashion" || host === "admin.designerclothing.fashion" || LEGACY_HOSTS.includes(host);
}
