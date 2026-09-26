"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Newspaper } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea } from "@/components/ui";
import { Field, MarkdownField, PageTitle, STOREFRONT_URL, toSlug } from "@/components/content/shared";
import {
  errorText,
  useCreateBlogPostMutation,
  useGetBlogCategoriesQuery,
  useGetBlogPostQuery,
  useUpdateBlogPostMutation,
  type BlogPostInput,
  type PostStatus,
} from "@/lib/features/content/content-api-slice";

const EMPTY = {
  title: "",
  slug: "",
  categoryId: "",
  excerpt: "",
  content: "",
  featuredImageUrl: "",
  tags: "",
  status: "draft" as PostStatus,
  seoTitle: "",
  metaDesc: "",
};

export default function BlogPostEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";
  const { data: post, isLoading } = useGetBlogPostQuery(params.id, { skip: isNew });
  const { data: categories = [] } = useGetBlogCategoriesQuery();
  const [create, { isLoading: creating }] = useCreateBlogPostMutation();
  const [update, { isLoading: updating }] = useUpdateBlogPostMutation();
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title,
        slug: post.slug,
        categoryId: post.categoryId ?? "",
        excerpt: post.excerpt ?? "",
        content: post.content ?? "",
        featuredImageUrl: post.featuredImageUrl ?? "",
        tags: (post.tags ?? []).join(", "),
        status: post.status,
        seoTitle: post.seoTitle ?? "",
        metaDesc: post.metaDesc ?? "",
      });
    }
  }, [post]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (status: PostStatus) => {
    const body: BlogPostInput = {
      title: form.title.trim(),
      slug: form.slug || toSlug(form.title),
      categoryId: form.categoryId || null,
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      featuredImageUrl: form.featuredImageUrl.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status,
      seoTitle: form.seoTitle.trim() || null,
      metaDesc: form.metaDesc.trim() || null,
    };
    try {
      if (isNew) {
        const created = await create(body).unwrap();
        toast.success(status === "published" ? "Post published" : "Draft saved");
        router.replace(`/content/blog/${created.id}`);
      } else {
        await update({ id: params.id, ...body }).unwrap();
        setForm((f) => ({ ...f, status }));
        toast.success(status === "published" ? "Post published" : "Saved as draft");
      }
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the post."));
    }
  };

  if (!isNew && isLoading) return <Skeleton className="h-96 w-full" />;

  const busy = creating || updating;
  const valid = !!form.title.trim();
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(form.status);
      }}
    >
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/content/blog">
          <ArrowLeft className="mr-1 h-4 w-4" /> All posts
        </Link>
      </Button>
      <PageTitle
        icon={Newspaper}
        title={isNew ? "New post" : form.title || "Edit post"}
        description={isNew ? undefined : form.status === "published" ? "Published" : "Draft, not visible on your store yet"}
        actions={
          <>
            {!isNew && post?.status === "published" && (
              <Button type="button" variant="outline" asChild>
                <a href={`${STOREFRONT_URL}/blog/${post.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> View
                </a>
              </Button>
            )}
            {form.status === "published" ? (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => save("draft")}>
                  Unpublish
                </Button>
                <Button type="submit" disabled={busy || !valid}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={busy || !valid} onClick={() => save("draft")}>
                  Save draft
                </Button>
                <Button type="button" disabled={busy || !valid} onClick={() => save("published")}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Publish
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: slugTouched ? f.slug : toSlug(e.target.value) }))}
              />
            </Field>
            <Field label="Excerpt" htmlFor="excerpt" hint="A short summary shown on the blog list.">
              <Textarea id="excerpt" rows={2} maxLength={500} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
            </Field>
            <MarkdownField id="content" label="Content" value={form.content} onChange={(v) => set("content", v)} rows={20} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Category" htmlFor="category">
                <select
                  id="category"
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tags" htmlFor="tags" hint="Separate with commas.">
                <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="eid, style" />
              </Field>
              <Field label="Cover image URL" htmlFor="image" hint="Paste an image link, e.g. from Catalog > Media.">
                <Input id="image" value={form.featuredImageUrl} onChange={(e) => set("featuredImageUrl", e.target.value)} placeholder="https://..." />
              </Field>
              {form.featuredImageUrl && /^(https?:\/\/|\/)/.test(form.featuredImageUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.featuredImageUrl} alt="" className="aspect-video w-full rounded-md border object-cover" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search engines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="URL slug" htmlFor="slug" hint={`Address: /blog/${form.slug || "post-url"}`}>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", toSlug(e.target.value));
                  }}
                />
              </Field>
              <Field label="SEO title" htmlFor="seoTitle">
                <Input id="seoTitle" maxLength={200} value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
              </Field>
              <Field label="Meta description" htmlFor="metaDesc" hint={`${form.metaDesc.length}/320`}>
                <Textarea id="metaDesc" rows={3} maxLength={320} value={form.metaDesc} onChange={(e) => set("metaDesc", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
