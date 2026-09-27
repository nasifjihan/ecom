import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Markdown, markdownToText } from "@ecom/ui";
import { formatDate, getBlogPost } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post not found", robots: { index: false, follow: true } };
  const description = post.metaDesc || post.excerpt || markdownToText(post.content);
  return {
    title: post.seoTitle || post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      ...(post.featuredImageUrl ? { images: [{ url: post.featuredImageUrl }] } : {}),
    },
  };
}

export default async function BlogPostView({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  return (
    <article className="container max-w-3xl py-10 md:py-14">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>
      <p className="mt-6 text-sm text-muted-foreground">
        {post.category && (
          <>
            <Link href={`/blog?category=${post.category.slug}`} className="text-primary hover:underline">
              {post.category.name}
            </Link>
            {" · "}
          </>
        )}
        {formatDate(post.publishedAt ?? post.updatedAt)}
        {post.author?.name ? ` · ${post.author.name}` : ""}
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
      {post.excerpt && <p className="mt-3 text-lg text-muted-foreground">{post.excerpt}</p>}
      {post.featuredImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.featuredImageUrl} alt="" className="mt-8 aspect-[16/9] w-full rounded-xl object-cover" />
      )}
      <Markdown source={post.content} className="mt-8 text-[15px] md:text-base" />
      {post.tags && post.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
