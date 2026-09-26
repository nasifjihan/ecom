"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea } from "@/components/ui";
import { Field, MarkdownField, PageTitle, STOREFRONT_URL, Toggle, toSlug } from "@/components/content/shared";
import {
  errorText,
  useCreateCmsPageMutation,
  useGetCmsPageQuery,
  useUpdateCmsPageMutation,
  type CmsPageInput,
} from "@/lib/features/content/content-api-slice";

const EMPTY = { title: "", slug: "", content: "", isPublished: true, showInFooterMenu: false, seoTitle: "", metaDesc: "" };

export default function CmsPageEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";
  const { data: page, isLoading } = useGetCmsPageQuery(params.id, { skip: isNew });
  const [create, { isLoading: creating }] = useCreateCmsPageMutation();
  const [update, { isLoading: updating }] = useUpdateCmsPageMutation();
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (page) {
      setForm({
        title: page.title,
        slug: page.slug,
        content: page.content ?? "",
        isPublished: page.isPublished,
        showInFooterMenu: page.showInFooterMenu,
        seoTitle: page.seoTitle ?? "",
        metaDesc: page.metaDesc ?? "",
      });
    }
  }, [page]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onTitle = (title: string) => setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : toSlug(title) }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: CmsPageInput = {
      title: form.title.trim(),
      slug: form.slug.trim() || toSlug(form.title),
      content: form.content,
      isPublished: form.isPublished,
      showInFooterMenu: form.showInFooterMenu,
      seoTitle: form.seoTitle.trim() || null,
      metaDesc: form.metaDesc.trim() || null,
    };
    try {
      if (isNew) {
        const created = await create(body).unwrap();
        toast.success("Page created");
        router.replace(`/content/pages/${created.id}`);
      } else {
        await update({ id: params.id, ...body }).unwrap();
        toast.success("Page saved");
      }
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the page."));
    }
  };

  if (!isNew && isLoading) return <Skeleton className="h-96 w-full" />;

  const busy = creating || updating;
  return (
    <form onSubmit={save} className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/content/pages">
          <ArrowLeft className="mr-1 h-4 w-4" /> All pages
        </Link>
      </Button>
      <PageTitle
        icon={FileText}
        title={isNew ? "New page" : form.title || "Edit page"}
        actions={
          <>
            {!isNew && page?.isPublished && (
              <Button variant="outline" asChild>
                <a href={`${STOREFRONT_URL}/${page.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> View on store
                </a>
              </Button>
            )}
            <Button type="submit" disabled={busy || !form.title.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isNew ? "Create page" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <Field label="Title" htmlFor="title">
              <Input id="title" required maxLength={200} value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="Shipping Policy" />
            </Field>
            <MarkdownField id="content" label="Content" value={form.content} onChange={(v) => set("content", v)} rows={18} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                id="published"
                checked={form.isPublished}
                onChange={(v) => set("isPublished", v)}
                label="Published"
                hint="Hidden pages can't be opened on your store."
              />
              <Toggle
                id="footer"
                checked={form.showInFooterMenu}
                onChange={(v) => set("showInFooterMenu", v)}
                label="List in footer"
                hint="Adds the page to an Information column in the store footer."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search engines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="URL slug" htmlFor="slug" hint={`Address: /${form.slug || toSlug(form.title) || "page-url"}`}>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", toSlug(e.target.value));
                  }}
                />
              </Field>
              <Field label="SEO title" htmlFor="seoTitle" hint="Leave blank to use the page title.">
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
