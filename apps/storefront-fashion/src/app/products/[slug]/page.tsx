import type { Metadata } from "next";
import type { ProductDetail } from "@ecom/storefront-base";
import { serverApi } from "@/lib/server-api";
import ProductDetailClient from "./ProductDetailClient";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

async function getProduct(slug: string): Promise<ProductDetail | null> {
  return serverApi<ProductDetail>(`/storefront/products/${encodeURIComponent(slug)}`);
}

function toSeo(p: ProductDetail) {
  return {
    slug: p.slug,
    title: p.seo?.title ?? p.title,
    description: p.seo?.description ?? p.shortDescription ?? `Buy ${p.title} online at Fashion BD. Cash on Delivery available.`,
    price: p.price,
    brand: p.brand?.name ?? "Fashion BD",
    sku: p.sku ?? p.slug,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    image: p.seo?.ogImage ?? p.image,
    category: p.category?.name ?? "Fashion",
  };
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = typeof resolvedParams.slug === "string" ? resolvedParams.slug : String(resolvedParams.slug);
  const canonical = `/products/${slug}`;
  const fullCanonical = `${SITE_BASE}/products/${slug}`;

  const product = await getProduct(slug);
  if (!product) {
    return { title: "Product not found | Fashion BD", robots: { index: false, follow: true } };
  }
  const sample = toSeo(product);

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
      type: "website",
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

  const product = await getProduct(slug);
  if (!product) return <ProductDetailClient slug={slug} />;
  const sample = toSeo(product);

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
      availability: product.isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(sample.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(sample.rating.toFixed(1)),
            reviewCount: sample.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
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
        item: `${SITE_BASE}/products?category=${product.category?.slug ?? ""}`,
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
