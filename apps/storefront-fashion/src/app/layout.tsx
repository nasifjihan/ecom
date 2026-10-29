import { Suspense } from "react";
import { SentryInit } from "@/components/sentry-init";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer, Tracking, translatorFor } from "@ecom/storefront-base";
import { NavbarWithCartState, CartDrawerSlot } from "./site-chrome";
import { getSite, getSlotPromotions, hexToHslVar, pageLocale, readableOn } from "@/lib/content";
import { EntryPopup } from "./_components/promotions";
import { ReferralCapture } from "@/lib/loyalty";
import { SalesCodeCapture } from "@/lib/sales-code";
import { shopClosed } from "@/lib/maintenance";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

// Static pages are rebuilt at most once a minute, so theme, menu and homepage edits show up
// without a redeploy (including pages first built while the API was unreachable, e.g. in Docker).
export const revalidate = 60;

const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_BASE),
  title: {
    default: "Online shop",
    template: "%s",
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
    "COD Bangladesh",
    "online store BD",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "en-BD": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_BD",
    url: "/",
    title: "Online shop",
    description:
      "Shop the latest fashion trends in Bangladesh. Women's clothing, men's fashion, kids wear, shoes, bags, watches and accessories. Free delivery, easy returns, COD available.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Online shop",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Online shop",
    description:
      "Shop the latest fashion trends in Bangladesh. COD available across the country. 7-day easy returns.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Online shop",
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
  // From the store's browser icon, or its initial on the main colour (app-icon/[size]).
  icons: { icon: "/app-icon/32", apple: "/app-icon/180" },
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
    // "Hide from search engines": robots.txt blocks crawling, this keeps already-known pages out of results.
    ...(site.theme.robots?.blockAll || site.theme.maintenance?.enabled ? { robots: { index: false, follow: false } } : {}),
    ...(site.theme.tracking?.googleVerification ? { verification: { google: site.theme.tracking.googleVerification } } : {}),
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
  const [site, barPromos, locale] = await Promise.all([getSite(), getSlotPromotions("announcement_bar"), pageLocale()]);
  const t = translatorFor(locale);
  const languages = site?.languages?.enabled ?? ["en"];
  const theme = site?.theme;
  const storeName = theme?.brand.storeName ?? "";
  const primary = theme ? hexToHslVar(theme.colors.primary) : null;
  const secondary = theme?.colors.secondary ? hexToHslVar(theme.colors.secondary) : null;
  const closed = await shopClosed(theme);
  // Only digits, spaces and % come out of these helpers, so they're safe inside <style>.
  const colorVars = [
    primary && `--primary:${primary};--ring:${primary};--primary-foreground:${readableOn(theme!.colors.primary)}`,
    secondary && `--secondary:${secondary};--secondary-foreground:${readableOn(theme!.colors.secondary!)}`,
  ]
    .filter(Boolean)
    .join(";");
  const announcement = theme?.announcement.enabled && theme.announcement.text ? theme.announcement : null;
  // Shop pages every store has, next to the store's own footer menus.
  const quickLinks = {
    title: t("Shop"),
    links: [
      { label: t("Track your order"), href: "/track" },
      { label: t("Flash sale"), href: "/flash-sale" },
      { label: t("Wishlist"), href: "/wishlist" },
      { label: t("Search"), href: "/search" },
    ],
  };
  const footerColumns = site
    ? [
        quickLinks,
        ...site.footerMenus.map((m) => ({
          title: t(m.title),
          links: m.links.map((l) => ({ label: t(l.title), href: l.url, external: l.openInNewTab || /^https?:/i.test(l.url) })),
        })),
        ...(site.footerPages.length ? [{ title: t("Information"), links: site.footerPages.map((p) => ({ label: p.title, href: p.url })) }] : []),
      ]
    : undefined;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {/* The store's colours, from the admin theme settings. */}
        {colorVars && <style>{`:root{${colorVars}}`}</style>}
      </head>
      <body className="min-h-screen bg-background antialiased flex flex-col">
        {closed ? (
          <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
            {theme?.brand.logoUrl ? (
              <img src={theme.brand.logoUrl} alt={storeName} className="h-16 w-auto" />
            ) : (
              <p className="text-2xl font-bold">{storeName}</p>
            )}
            <h1 className="text-xl font-semibold">{t("We'll be back soon")}</h1>
            {theme?.maintenance?.message && <p className="max-w-md text-muted-foreground">{theme.maintenance.message}</p>}
          </main>
        ) : (
        <>
        <SentryInit />
        <Tracking facebookPixelId={theme?.tracking?.facebookPixelId} googleAnalyticsId={theme?.tracking?.googleAnalyticsId} />
        <Providers locale={locale} languages={languages} display={theme?.display}>
          {theme?.maintenance?.enabled && (
            <div className="bg-amber-500 text-black text-center text-xs font-medium px-4 py-1.5">
              {t("Preview: the shop is closed to shoppers (maintenance mode).")}
            </div>
          )}
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
          {barPromos.length > 0 && (
            <div className="bg-foreground text-background text-center text-xs sm:text-sm font-medium px-4 py-2" aria-label={t("Offers")}>
              {barPromos.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && <span className="mx-2 opacity-50" aria-hidden="true">·</span>}
                  {p.linkUrl ? (
                    <a href={p.linkUrl} className="hover:underline">
                      {p.headline}
                    </a>
                  ) : (
                    p.headline
                  )}
                </span>
              ))}
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
          <EntryPopup />
          <ReferralCapture />
          <SalesCodeCapture />
        </Providers>
        </>
        )}
      </body>
    </html>
  );
}
