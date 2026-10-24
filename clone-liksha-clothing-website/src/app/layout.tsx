import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingHelp } from "@/components/floating-help";
import { getProducts } from "@/lib/store";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.likshaclothing.com"),
  title: {
    default: "Liksha Clothing | Designer Anarkali Suits, Lehenga Choli & Suit Sets",
    template: "%s | Liksha Clothing",
  },
  description:
    "Shop premium designer Anarkali suits, lehenga choli, printed suit sets and sarees at Liksha Clothing. Free shipping across India, COD available and 7 days easy replacement.",
  keywords: [
    "designer anarkali suits",
    "lehenga choli online",
    "printed suit set",
    "liksha clothing",
    "party wear gown",
  ],
  openGraph: {
    title: "Liksha Clothing | Designer Anarkali Suits",
    description:
      "Premium designer Anarkali suits, lehengas and printed suit sets crafted for every celebration.",
    type: "website",
    images: ["/images/site/banner.jpg"],
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const products = await getProducts();
  const searchIndex = products.slice(0, 200);

  return (
    <html lang="en">
      <body className={`${jost.variable} ${cormorant.variable} font-[family-name:var(--font-jost)] text-[#2f2a25]`}>
        <CartProvider>
          <SiteHeader searchIndex={searchIndex} />
          <main className="min-h-[60vh]">{children}</main>
          <SiteFooter />
          <FloatingHelp />
        </CartProvider>
      </body>
    </html>
  );
}
