"use client";

/** Make or edit a gift box: the box product, how many items, what it takes, and the message card. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Gift, Loader2, Search, ShoppingBag, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea } from "@/components/ui";
import { Field, PageTitle, STOREFRONT_URL, Toggle, toSlug } from "@/components/content/shared";
import { ImageField } from "@/components/content/media-picker";
import { useDebounced } from "@/components/orders/order-pickers";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useGetCategoryTreeQuery, type Category } from "@/lib/features/catalog/catalog-api-slice";
import { usePickProductsQuery, type PickProduct } from "@/lib/features/operations/manual-order-api-slice";
import { useGiftBoxQuery, useSaveGiftBoxMutation, type GiftBoxInput } from "@/lib/features/giftboxes/giftboxes-api-slice";
import { useCan } from "@/lib/permissions";

interface Named {
  id: string;
  name: string;
}

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  imageUrl: null as string | null,
  box: null as (Named & { price: number | null }) | null,
  minItems: "2",
  maxItems: "6",
  products: [] as Named[],
  categoryIds: [] as string[],
  allowMessage: true,
  messageMax: "200",
  isActive: true,
  sortOrder: "0",
};

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Search box for published products; `onPick` gets the chosen one. */
function ProductSearch({ id, onPick, exclude }: { id: string; onPick: (p: PickProduct) => void; exclude: string[] }) {
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePickProductsQuery(search, { skip: search.length < 2 });
  const list = data.filter((p) => !exclude.includes(p.id));
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input id={id} className="pl-9" placeholder="Search products by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      {search.length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-white shadow-lg dark:bg-slate-900">
          {list.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No published product matches."}</li>
          ) : (
            list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onPick(p);
                    setQ("");
                  }}
                >
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <ShoppingBag className="h-9 w-9 p-2 text-slate-400" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-slate-500">{p.variantCount > 0 ? `${p.variantCount} options` : taka(p.price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** The category tree as a flat, indented list. */
function flatten(nodes: Category[], depth = 0): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((c) => [{ id: String(c.id), name: c.name, depth }, ...flatten(c.children ?? [], depth + 1)]);
}

