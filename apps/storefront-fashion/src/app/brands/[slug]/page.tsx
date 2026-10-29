/** A brand's own page: its logo, banner and story, and its best-selling products. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd, translatorFor, type Brand, type Paginated, type ProductSummary } from "@ecom/storefront-base";
import { serverApi, storeOrigin } from "@/lib/server-api";
import { pageLocale } from "@/lib/content";
import { BrandProducts } from "./brand-products";

interface Props {
  params: Promise<{ slug: string }>;
}

async function brandOf(slug: string): Promise<Brand | undefined> {
  return ((await serverApi<Brand[]>("/storefront/brands", 300)) ?? []).find((b) => b.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await brandOf((await params).slug);
  if (!brand) return { title: "Brand not found", robots: { index: false, follow: true } };
  const description = brand.metaDesc ?? brand.description?.slice(0, 160) ?? `Shop ${brand.name} online. Cash on delivery across Bangladesh.`;
  return {
    title: brand.seoTitle ?? brand.name,
    description,
    alternates: { canonical: `${await storeOrigin()}/brands/${brand.slug}` },
    openGraph: { title: brand.name, description, images: brand.banner ?? brand.logo ? [{ url: (brand.banner ?? brand.logo)! }] : undefined },
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const [brand, locale, base] = await Promise.all([brandOf(slug), pageLocale(), storeOrigin()]);
  if (!brand) notFound();
  const t = translatorFor(locale);
  const first = await serverApi<Paginated<ProductSummary>>(`/storefront/products?brandId=${brand.id}&perPage=24&sort=popular`, 300);
  return (
    <div className="container py-6 md:py-10">
      <BreadcrumbJsonLd items={[{ name: t("Home"), url: base }, { name: t("Brands"), url: `${base}/brands` }, { name: brand.name }]} />
      <nav aria-label={t("Breadcrumb")} className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">{t("Home")}</Link> / <Link href="/brands" className="hover:text-primary">{t("Brands")}</Link> /{" "}
        <span className="text-foreground">{brand.name}</span>
      </nav>
      {brand.banner && <img src={brand.banner} alt="" className="mb-6 aspect-[4/1] w-full rounded-2xl object-cover" />}
      <header className="mb-8 flex items-center gap-4">
        {brand.logo && <img src={brand.logo} alt="" className="h-16 w-16 rounded-xl border bg-white object-contain p-1" />}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{brand.name}</h1>
          {brand.description && <p className="mt-1 max-w-2xl text-muted-foreground">{brand.description}</p>}
        </div>
      </header>
      <BrandProducts slug={brand.slug} items={first?.items ?? []} total={first?.total ?? 0} />
    </div>
  );
}
