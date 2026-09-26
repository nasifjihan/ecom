"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlignLeft, ArrowLeft, Blocks, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, MarkdownField, PageTitle, STOREFRONT_URL, Toggle, toSlug } from "@/components/content/shared";
import { SectionsEditor, newSection, sectionProblem, withIds, type Section } from "@/components/content/sections-editor";
import {
  errorText,
  useCreateCmsPageMutation,
  useGetCmsPageQuery,
  useUpdateCmsPageMutation,
  type CmsPageInput,
  type PageTemplate,
} from "@/lib/features/content/content-api-slice";

const EMPTY = {
  title: "",
  slug: "",
  content: "",
  template: "text" as PageTemplate,
  sections: [] as Section[],
  isPublished: true,
  showInFooterMenu: false,
  seoTitle: "",
  metaDesc: "",
};

const LAYOUTS: { value: PageTemplate; label: string; text: string; icon: typeof Blocks }[] = [
  { value: "text", label: "Text page", text: "One block of formatted text, for policies and simple pages.", icon: AlignLeft },
  { value: "sections", label: "Built from blocks", text: "Drag in images, banners, products and text to design the page.", icon: Blocks },
];

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
        template: page.template === "sections" ? "sections" : "text",
        sections: withIds(page.sections),
        isPublished: page.isPublished,
        showInFooterMenu: page.showInFooterMenu,
        seoTitle: page.seoTitle ?? "",
        metaDesc: page.metaDesc ?? "",
      });
    }
  }, [page]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Switching to blocks for the first time starts with the page's text, so nothing written is lost. */
  const setTemplate = (template: PageTemplate) =>
    setForm((f) => {
      if (template === "sections" && f.sections.length === 0) {
        const first = newSection("rich_text");
        return { ...f, template, sections: f.content.trim() ? [{ ...first, config: { content: f.content } } as Section] : [first] };
      }
      return { ...f, template };
    });

  const onTitle = (title: string) => setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : toSlug(title) }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: CmsPageInput = {
      title: form.title.trim(),
      slug: form.slug.trim() || toSlug(form.title),
      content: form.content,
      template: form.template,
      sections: form.sections,
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
  const blocksOk = form.template === "text" || form.sections.every((s) => !sectionProblem(s));
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
            <Button type="submit" disabled={busy || !form.title.trim() || !blocksOk}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isNew ? "Create page" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <Field label="Title" htmlFor="title">
                <Input id="title" required maxLength={200} value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="Shipping Policy" />
              </Field>
              <div className="space-y-1.5">
                <Label>Layout</Label>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Layout">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      role="radio"
                      aria-checked={form.template === l.value}
                      onClick={() => setTemplate(l.value)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                        form.template === l.value
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-500/10"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700",
                      )}
                    >
                      <l.icon className={cn("mt-0.5 h-5 w-5 shrink-0", form.template === l.value ? "text-blue-600" : "text-slate-400")} />
                      <span>
                        <span className="block text-sm font-medium">{l.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{l.text}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {form.template === "text" && <MarkdownField id="content" label="Content" value={form.content} onChange={(v) => set("content", v)} rows={18} />}
            </CardContent>
          </Card>
          {form.template === "sections" && <SectionsEditor sections={form.sections} onChange={(sections) => set("sections", sections)} />}
        </div>

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
