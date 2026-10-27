import type { Product } from "@liksha/types";

/**
 * Home page ke rotating rails.
 *
 * Har rail ka apna pool hai; pool se 10-minute window ke hisaab se random picks
 * jaate hain. `explore` rail poore catalogue se chalta hai — isliye har product
 * ko home par aane ka mauka milta hai (user ki requirement).
 */

export type RailKey = "trendy" | "newArrivals" | "lehnga" | "explore";

export const RAILS: Record<
  RailKey,
  { title: string; subtitle: string; href: string; collections: string[]; count: number }
> = {
  trendy: {
    /** R50 (owner): "trending … home page pr bi dikha do jo jo collection mahi" —
     *  home rail ab sirf Trending collection dikhata hai (wahi cards jo
     *  /collections/trending par hain), best-score picks ke saath. */
    title: "Trending Now",
    subtitle: "This week's most-loved styles — straight from the Trending collection",
    href: "/collections/trending",
    collections: ["trending"],
    count: 8,
  },
  newArrivals: {
    title: "New Arrivals",
    subtitle: "Freshly dropped, straight from the studio",
    href: "/collections/new-arrivals",
    collections: ["new-arrivals"],
    count: 8,
  },
  lehnga: {
    title: "Lehnga Choli",
    subtitle: "Our range of designer lehnga choli",
    href: "/collections/lehnga-choli",
    collections: ["lehnga-choli"],
    count: 8,
  },
  explore: {
    title: "More from Designer Clothing",
    subtitle: "Fresh picks every 10 minutes — browse them all",
    href: "/collections/new-arrivals",
    collections: [],
    count: 8,
  },
};

export function isRailKey(value: string): value is RailKey {
  return Object.prototype.hasOwnProperty.call(RAILS, value);
}

/** rail ka pool — collection filter, khaali = poora catalogue */
export function railPool(rail: RailKey, products: Product[]): Product[] {
  const collections = RAILS[rail].collections;
  if (!collections.length) return products;
  return products.filter((product) => product.collections.some((handle) => collections.includes(handle)));
}
