import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@ecom/storefront-base";
import { NavbarWithCartState, CartDrawerSlot } from "./site-chrome";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
      </head>
      <body className="min-h-screen bg-background antialiased flex flex-col">
        <Providers>
          <NavbarWithCartState />
          <main className="flex-1">{children}</main>
          <Footer storeName="Fashion BD" />
          <CartDrawerSlot />
        </Providers>
      </body>
    </html>
  );
}
