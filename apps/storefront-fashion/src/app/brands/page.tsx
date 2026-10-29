/** /brands: every brand the shop sells, each linking to its own page. */
import type { Metadata } from "next";
import Link from "next/link";
import { translatorFor, type Brand } from "@ecom/storefront-base";
import { serverApi } from "@/lib/server-api";
import { pageLocale } from "@/lib/content";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const [brands, locale] = await Promise.all([serverApi<Brand[]>("/storefront/brands", 300), pageLocale()]);
  const t = translatorFor(locale);
  const shown = (brands ?? []).filter((b) => (b.productCount ?? 0) > 0);
  return (
    <div className="container py-6 md:py-10">
      <h1 className="mb-8 text-2xl md:text-3xl font-bold tracking-tight">{t("Brands")}</h1>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((b) => (
            <li key={b.id}>
              <Link href={`/brands/${b.slug}`} className="flex h-full flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-colors hover:border-primary">
                {b.logo ? (
                  <img src={b.logo} alt="" className="h-16 w-full object-contain" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">{b.name[0]}</span>
                )}
                <span className="font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground">{t("{n} products", { n: b.productCount ?? 0 })}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-16 text-center text-muted-foreground">{t("No brands yet.")}</p>
      )}
    </div>
  );
}
