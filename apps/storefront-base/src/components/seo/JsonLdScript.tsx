"use client";

import * as React from "react";

export type JsonLdScriptProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
};

export function JsonLdScript({ data, id }: JsonLdScriptProps) {
  const jsonString = React.useMemo(() => {
    try {
      return JSON.stringify(data);
    } catch {
      return "{}";
    }
  }, [data]);

  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
}

export function ProductJsonLd(props: {
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
}) {
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
  } = props;

  const data = React.useMemo<Record<string, unknown>>(() => {
    const obj: Record<string, unknown> = {
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

    if (sku) obj.sku = sku;
    if (category) obj.category = category;
    if (priceValidUntil) {
      (obj.offers as Record<string, unknown>).priceValidUntil = priceValidUntil;
    }
    if (typeof ratingValue === "number" && typeof reviewCount === "number") {
      obj.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(ratingValue.toFixed(1)),
        reviewCount: Math.max(0, Math.round(reviewCount)),
      };
    }
    return obj;
  }, [
    name,
    description,
    images,
    sku,
    brandName,
    price,
    priceCurrency,
    priceValidUntil,
    availability,
    ratingValue,
    reviewCount,
    url,
    category,
    productId,
  ]);

  return <JsonLdScript data={data} id="product-schema" />;
}

export function BreadcrumbJsonLd(props: {
  items: { name: string; url?: string }[];
}) {
  const data = React.useMemo<Record<string, unknown>>(() => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: props.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }), [props.items]);

  return <JsonLdScript data={data} id="breadcrumb-schema" />;
}

export function OrganizationJsonLd(props: {
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
}) {
  const data = React.useMemo<Record<string, unknown>>(() => {
    const obj: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: props.name,
      url: props.url,
    };
    if (props.logoUrl) {
      obj.logo = {
        "@type": "ImageObject",
        url: props.logoUrl,
      };
    }
    if (props.description) {
      obj.description = props.description;
    }
    if (props.socialUrls?.length) {
      obj.sameAs = props.socialUrls;
    }
    if (props.contactEmail || props.contactPhone) {
      obj.contactPoint = {
        "@type": "ContactPoint",
        ...(props.contactEmail && { email: props.contactEmail }),
        ...(props.contactPhone && { telephone: props.contactPhone }),
        contactType: "Customer Support",
      };
    }
    if (props.address) {
      obj.address = {
        "@type": "PostalAddress",
        streetAddress: props.address.streetAddress,
        addressLocality: props.address.city,
        ...(props.address.postalCode && { postalCode: props.address.postalCode }),
        addressCountry: props.address.country,
      };
    }
    return obj;
  }, [props]);

  return <JsonLdScript data={data} id="organization-schema" />;
}

export default JsonLdScript;
