import type { MetadataRoute } from "next";
import { collections, products } from "@/lib/store";
import { siteConfig } from "@/config/site";

// GitHub Pages preview (output: export) me static rehna chahiye
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/collections/new-arrivals", priority: 0.9 },
    { path: "/search", priority: 0.4 },
    { path: "/pages/about-us", priority: 0.5 },
    { path: "/pages/contact", priority: 0.5 },
    { path: "/track-order", priority: 0.5 },
    { path: "/pages/size-cheart", priority: 0.4 },
    { path: "/policies/privacy-policy", priority: 0.3 },
    { path: "/policies/terms-and-conditions", priority: 0.3 },
    { path: "/policies/refund-and-return-policy", priority: 0.3 },
    { path: "/policies/shipping-policy", priority: 0.3 },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${base}${route.path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route.priority,
    })),
    // khaali collection (jaise saree) par products nahi hain — thin page ko sitemap me na bhejein
    ...collections
      .filter((collection) => products.some((product) => product.collections.includes(collection.handle)))
      .map((collection) => ({
      url: `${base}/collections/${collection.handle}`,
      lastModified: now,
      changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ...products.map((product) => ({
      url: `${base}/products/${product.handle}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
