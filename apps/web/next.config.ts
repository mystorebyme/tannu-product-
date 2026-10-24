import type { NextConfig } from "next";

/** Next dev sirf allowlisted hosts se HMR allow karta hai — sandbox preview isi list se aata hai. */
const devOrigins = ["localhost:3000", "127.0.0.1:3000", "*.e2b.app", "3000-iu4hlpxjms5r4hq5t841e.e2b.app"];

const nextConfig: NextConfig = {
  // shared packages ko TS source se compile karna hai (no separate build step)
  transpilePackages: ["@liksha/types", "@liksha/validation", "@liksha/api-client", "@liksha/ui"],
  allowedDevOrigins: devOrigins,
  images: {
    // product images Shopify CDN se aate hain. <img> use karte hain kyunki
    // direct CDN hit browser se hota hai -> Next server ka bandwidth zero.
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // browsers sirf https par maante hain — localhost par ignore ho jaata hai
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // report-only pehle: violations dekho, phir enforce karo (docs/07-security/headers-and-csp.md)
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "img-src 'self' https://cdn.shopify.com https://*.shopifycdn.com data: blob:",
              "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "connect-src 'self' https://api.razorpay.com",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        source: "/:path*.(png|jpg|jpeg|webp|svg|ico|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
