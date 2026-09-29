"use client";

/** Make or edit a landing page: the product, the offer, the top of the page, blocks and the order form. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Megaphone, Search, ShoppingBag, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea } from "@/components/ui";
import { Field, PageTitle, STOREFRONT_URL, Toggle, toSlug } from "@/components/content/shared";
import { ImageField } from "@/components/content/media-picker";
import { SectionsEditor, sectionProblem, withIds, withoutIds, type Section } from "@/components/content/sections-editor";
import { useDebounced } from "@/components/orders/order-pickers";
import { errorText } from "@/lib/features/content/content-api-slice";
import { usePickProductsQuery } from "@/lib/features/operations/manual-order-api-slice";
import { pageLink, useLandingPageQuery, useSaveLandingPageMutation, type LandingInput } from "@/lib/features/landing/landing-api-slice";
import { useCan } from "@/lib/permissions";

interface Picked {
  id: string;
  name: string;
  price: number | null;
}

const EMPTY = {
  title: "",
  slug: "",
  published: false,
  product: null as Picked | null,
  headline: "",
  subheadline: "",
  heroImageUrl: null as string | null,
  offerPrice: "",
  offerEndsAt: "",
  sections: [] as Section[],
  showReviews: true,
  ctaText: "Order now",
  formTitle: "",
  maxQty: "10",
  seoTitle: "",
  metaDesc: "",
};

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** ISO time → the value a datetime-local box shows (the browser's own time zone). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function ProductChooser({ value, onChange }: { value: Picked | null; onChange: (p: Picked | null) => void }) {
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePickProductsQuery(search, { skip: search.length < 2 });
  if (value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <span className="flex items-center gap-2 text-sm">
          <ShoppingBag className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="font-medium">{value.name}</span>
          {value.price !== null && <span className="text-slate-500">· {taka(value.price)}</span>}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X className="mr-1 h-4 w-4" /> Change
        </Button>
      </div>
    );
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input id="product" className="pl-9" placeholder="Search products by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      {search.length >= 2 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg dark:bg-slate-900">
          {data.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No published product matches."}</li>
          ) : (
            data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onChange({ id: p.id, name: p.name, price: p.price });
                    setQ("");
                  }}
                >
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <ShoppingBag className="h-9 w-9 p-2 text-slate-400" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span>{taka(p.price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function LandingPageEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";
  const { can } = useCan();
  const { data: page, isLoading } = useLandingPageQuery(params.id, { skip: isNew });
  const [save, { isLoading: saving }] = useSaveLandingPageMutation();
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (!page) return;
    setForm({
      title: page.title,
      slug: page.slug,
      published: page.status === "published",
      product: { id: page.product.id, name: page.product.name, price: page.product.price },
      headline: page.headline,
      subheadline: page.subheadline ?? "",
      heroImageUrl: page.heroImageUrl,
      offerPrice: page.offerPrice === null ? "" : String(page.offerPrice),
      offerEndsAt: toLocalInput(page.offerEndsAt),
      sections: withIds(page.sections),
      showReviews: page.showReviews,
      ctaText: page.ctaText,
      formTitle: page.formTitle ?? "",
      maxQty: String(page.maxQty),
      seoTitle: page.seoTitle ?? "",
      metaDesc: page.metaDesc ?? "",
    });
  }, [page]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onTitle = (title: string) => setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : toSlug(title) }));

  const offer = form.offerPrice.trim() === "" ? null : Number(form.offerPrice);
  const normal = form.product?.price ?? null;
  const offerProblem =
    offer === null
      ? null
      : !Number.isFinite(offer) || offer <= 0
        ? "Enter a price above 0."
        : normal !== null && offer >= normal
          ? `The normal price is ${taka(normal)}. An offer at or above it isn't used.`
          : null;
  const endsInPast = form.offerEndsAt !== "" && new Date(form.offerEndsAt).getTime() < Date.now();
  const maxQty = Number(form.maxQty);
  const blocksOk = form.sections.every((s) => !sectionProblem(s));
  const ready = form.title.trim() && form.headline.trim() && form.product && blocksOk && Number.isInteger(maxQty) && maxQty >= 1 && maxQty <= 100;
  const canSave = isNew ? can("pages.create") : can("pages.edit");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !form.product) return;
    const body: LandingInput = {
      title: form.title.trim(),
      slug: form.slug.trim() || toSlug(form.title),
      status: form.published ? "published" : "draft",
      productId: form.product.id,
      headline: form.headline.trim(),
      subheadline: form.subheadline.trim() || null,
      heroImageUrl: form.heroImageUrl,
      offerPrice: offer,
      offerEndsAt: form.offerEndsAt ? new Date(form.offerEndsAt).toISOString() : null,
      sections: withoutIds(form.sections),
      showReviews: form.showReviews,
      ctaText: form.ctaText.trim() || "Order now",
      formTitle: form.formTitle.trim() || null,
      maxQty,
      seoTitle: form.seoTitle.trim() || null,
      metaDesc: form.metaDesc.trim() || null,
    };
    try {
      const saved = await save(isNew ? body : { id: params.id, ...body }).unwrap();
      if (isNew) {
        toast.success("Landing page created");
        router.replace(`/online-store/landing-pages/${saved.id}`);
      } else {
        toast.success(page && page.slug !== saved.slug ? `Saved. Links to /lp/${page.slug} now go to /lp/${saved.slug}.` : "Landing page saved");
      }
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the landing page."));
    }
  };

  if (!isNew && isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <form onSubmit={submit} className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/online-store/landing-pages">
          <ArrowLeft className="mr-1 h-4 w-4" /> All landing pages
        </Link>
      </Button>
      <PageTitle
        icon={Megaphone}
        title={isNew ? "New landing page" : form.title || "Edit landing page"}
        actions={
          <>
            {page && (
              <Button variant="outline" asChild>
                <a href={pageLink(page)} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> {page.status === "published" ? "View on store" : "Preview"}
                </a>
              </Button>
            )}
            {canSave && (
              <Button type="submit" disabled={saving || !ready || !!offerProblem}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNew ? "Create page" : "Save changes"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top of the page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Product" htmlFor="product" hint="The product this page sells. Its photos, options, stock and reviews come from the catalog.">
                <ProductChooser value={form.product} onChange={(p) => set("product", p)} />
              </Field>
              <Field label="Headline" htmlFor="headline">
                <Input id="headline" required maxLength={200} value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="The panjabi for this Eid" />
              </Field>
              <Field label="Text under the headline" htmlFor="subheadline" hint="Optional. One or two sentences on why to buy.">
                <Textarea id="subheadline" rows={2} maxLength={500} value={form.subheadline} onChange={(e) => set("subheadline", e.target.value)} />
              </Field>
              <Field label="Main picture" htmlFor="hero" hint="Leave empty to use the product's first photo. Square pictures look best.">
                <ImageField id="hero" value={form.heroImageUrl} onChange={(v) => set("heroImageUrl", v)} aspect="square" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page offer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Offer price (৳)"
                htmlFor="offerPrice"
                hint={offerProblem ?? (normal !== null ? `Normal price ${taka(normal)}. Charged only on this page, for every option.` : "Charged only on this page, for every option.")}
              >
                <Input
                  id="offerPrice"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.offerPrice}
                  onChange={(e) => set("offerPrice", e.target.value)}
                  aria-invalid={!!offerProblem}
                  placeholder="No offer"
                />
              </Field>
              <Field
                label="Offer ends"
                htmlFor="offerEndsAt"
                hint={endsInPast ? "This time has passed: the page shows the normal price." : "Shows a countdown. Leave empty to keep the offer on."}
              >
                <Input id="offerEndsAt" type="datetime-local" value={form.offerEndsAt} onChange={(e) => set("offerEndsAt", e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-1 text-base font-semibold">Page blocks</h2>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Shown between the top of the page and the order form: pictures with text, features, questions and answers.</p>
            <SectionsEditor sections={form.sections} onChange={(sections) => set("sections", sections)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order form</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Button text" htmlFor="ctaText" hint={'"Order now" is shown in the shopper\'s language.'}>
                <Input id="ctaText" maxLength={60} value={form.ctaText} onChange={(e) => set("ctaText", e.target.value)} />
              </Field>
              <Field label="Most pieces per order" htmlFor="maxQty">
                <Input id="maxQty" type="number" min={1} max={100} value={form.maxQty} onChange={(e) => set("maxQty", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Form heading" htmlFor="formTitle" hint={'Leave empty for "Order now — pay when it arrives".'}>
                  <Input id="formTitle" maxLength={120} value={form.formTitle} onChange={(e) => set("formTitle", e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Toggle id="showReviews" checked={form.showReviews} onChange={(v) => set("showReviews", v)} label="Show reviews" hint="Up to six of the product's published reviews." />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {page && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How it's doing</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Visits", page.views.toLocaleString("en-IN")],
                    ["Orders", page.orders.toLocaleString("en-IN")],
                    ["Sales", taka(page.sales)],
                    ["Conversion", page.conversion === null ? "—" : `${page.conversion}%`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Conversion is orders per 100 visits. Cancelled orders aren't counted.</p>
                {page.orders > 0 && (
                  <Button variant="link" asChild className="mt-1 h-auto p-0">
                    <Link href="/orders?source=landing">See orders from landing pages</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Name" htmlFor="title" hint="For you; shoppers see the headline.">
                <Input id="title" required maxLength={200} value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="Eid panjabi — Facebook ad" />
              </Field>
              <Field label="Address" htmlFor="slug" hint={`${STOREFRONT_URL}/lp/${form.slug || toSlug(form.title) || "your-page"}`}>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", toSlug(e.target.value));
                  }}
                />
              </Field>
              <Toggle
                id="published"
                checked={form.published}
                onChange={(v) => set("published", v)}
                label="Published"
                hint="Drafts open only through the Preview link."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search engines and sharing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title" htmlFor="seoTitle" hint="Leave blank to use the page name.">
                <Input id="seoTitle" maxLength={200} value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
              </Field>
              <Field label="Description" htmlFor="metaDesc" hint={`${form.metaDesc.length}/320`}>
                <Textarea id="metaDesc" rows={3} maxLength={320} value={form.metaDesc} onChange={(e) => set("metaDesc", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
