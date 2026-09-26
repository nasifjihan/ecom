"use client";

import * as React from "react";
import Head from "next/head";
import {
  buildCanonical,
  formatOgImageUrl,
  getSiteBase,
  sanitizeSeoText,
} from "../../lib/seo";

export type SocialMetaProps = {
  title: string;
  description?: string;
  url?: string;
  path?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  type?: "website" | "product" | "article" | "profile";
  locale?: string;
  siteName?: string;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterCreator?: string;
  twitterSite?: string;
  canonical?: string;
  keywords?: string[];
  noIndex?: boolean;
  noFollow?: boolean;
  themeColor?: string;
};

export function SocialMeta({
  title,
  description,
  url,
  path,
  image,
  imageWidth = 1200,
  imageHeight = 630,
  imageAlt,
  type = "website",
  locale = "en_BD",
  siteName = "Fashion BD",
  twitterCard = "summary_large_image",
  twitterCreator = "@fashionbd",
  twitterSite = "@fashionbd",
  canonical,
  keywords,
  noIndex = false,
  noFollow = false,
  themeColor = "#7c3aed",
}: SocialMetaProps) {
  const siteBase = getSiteBase();
  const fullUrl = canonical ?? url ?? buildCanonical(path ?? "/", siteBase);
  const finalTitle = title;
  const finalDescription = description
    ? sanitizeSeoText(description, 160)
    : undefined;
  const finalImage =
    image ?? formatOgImageUrl(title, { template: type as any });
  const finalImageAlt = imageAlt ?? title;

  const robots = React.useMemo(() => {
    const parts: string[] = [];
    parts.push(noIndex ? "noindex" : "index");
    parts.push(noFollow ? "nofollow" : "follow");
    parts.push("max-snippet:-1");
    parts.push("max-image-preview:large");
    parts.push("max-video-preview:-1");
    return parts.join(", ");
  }, [noIndex, noFollow]);

  return (
    <Head>
      <title>{finalTitle}</title>
      {finalDescription && (
        <meta name="description" content={finalDescription} />
      )}
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      <meta name="robots" content={robots} />
      <meta name="theme-color" content={themeColor} />
      <link rel="canonical" href={fullUrl} />

      <meta property="og:site_name" content={siteName} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={locale} />
      <meta property="og:title" content={finalTitle} />
      {finalDescription && (
        <meta property="og:description" content={finalDescription} />
      )}
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={finalImage} />
      <meta property="og:image:secure_url" content={finalImage} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:alt" content={finalImageAlt} />
      <meta property="og:image:type" content="image/jpeg" />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={twitterSite} />
      <meta name="twitter:creator" content={twitterCreator} />
      <meta name="twitter:title" content={finalTitle} />
      {finalDescription && (
        <meta name="twitter:description" content={finalDescription} />
      )}
      <meta name="twitter:image" content={finalImage} />
      <meta name="twitter:image:alt" content={finalImageAlt} />
    </Head>
  );
}

export default SocialMeta;
