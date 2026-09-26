import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Platform Super Admin | Ecom",
  description:
    "E-commerce Platform Super Admin - Manage tenant stores, billing, reports, and platform RBAC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          {/* Pages read ?search / ?new / ?redirect with useSearchParams, which needs a Suspense boundary to prerender. */}
          <Suspense>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
