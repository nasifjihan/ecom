import type { MetadataRoute } from "next";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

export default function robots(): MetadataRoute.Robots {
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
