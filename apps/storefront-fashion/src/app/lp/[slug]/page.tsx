import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/server-api";
import { getFaqs } from "@/lib/content";
import type { LandingPageData } from "@/lib/landing";
import { LandingView } from "./landing-view";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/**
 * Never cached: the offer price, its end, stock and a switch back to draft show at once (a cached
 * copy kept serving an unpublished page). A draft is only fetched with its preview key.
 */
async function getPage(slug: string, preview?: string): Promise<LandingPageData | null> {
  const q = preview ? `?preview=${encodeURIComponent(preview)}` : "";
  return serverApi<LandingPageData>(`/storefront/landing/${encodeURIComponent(slug)}${q}`, 0);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const page = await getPage(slug, preview);
  if (!page) return { title: "Page not found", robots: { index: false, follow: true } };
  const image = page.heroImageUrl ?? page.product.images[0];
  return {
    title: page.seo.title,
    description: page.seo.description ?? undefined,
    alternates: { canonical: `/lp/${page.slug}` },
    robots: page.draft ? { index: false, follow: false } : undefined,
    openGraph: { title: page.seo.title, description: page.seo.description ?? undefined, images: image ? [{ url: image }] : undefined },
  };
}

/** A page for one product (Online Store > Landing pages), with its own order form. */
export default async function LandingPage({ params, searchParams }: Props) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const page = await getPage(slug, preview);
  if (!page) notFound();
  const faqs = page.sections.some((s) => s.type === "faq") ? await getFaqs() : [];
  return <LandingView page={page} faqs={faqs ?? []} preview={page.draft ? preview : undefined} />;
}
