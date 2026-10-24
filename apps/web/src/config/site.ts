/**
 * Brand logo — owner ka final "Designer Clothing" mark (gold crown + gown).
 *
 * Local assets hain (`public/images/`), isliye GitHub Pages ke base path par bhi
 * chalte hain aur kisi doosri site par depend nahi karte:
 *   - `logo-mark-128/192/512.png` → square mark (header badge, favicon, invoice, manifest)
 *   - `logo.png/.webp` → poora lockup (crown + gown + DESIGNER CLOTHING wordmark)
 *   - `og-image.jpg`   → social share card
 */
const LOGO_BASE = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? "";

export const logoUrl = `${LOGO_BASE}/images/logo.png`;
/** full lockup (wordmark ke saath) — invoice / share card / admin */
export const logoLockupUrl = `${LOGO_BASE}/images/logo.png`;
/** chhota mark (header badge / footer) */
export const logoSmall = `${LOGO_BASE}/images/logo-mark-128.png`;
/** footer bhi wahi mark */
export const logoWhiteUrl = `${LOGO_BASE}/images/logo-mark-192.png`;
export const logoFallback = `${LOGO_BASE}/images/logo-mark-192.png`;
/** favicon / PWA icon */
export const logoMark = `${LOGO_BASE}/images/logo-mark-512.png`;

/**
 * Site ka apna URL — WhatsApp / invoice / canonical links isi se banate hain.
 * Domain lagne ke baad `NEXT_PUBLIC_SITE_URL` set kar dijiye (jaise https://designerclothes.in);
 * tab tak deployed URL use hota hai. Purani/cloned site ka link kabhi nahi bhejte.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") ??
  "https://likshaclothing.onrender.com";

export const siteConfig = {
  name: "Designer Clothing",
  url: siteUrl,
  ogImage: `${LOGO_BASE}/images/og-image.jpg`,
  description:
    "Designer Anarkali suits, lehenga choli and printed suit sets by Designer Clothing — hand-finished for weddings and festivals.",
  phone: "+91 8005900581",
  whatsapp: "8005900581",
  email: "Info.likshaclothing@gmail.com",
  address: "Jaipur, Rajasthan, India",
  socials: {
    instagram: "https://www.instagram.com/likshaclothing",
    facebook: "https://www.facebook.com/likshaclothing",
  },
  currency: "INR",
} as const;

export const ORDER_STATUS_COPY: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};
