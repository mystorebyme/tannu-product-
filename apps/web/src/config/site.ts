/**
 * Brand logo — live store (likshaclothing.com) ka hi asli asset, same to same.
 * Koi local/duplicate logo nahi: fallback bhi wahi URL hai, taaki galti se
 * doosra logo kabhi render na ho.
 */
const LIVE_LOGO =
  "https://www.likshaclothing.com/cdn/shop/files/Pink_Abstract_Watercolor_Creative_Logo_3_copy_2.png?v=1734092749";

export const logoUrl = `${LIVE_LOGO}&width=400`;
/** footer bhi wahi logo (maroon band par white plate ke saath) */
export const logoWhiteUrl = `${LIVE_LOGO}&width=400`;
export const logoFallback = logoUrl;
export const logoMark = `${LIVE_LOGO}&width=120`;

/**
 * Site ka apna URL — WhatsApp / invoice / canonical links isi se banate hain.
 * Domain lagne ke baad `NEXT_PUBLIC_SITE_URL` set kar dijiye (jaise https://designerclothes.in);
 * tab tak deployed URL use hota hai. Purani/cloned site ka link kabhi nahi bhejte.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") ??
  "https://www.likshaclothing.com";

export const siteConfig = {
  name: "Designer Clothes",
  url: siteUrl,
  ogImage:
    "https://cdn.shopify.com/s/files/1/0738/8345/1696/files/DSC08059_JPG.jpg?width=1200",
  description:
    "Designer Anarkali suits, lehenga choli and printed suit sets, hand-finished for weddings and festivals.",
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
