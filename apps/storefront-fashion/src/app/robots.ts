import type { MetadataRoute } from "next";
import { storeOrigin } from "@/lib/server-api";


export default async function robots(): Promise<MetadataRoute.Robots> {
  const SITE_BASE = await storeOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/checkout",
          "/checkout/",
          "/account",
          "/account/",
          "/wishlist",
          "/wishlist/",
          "/cart/",
          "/*.webmanifest",
          "/admin/",
          "/_next/",
          "/404",
          "/500",
        ],
        crawlDelay: 10,
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/checkout",
          "/checkout/",
          "/account",
          "/account/",
          "/*.webmanifest",
        ],
        crawlDelay: 5,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: [
          "/api/",
          "/checkout",
          "/checkout/",
          "/account",
          "/account/",
          "/*.webmanifest",
        ],
        crawlDelay: 8,
      },
    ],
    sitemap: `${SITE_BASE}/sitemap.xml`,
    host: SITE_BASE,
  };
}