export default function GiftBoxEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";
  const { can } = useCan();
  const { data: box, isLoading } = useGiftBoxQuery(params.id, { skip: isNew });
  const { data: tree = [] } = useGetCategoryTreeQuery();
  const categories = useMemo(() => flatten(tree), [tree]);
  const [save, { isLoading: saving }] = useSaveGiftBoxMutation();
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (!box) return;
    setForm({
      name: box.name,
      slug: box.slug,
      description: box.description ?? "",
      imageUrl: box.imageUrl,
      box: { id: box.boxProduct.id, name: box.boxProduct.name, price: box.boxProduct.price },
      minItems: String(box.minItems),
      maxItems: String(box.maxItems),
      products: box.products ?? [],
      categoryIds: box.categoryIds,
      allowMessage: box.allowMessage,
      messageMax: String(box.messageMax),
      isActive: box.isActive,
      sortOrder: String(box.sortOrder),
    });
  }, [box]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onName = (name: string) => setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : toSlug(name) }));
  const toggleCategory = (id: string) =>
    set("categoryIds", form.categoryIds.includes(id) ? form.categoryIds.filter((c) => c !== id) : [...form.categoryIds, id]);

  const min = Number(form.minItems);
  const max = Number(form.maxItems);
  const messageMax = Number(form.messageMax);
  const countsProblem =
    !Number.isInteger(min) || min < 1 || !Number.isInteger(max) || max > 50 ? "Use whole numbers from 1 to 50." : max < min ? "The most can't be fewer than the fewest." : null;
  const ready = form.name.trim() && form.box && !countsProblem && (!form.allowMessage || (messageMax >= 10 && messageMax <= 1000));
  const canSave = isNew ? can("products.create") : can("products.edit");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !form.box) return;
    const body: GiftBoxInput = {
      slug: form.slug.trim() || toSlug(form.name),
      name: form.name.trim(),
      description: form.description.trim() || null,
      imageUrl: form.imageUrl,
      boxProductId: form.box.id,
      minItems: min,
      maxItems: max,
      productIds: form.products.map((p) => p.id),
      categoryIds: form.categoryIds,
      allowMessage: form.allowMessage,
      messageMax: form.allowMessage ? messageMax : 200,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      const saved = await save(isNew ? body : { id: params.id, ...body }).unwrap();
      toast.success(isNew ? "Gift box created" : "Gift box saved");
      if (isNew) router.replace(`/catalog/gift-boxes/${saved.id}`);
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the gift box."));
    }
  };

  if (!isNew && isLoading) return <Skeleton className="h-96 w-full" />;
  const takesAnything = !form.products.length && !form.categoryIds.length;

  return (
    <form onSubmit={submit} className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/catalog/gift-boxes">
          <ArrowLeft className="mr-1 h-4 w-4" /> All gift boxes
        </Link>
      </Button>
      <PageTitle
        icon={Gift}
        title={isNew ? "New gift box" : form.name || "Gift box"}
        actions={
          <>
            {box && box.isActive && (
              <Button variant="outline" asChild>
                <a href={`${STOREFRONT_URL}/gift-boxes/${box.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> View on store
                </a>
              </Button>
            )}
            {canSave && (
              <Button type="submit" disabled={saving || !ready}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNew ? "Create gift box" : "Save changes"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The box</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Name" htmlFor="name">
                <Input id="name" required maxLength={120} value={form.name} onChange={(e) => onName(e.target.value)} placeholder="Eid gift box" />
              </Field>
              <Field label="Description" htmlFor="description" hint="Optional. Shown at the top of the box's page.">
                <Textarea id="description" rows={2} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field
                label="Box product"
                htmlFor="boxProduct"
                hint="The box itself, as a product: its price is added to the box, its stock is the boxes you have, and its options (colours, sizes) are the styles shoppers pick."
              >
                {form.box ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-slate-400" aria-hidden />
                      <span className="font-medium">{form.box.name}</span>
                      {form.box.price !== null && <span className="text-slate-500">· {taka(form.box.price)}</span>}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => set("box", null)}>
                      <X className="mr-1 h-4 w-4" /> Change
                    </Button>
                  </div>
                ) : (
                  <ProductSearch id="boxProduct" exclude={form.products.map((p) => p.id)} onPick={(p) => set("box", { id: p.id, name: p.name, price: p.price })} />
                )}
              </Field>
              <Field label="Picture" htmlFor="image" hint="Leave empty to use the box product's photo.">
                <ImageField id="image" value={form.imageUrl} onChange={(v) => set("imageUrl", v)} aspect="wide" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What goes in it</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Fewest items" htmlFor="minItems">
                  <Input id="minItems" type="number" min={1} max={50} value={form.minItems} onChange={(e) => set("minItems", e.target.value)} />
                </Field>
                <Field label="Most items" htmlFor="maxItems">
                  <Input id="maxItems" type="number" min={1} max={50} value={form.maxItems} onChange={(e) => set("maxItems", e.target.value)} />
                </Field>
              </div>
              {countsProblem && <p className="text-sm text-rose-600">{countsProblem}</p>}

              <div className="space-y-2">
                <p className="text-sm font-medium">Categories</p>
                <p className="text-xs text-slate-500">Anything in these categories (and their sub-categories) can go in.</p>
                <div className="max-h-56 overflow-auto rounded-md border p-2">
                  {categories.length === 0 ? (
                    <p className="p-2 text-sm text-slate-500">No categories yet.</p>
                  ) : (
                    categories.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" style={{ paddingLeft: 8 + c.depth * 16 }}>
                        <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={form.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                        {c.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <Field label="Other products" htmlFor="pickProducts" hint="Products that can go in wherever they're listed.">
                <ProductSearch
                  id="pickProducts"
                  exclude={[...form.products.map((p) => p.id), ...(form.box ? [form.box.id] : [])]}
                  onPick={(p) => set("products", [...form.products, { id: p.id, name: p.name }])}
                />
              </Field>
              {form.products.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {form.products.map((p) => (
                    <li key={p.id} className="flex items-center gap-1 rounded-full border bg-slate-50 py-1 pl-3 pr-1 text-sm dark:bg-slate-800">
                      {p.name}
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-slate-400 hover:text-rose-600"
                        onClick={() => set("products", form.products.filter((x) => x.id !== p.id))}
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {takesAnything && <p className="text-sm text-amber-700 dark:text-amber-400">With no categories or products chosen, any product can go in the box.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">On the store</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle id="isActive" checked={form.isActive} onChange={(v) => set("isActive", v)} label="On sale" hint="Switched off, it's hidden and boxes in carts can't be ordered." />
              <Field label="Address" htmlFor="slug" hint={`${STOREFRONT_URL}/gift-boxes/${form.slug || toSlug(form.name) || "your-box"}`}>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", toSlug(e.target.value));
                  }}
                />
              </Field>
              <Field label="Order in the list" htmlFor="sortOrder" hint="Lower numbers come first.">
                <Input id="sortOrder" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle id="allowMessage" checked={form.allowMessage} onChange={(v) => set("allowMessage", v)} label="Shoppers can add a message" hint="Shown on the order, for you to write or print the card." />
              {form.allowMessage && (
                <Field label="Longest message (characters)" htmlFor="messageMax">
                  <Input id="messageMax" type="number" min={10} max={1000} value={form.messageMax} onChange={(e) => set("messageMax", e.target.value)} />
                </Field>
              )}
            </CardContent>
          </Card>
          {box && (
            <Card>
              <CardContent className="pt-6 text-sm">
                <p className="text-slate-500">Sold</p>
                <p className="text-2xl font-semibold tabular-nums">{box.sold}</p>
                <p className="mt-1 text-xs text-slate-500">Boxes on orders that weren't cancelled.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
