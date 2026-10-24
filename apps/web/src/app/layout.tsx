import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingHelp } from "@/components/floating-help";
import { AnnouncementBar } from "@/components/announcement-bar";
import { WishlistProvider } from "@/components/wishlist-provider";
import { StoreSettingsProvider } from "@/components/store-settings-provider";
import { logoMark, siteConfig } from "@/config/site";
import { assetUrl } from "@/lib/format";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: "Liksha Clothing",
  // browser tab / home-screen icon — live store ka hi logo (same to same)
  icons: {
    icon: [{ url: logoMark, sizes: "192x192", type: "image/png" }],
    shortcut: [{ url: logoMark }],
    apple: [{ url: logoMark, sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Liksha Clothing", statusBarStyle: "default" },
  manifest: assetUrl("/manifest.webmanifest"),
  title: {
    default: "Liksha Clothing | Designer Anarkali Suits, Lehenga Choli & Suit Sets",
    template: "%s | Liksha Clothing",
  },
  description:
    "Shop premium designer Anarkali suits, lehenga choli and printed suit sets at Liksha Clothing. Free shipping across India, secure prepaid checkout and 7 days easy replacement.",
  keywords: [
    "designer anarkali suits",
    "lehenga choli online",
    "printed suit set",
    "party wear gown",
    "liksha clothing",
  ],
  openGraph: {
    title: "Liksha Clothing | Designer Anarkali Suits",
    description:
      "Premium designer Anarkali suits, lehengas and printed suit sets crafted for every celebration.",
    type: "website",
    url: siteConfig.url,
    siteName: "Liksha Clothing",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: "Liksha Clothing" }],
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#862222",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600&display=swap"
        />
      </head>
      <body className="text-[#2f2a25]">
        {/* JS band ho to scroll-reveal content chhupna nahi chahiye */}
        <noscript>
          <style>{".reveal-init{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <StoreSettingsProvider>
        <CartProvider>
          <WishlistProvider>
            <AnnouncementBar />
            <SiteHeader />
            <main className="min-h-[60vh]">{children}</main>
            <SiteFooter />
            <FloatingHelp />
          </WishlistProvider>
        </CartProvider>
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
