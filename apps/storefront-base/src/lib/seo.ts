export type OgImageOptions = {
  text?: string;
  theme?: "light" | "dark";
  template?: "product" | "category" | "default";
  width?: number;
  height?: number;
};

export function getSiteBase(): string {
  if (typeof process !== "undefined") {
    const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (env) return env.replace(/\/$/, "");
  }
  return "https://fashionbd.example.com";
}

export function buildCanonical(
  pathOrUrl: string,
  siteBase?: string,
): string {
  const base = siteBase ?? getSiteBase();

  if (!pathOrUrl || pathOrUrl.length === 0) {
    return `${base}/`;
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  let normalized = pathOrUrl;
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/+$/, "/") === "/" ? "/" : normalized.replace(/\/+$/, "");

  return `${base}${normalized}`;
}

export function formatOgImageUrl(
  seedOrText?: string,
  opts: OgImageOptions = {},
): string {
  const base = getSiteBase();
  const {
    theme = "light",
    template = "default",
    width = 1200,
    height = 630,
  } = opts;

  const cacheKey = encodeURIComponent(seedOrText ?? "og-default");
  const promptText = seedOrText
    ? `e-commerce social media share image for ${seedOrText}, clean professional ${theme} background, ${template}, 1200x630, modern design`
    : `e-commerce store social media open graph image, professional ${theme} theme, 1200x630`;

  const prompt = encodeURIComponent(promptText);

  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${prompt}&image_size=landscape_16_9&cache=${template}-${cacheKey}-${theme}-${width}x${height}`;
}

export function generateProductSchemaJSONLD(options: {
  name: string;
  description: string;
  images: string[];
  sku?: string;
  brandName: string;
  price: number;
  priceCurrency?: string;
  priceValidUntil?: string;
  availability?: string;
  ratingValue?: number;
  reviewCount?: number;
  url: string;
  category?: string;
  productId?: string;
}): Record<string, unknown> {
  const {
    name,
    description,
    images,
    sku,
    brandName,
    price,
    priceCurrency = "BDT",
    priceValidUntil,
    availability = "https://schema.org/InStock",
    ratingValue,
    reviewCount,
    url,
    category,
    productId,
  } = options;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": productId ? `${url}#product-${productId}` : `${url}#product`,
    name,
    description,
    url,
    image: images,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    offers: {
      "@type": "Offer",
      price: Number(price).toFixed(2),
      priceCurrency,
      availability,
      url,
    },
  };

  if (sku) {
    schema.sku = sku;
  }
  if (category) {
    schema.category = category;
  }
  if (priceValidUntil) {
    (schema.offers as Record<string, unknown>).priceValidUntil = priceValidUntil;
  }
  if (typeof ratingValue === "number" && typeof reviewCount === "number") {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(ratingValue.toFixed(1)),
      reviewCount: Math.max(0, Math.round(reviewCount)),
    };
  }

  return schema;
}

export function generateBreadcrumbSchemaJSONLD(items: {
  name: string;
  url?: string;
}[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateOrganizationSchemaJSONLD(options: {
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
  socialUrls?: string[];
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    streetAddress: string;
    city: string;
    postalCode?: string;
    country: string;
  };
}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: options.name,
    url: options.url,
  };
  if (options.logoUrl) {
    schema.logo = {
      "@type": "ImageObject",
      url: options.logoUrl,
    };
  }
  if (options.description) {
    schema.description = options.description;
  }
  if (options.socialUrls?.length) {
    schema.sameAs = options.socialUrls;
  }
  if (options.contactEmail || options.contactPhone) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      ...(options.contactEmail && { email: options.contactEmail }),
      ...(options.contactPhone && { telephone: options.contactPhone }),
      contactType: "Customer Support",
    };
  }
  if (options.address) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: options.address.streetAddress,
      addressLocality: options.address.city,
      ...(options.address.postalCode && { postalCode: options.address.postalCode }),
      addressCountry: options.address.country,
    };
  }
  return schema;
}

export function generateWebsiteSchemaJSONLD(options: {
  name: string;
  url: string;
  searchUrlTemplate?: string;
}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: options.name,
    url: options.url,
  };
  if (options.searchUrlTemplate) {
    schema.potentialAction = {
      "@type": "SearchAction",
      target: options.searchUrlTemplate,
      "query-input": "required name=query",
    };
  }
  return schema;
}

export function sanitizeSeoText(text: string, maxLength = 160): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3).trimEnd() + "...";
}

export function buildProductPageTitle(
  productName: string,
  brandName?: string,
  siteName = "Fashion BD",
  maxLength = 70,
): string {
  const parts = [productName.trim()];
  if (brandName) parts.push(brandName.trim());
  let result = parts.join(" — ");
  if (result.length + siteName.length + 3 <= maxLength) {
    return `${result} | ${siteName}`;
  }
  if (productName.length + siteName.length + 3 <= maxLength) {
    return `${productName.trim()} | ${siteName}`;
  }
  return sanitizeSeoText(productName, maxLength - siteName.length - 3) + ` | ${siteName}`;
}

export function buildMetaDescription(
  productName: string,
  price: number,
  currency = "BDT",
  extras?: string,
  maxLength = 160,
): string {
  const formatted = new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
  }).format(price);
  const base = `Buy ${productName} for ${formatted}${extras ? ` — ${extras}` : ""}. Fast delivery, easy returns, secure payment.`;
  return sanitizeSeoText(base, maxLength);
}

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?: ChangeFrequency;
  priority?: number;
};

export function createSitemapEntry(
  path: string,
  opts: Partial<Omit<SitemapEntry, "url">> & { siteBase?: string } = {},
): SitemapEntry {
  const { siteBase, ...rest } = opts;
  return {
    url: buildCanonical(path, siteBase),
    lastModified: rest.lastModified ?? new Date(),
    changeFrequency: rest.changeFrequency ?? "weekly",
    priority: rest.priority ?? 0.6,
  };
}

export const DEFAULT_SITEMAP_PATHS: {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/shipping-policy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/return-policy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
];
