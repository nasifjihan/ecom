import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown, markdownToText } from "@ecom/ui";
import { formatDate, getCmsPage } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

/** Store pages written in the admin (Content > Pages), e.g. /shipping-policy. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: true } };
  return {
    title: page.seoTitle || page.title,
    description: page.metaDesc || markdownToText(page.content),
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function CmsPageView({ params }: Props) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) notFound();

  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {formatDate(page.updatedAt)}</p>
      <Markdown source={page.content} className="mt-8 text-[15px] md:text-base" />
    </div>
  );
}
