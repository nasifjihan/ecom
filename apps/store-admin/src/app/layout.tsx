import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Store Admin",
  description: "E-commerce Store Admin Dashboard",
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
          {/* Pages read useSearchParams, which needs a Suspense boundary to prerender. */}
          <Suspense>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
