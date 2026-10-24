/** Paisa -> rupees display. Calculation kabhi float me nahi. */
export function formatPrice(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return `Rs. ${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatPriceDecimal(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return `Rs. ${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function discountPercent(price: number, compareAtPrice?: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/** Shopify CDN image ko chhota size me maango -> fast load */
export function imageUrl(src: string | undefined, width = 600): string {
  if (!src) return "/images/placeholder.svg";
  if (!src.includes("cdn.shopify.com")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}width=${width}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
