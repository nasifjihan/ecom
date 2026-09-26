import type { MetadataRoute } from "next";
import type { CategoryNode, Paginated, ProductSummary } from "@ecom/storefront-base";
import { serverApi } from "@/lib/server-api";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

const STATIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "daily" as const },
  { path: "/products", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/shipping-policy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/return-policy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/terms-of-service", priority: 0.3, changeFrequency: "yearly" as const },
];

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_BASE}${normalized === "/" ? "" : normalized}`;
}

function nowDate(): Date {
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: SitemapEntry[] = [];

  for (const page of STATIC_PAGES) {
    entries.push({
      url: buildUrl(page.path),
      lastModified: nowDate(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  const tree = (await serverApi<CategoryNode[]>("/storefront/categories/tree", 3600)) ?? [];
  const walk = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((n) => [n, ...walk(n.children ?? [])]);
  for (const cat of walk(tree)) {
    entries.push({
      url: buildUrl(`/products?category=${cat.slug}`),
      lastModified: nowDate(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Walk the public catalog page by page (60 is the API's perPage cap).
  for (let page = 1; page <= 50; page++) {
    const res = await serverApi<Paginated<ProductSummary>>(`/storefront/products?perPage=60&sort=newest&page=${page}`, 3600);
    if (!res) break;
    for (const product of res.items) {
      entries.push({
        url: buildUrl(`/products/${product.slug}`),
        lastModified: nowDate(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    if (page >= res.totalPages) break;
  }

  return entries as MetadataRoute.Sitemap;
}
