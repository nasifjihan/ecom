import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@ecom/storefront-base";
import { formatDate, getBlogCategories, getBlogPosts, serverT } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blog",
  description: "Style guides, news and tips from our team.",
  alternates: { canonical: "/blog" },
};

type Props = { searchParams: Promise<{ page?: string; category?: string }> };

export default async function BlogIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const category = sp.category || undefined;
  const [result, categories, t] = await Promise.all([getBlogPosts(page, category), getBlogCategories(), serverT()]);
  const posts = result?.data ?? [];
  const totalPages = result?.meta.totalPages ?? 1;
  const href = (p: number, c = category) => {
    const q = new URLSearchParams({ ...(c ? { category: c } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return q ? `/blog?${q}` : "/blog";
  };

  return (
    <div className="container py-10 md:py-14">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t("Blog")}</h1>
      <p className="mt-2 text-muted-foreground">{t("Style guides, news and tips from our team.")}</p>

      {categories && categories.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("Blog categories")}>
          {[{ name: t("All"), slug: "" }, ...categories].map((c) => {
            const active = (c.slug || undefined) === category;
            return (
              <Link
                key={c.slug || "all"}
                href={href(1, c.slug || undefined)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">{t("No posts yet. Check back soon.")}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
              <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 to-primary/5">
                {p.featuredImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.featuredImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-5">
                <p className="text-xs text-muted-foreground">
                  {p.category?.name ? `${p.category.name} · ` : ""}
                  {formatDate(p.publishedAt ?? p.updatedAt)}
                </p>
                <h2 className="mt-1.5 text-lg font-semibold leading-snug group-hover:text-primary">{p.title}</h2>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href(page - 1)} className="rounded-md border px-4 py-2 hover:bg-accent">
              {t("Newer posts")}
            </Link>
          )}
          <span className="text-muted-foreground">
            {t("Page {page} of {pages}", { page, pages: totalPages })}
          </span>
          {page < totalPages && (
            <Link href={href(page + 1)} className="rounded-md border px-4 py-2 hover:bg-accent">
              {t("Older posts")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
