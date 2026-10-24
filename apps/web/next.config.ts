import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shared packages ko TS source se compile karna hai (no separate build step)
  transpilePackages: ["@liksha/types", "@liksha/validation", "@liksha/api-client", "@liksha/ui"],
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
