"use client";

import * as React from "react";
import { buildCanonical, getSiteBase } from "@ecom/storefront-base/src/lib/seo";

export type CanonicalURLProps = {
  path?: string;
  siteBase?: string;
  url?: string;
};

export function CanonicalURL({
  path,
  siteBase,
  url,
}: CanonicalURLProps) {
  const [mounted, setMounted] = React.useState(false);
  const canonical = url ?? buildCanonical(path ?? "/", siteBase ?? getSiteBase());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      let link = document.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]',
      );
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      if (link.href !== canonical) {
        link.href = canonical;
      }
    } catch {
      /* ignore DOM errors in test */
    }
  }, [canonical, mounted]);

  return (
    <link
      rel="canonical"
      href={canonical}
      suppressHydrationWarning
    />
  );
}

export default CanonicalURL;
