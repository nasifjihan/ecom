import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown, markdownToText } from "@ecom/ui";
import { formatDate, getCmsPage, getFaqs, serverT, type CmsPage } from "@/lib/content";
import { PageSections } from "../page-sections";

interface Props {
  params: Promise<{ slug: string }>;
}

/** For block pages, the first text block stands in for a missing meta description. */
function describe(page: CmsPage): string {
  if (page.metaDesc) return page.metaDesc;
  if (page.template !== "sections") return markdownToText(page.content);
  for (const s of page.sections) {
    if (s.type === "rich_text" && s.config.content.trim()) return markdownToText(s.config.content);
    if (s.type === "image_text" && s.config.text.trim()) return markdownToText(s.config.text);
  }
  return "";
}

/** Store pages written in the admin (Content > Pages), e.g. /shipping-policy. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: true } };
  return {
    title: page.seoTitle || page.title,
    description: describe(page) || undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function CmsPageView({ params }: Props) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) notFound();

  if (page.template === "sections") {
    const faqs = page.sections.some((s) => s.type === "faq") ? await getFaqs() : null;
    return (
      <>
        <h1 className="sr-only">{page.title}</h1>
        <PageSections sections={page.sections} faqs={faqs ?? []} className="pt-6 md:pt-10" />
      </>
    );
  }

  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{(await serverT())("Last updated {date}", { date: formatDate(page.updatedAt) })}</p>
      <Markdown source={page.content} className="mt-8 text-[15px] md:text-base" />
    </div>
  );
}
