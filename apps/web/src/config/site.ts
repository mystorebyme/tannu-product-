export const siteConfig = {
  name: "Liksha Clothing",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.likshaclothing.com",
  ogImage:
    "https://cdn.shopify.com/s/files/1/0738/8345/1696/files/DSC08059_JPG.jpg?width=1200",
  description:
    "Designer Anarkali suits, lehenga choli and printed suit sets, hand-finished for weddings and festivals.",
  phone: "+91 9879219630",
  whatsapp: "9909790455",
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
