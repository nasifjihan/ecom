import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@ecom/storefront-base";
import { NavbarWithCartState, CartDrawerSlot } from "./site-chrome";
import { getSite, hexToHslVar } from "@/lib/content";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

// Static pages are rebuilt at most once a minute, so theme, menu and homepage edits show up
// without a redeploy (including pages first built while the API was unreachable, e.g. in Docker).
export const revalidate = 60;

const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_BASE),
  title: {
    default: "Fashion BD — Best Clothing, Shoes & Accessories in Bangladesh",
    template: "%s | Fashion BD",
  },
  description:
    "Shop the latest fashion trends in Bangladesh. Women's clothing, men's fashion, kids wear, shoes, bags, watches and accessories. Free delivery, easy returns, COD available.",
  keywords: [
    "fashion bangladesh",
    "online shopping bangladesh",
    "clothing store dhaka",
    "eid collection 2026",
    "womens dresses",
    "mens shirts",
    "fashion bd",
    "COD Bangladesh",
    "online store BD",
  ],
  applicationName: "Fashion BD",
  authors: [{ name: "Fashion BD", url: SITE_BASE }],
  creator: "Fashion BD",
  publisher: "Fashion BD",
  alternates: {
    canonical: "/",
    languages: {
      "en-BD": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_BD",
    siteName: "Fashion BD",
    url: "/",
    title: "Fashion BD — Best Clothing, Shoes & Accessories in Bangladesh",
    description:
      "Shop the latest fashion trends in Bangladesh. Women's clothing, men's fashion, kids wear, shoes, bags, watches and accessories. Free delivery, easy returns, COD available.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Fashion BD — Shop Clothing, Shoes & Accessories Online in Bangladesh",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@fashionbd",
    creator: "@fashionbd",
    title: "Fashion BD — Best Clothing, Shoes & Accessories in Bangladesh",
    description:
      "Shop the latest fashion trends in Bangladesh. COD available across the country. 7-day easy returns.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Fashion BD — Shop Clothing, Shoes & Accessories",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "ecommerce",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  verification: {
    google: "google-site-verification-code",
  },
};

/** Title and site name follow the store name set in the admin (Online Store > Theme). */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const name = site?.theme.brand.storeName;
  if (!name) return baseMetadata;
  const tagline = site.theme.brand.tagline;
  return {
    ...baseMetadata,
    title: { default: tagline ? `${name} — ${tagline}` : name, template: `%s | ${name}` },
    applicationName: name,
    openGraph: { ...baseMetadata.openGraph, siteName: name },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const site = await getSite();
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: site?.theme.colors.primary ?? "#7c3aed",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const theme = site?.theme;
  const storeName = theme?.brand.storeName ?? "Fashion BD";
  const primary = theme ? hexToHslVar(theme.colors.primary) : null;
  const announcement = theme?.announcement.enabled && theme.announcement.text ? theme.announcement : null;
  const footerColumns = site
    ? [
        ...site.footerMenus.map((m) => ({
          title: m.title,
          links: m.links.map((l) => ({ label: l.title, href: l.url, external: l.openInNewTab || /^https?:/i.test(l.url) })),
        })),
        ...(site.footerPages.length ? [{ title: "Information", links: site.footerPages.map((p) => ({ label: p.title, href: p.url })) }] : []),
      ]
    : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {/* The store's brand colour, from the admin theme settings; hexToHslVar only ever returns digits and %. */}
        {primary && <style>{`:root{--primary:${primary};--ring:${primary}}`}</style>}
      </head>
      <body className="min-h-screen bg-background antialiased flex flex-col">
        <Providers>
          {announcement && (
            <div className="bg-primary text-primary-foreground text-center text-xs sm:text-sm font-medium px-4 py-2">
              {announcement.link ? (
                <a href={announcement.link} className="hover:underline">
                  {announcement.text}
                </a>
              ) : (
                announcement.text
              )}
            </div>
          )}
          <NavbarWithCartState storeName={storeName} logoUrl={theme?.brand.logoUrl} menu={site?.headerMenu} />
          {/* Pages that read useSearchParams need a Suspense boundary to prerender. */}
          <main className="flex-1">
            <Suspense>{children}</Suspense>
          </main>
          <Footer
            storeName={storeName}
            logoUrl={theme?.brand.logoUrl}
            storeDescription={theme?.footer.about || undefined}
            contactInfo={theme ? { address: theme.footer.address, phone: theme.footer.phone, email: theme.footer.email } : undefined}
            socialLinks={theme?.social}
            showNewsletter={theme?.footer.showNewsletter ?? true}
            columns={footerColumns?.length ? footerColumns : undefined}
          />
          <CartDrawerSlot storeName={storeName} />
        </Providers>
      </body>
    </html>
  );
}
