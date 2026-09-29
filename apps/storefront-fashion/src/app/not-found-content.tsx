"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button, useT } from "@ecom/storefront-base";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export function NotFoundContent() {
  const t = useT();
  // Tell the shop which address was broken, so it can add a redirect (Online Store → Redirects).
  React.useEffect(() => {
    fetch(`${API_BASE}/storefront/redirects/not-found`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  return (
    <div className="container flex flex-col items-center py-20 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t("We couldn't find that page")}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t("It may have moved, or the link may be wrong. Try searching, or start from the home page.")}</p>
      <form action="/search" className="mt-6 flex w-full max-w-md gap-2">
        <input
          name="q"
          aria-label={t("Search products")}
          placeholder={t("Search products...")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit">
          <Search className="mr-1.5 h-4 w-4" /> {t("Search")}
        </Button>
      </form>
      <div className="mt-4 flex gap-2">
        <Button asChild variant="outline">
          <Link href="/">{t("Home")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">{t("Shop")}</Link>
        </Button>
      </div>
    </div>
  );
}
