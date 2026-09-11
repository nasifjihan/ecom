import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

const PLACEHOLDER_IMG = (seed: string) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `fashion product ${seed} studio photo e-commerce clean white background professional`,
  )}&image_size=portrait_4_3`.replace("/v1/text_to_image?", `/v1/text_to_image?cache=pdp-seo-${seed}&`);

const SAMPLE_PRODUCTS = [
  {
    slug: "richman-navy-cotton-shirt",
    title: "Richman Navy Cotton Shirt — Premium Long Sleeve",
    description:
      "Buy Richman Navy Premium Cotton Shirt in Bangladesh. 100% combed cotton, tailored slim fit, mother-of-pearl buttons — perfect for office, weddings, and Eid.",
    price: 3290,
    brand: "Richman",
    sku: "RCM-NS-00781",
    rating: 4.5,
    reviewCount: 238,
    image: PLACEHOLDER_IMG("shirt-navy-front"),
    category: "Men's Shirts",
  },
  {
    slug: "iphone-17-pro",
    title: "iPhone 17 Pro — 256GB Titan Black",
    description:
      "Apple iPhone 17 Pro 256GB Titan Black. A19 Pro chip, 48MP camera, USB-C. Official warranty, EMI available.",
    price: 139990,
    brand: "Apple",
    sku: "IP17P-256-BLK",
    rating: 4.9,
    reviewCount: 1256,
    image: PLACEHOLDER_IMG("iphone-17-pro"),
    category: "Smartphones",
  },
];

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = typeof resolvedParams.slug === "string" ? resolvedParams.slug : String(resolvedParams.slug);
  const canonical = `/products/${slug}`;
  const fullCanonical = `${SITE_BASE}/products/${slug}`;

  const sample = SAMPLE_PRODUCTS.find((p) => p.slug === slug) ?? {
    slug,
    title: slug
      .split("-")
      .map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : ""))
      .filter(Boolean)
      .join(" "),
    description: `Shop the latest ${slug.replace(/-/g, " ")} online at Fashion BD. Best price in Bangladesh, free delivery over ৳1000, 7-day returns, COD available.`,
    price: 2490,
    brand: "Fashion BD",
    sku: `SKU-${slug.toUpperCase().slice(0, 12)}`,
    rating: 4.5,
    reviewCount: 42,
    image: PLACEHOLDER_IMG(slug),
    category: "Fashion",
  };

  const formattedPrice = new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
  }).format(sample.price);

  const metaDescription = sample.description.includes(sample.title)
    ? sample.description
    : `Buy ${sample.title} for ${formattedPrice} at Fashion BD — ${sample.description}`;

  const ogImage = sample.image;

  return {
    title: `${sample.title} | Fashion BD`,
    description: metaDescription,
    keywords: [
      sample.title.toLowerCase(),
      sample.brand.toLowerCase(),
      "buy online bangladesh",
      "fashion bd",
      sample.category,
      "cod available",
      "best price bd",
      slug,
    ],
    alternates: {
      canonical,
    },
    metadataBase: new URL(SITE_BASE),
    openGraph: {
      type: "product",
      url: canonical,
      title: `${sample.title} | Fashion BD`,
      description: metaDescription,
      siteName: "Fashion BD",
      locale: "en_BD",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${sample.title} — Fashion BD`,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${sample.title} | Fashion BD`,
      description: metaDescription,
      site: "@fashionbd",
      creator: "@fashionbd",
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const slug = typeof resolvedParams.slug === "string" ? resolvedParams.slug : String(resolvedParams.slug);

  const sample = SAMPLE_PRODUCTS.find((p) => p.slug === slug) ?? {
    slug,
    title: slug
      .split("-")
      .map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : ""))
      .filter(Boolean)
      .join(" "),
    description: `Shop the latest ${slug.replace(/-/g, " ")} online at Fashion BD.`,
    price: 2490,
    brand: "Fashion BD",
    sku: `SKU-${slug.toUpperCase().slice(0, 12)}`,
    rating: 4.5,
    reviewCount: 42,
    image: PLACEHOLDER_IMG(slug),
    category: "Fashion",
  };

  const fullUrl = `${SITE_BASE}/products/${slug}`;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${fullUrl}#product`,
    name: sample.title,
    description: sample.description,
    sku: sample.sku,
    url: fullUrl,
    image: [sample.image],
    category: sample.category,
    brand: {
      "@type": "Brand",
      name: sample.brand,
    },
    offers: {
      "@type": "Offer",
      url: fullUrl,
      priceCurrency: "BDT",
      price: Number(sample.price).toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(sample.rating.toFixed(1)),
      reviewCount: Math.max(1, Math.round(sample.reviewCount)),
      bestRating: 5,
      worstRating: 1,
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_BASE,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${SITE_BASE}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: sample.category,
        item: `${SITE_BASE}/categories/${sample.category.toLowerCase().replace(/\s+/g, "-")}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: sample.title,
        item: fullUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        id="product-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        id="breadcrumb-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ProductDetailClient slug={slug} />
    </>
  );
}
