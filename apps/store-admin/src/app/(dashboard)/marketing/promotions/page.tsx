"use client";

/**
 * Automatic promotions: offers that apply by themselves at checkout, no code needed. Only the best
 * discount applies to an order; buy X get Y, free gifts and free delivery come on top. Each one can
 * show in storefront slots (announcement bar, home, product page, cart…).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Gift, Pause, Pencil, Play, Plus, Search, Sparkles, Square, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  cn,
} from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  PROMOTION_SLOTS,
  PROMOTION_TYPES,
  useCreatePromotionMutation,
  useDeletePromotionMutation,
  useEndPromotionMutation,
  usePromoCategoriesQuery,
  usePromoPickProductsQuery,
  usePromoPickVariantsQuery,
  usePromoProductsByIdsQuery,
  usePromotionsQuery,
  useUpdatePromotionMutation,
  type PickedProduct,
  type Promotion,
  type PromotionInput,
  type PromotionState,
  type PromotionType,
} from "@/lib/features/marketing/promotions-api-slice";

const taka = (n: number | null | undefined) => `৳${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const SLOT_LABEL = Object.fromEntries(PROMOTION_SLOTS.map((s) => [s.value, s.label]));
const STATE_BADGE: Record<PromotionState, string> = {
  live: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ended: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ------------------------------------------------------------------ form model

interface Form {
  name: string;
  type: PromotionType;
  discountType: "percentage" | "fixed";
  discountValue: string;
  maxDiscount: string;
  minOrder: string;
  minQty: string;
  scope: "all" | "products" | "categories";
  products: PickedProduct[];
  categoryIds: string[];
  includeSaleItems: boolean;
  buyQty: string;
  getQty: string;
  gift: { productId: string; variantId: string | null; label: string } | null;
  giftQty: string;
  slots: string[];
  headline: string;
  message: string;
  imageUrl: string;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const EMPTY: Form = {
  name: "",
  type: "discount",
  discountType: "percentage",
  discountValue: "",
  maxDiscount: "",
  minOrder: "",
  minQty: "",
  scope: "all",
  products: [],
  categoryIds: [],
  includeSaleItems: false,
  buyQty: "2",
  getQty: "1",
  gift: null,
  giftQty: "1",
  slots: ["announcement_bar", "cart"],
  headline: "",
  message: "",
  imageUrl: "",
  linkUrl: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

/** Festival starters; the shop fills in dates and adjusts. */
const TEMPLATES: { label: string; form: Partial<Form> }[] = [
  {
    label: "Eid Sale",
    form: { name: "Eid Sale", type: "discount", discountType: "percentage", discountValue: "15", maxDiscount: "1000", minOrder: "2000", slots: ["announcement_bar", "home_hero", "cart"], headline: "Eid Mubarak! 15% off", message: "15% off orders over ৳2,000 (up to ৳1,000). No code needed." },
  },
  {
    label: "Pohela Boishakh",
    form: { name: "Pohela Boishakh", type: "discount", discountType: "fixed", discountValue: "300", minOrder: "2500", slots: ["announcement_bar", "home_offers", "cart"], headline: "Shubho Noboborsho: ৳300 off", message: "৳300 off orders over ৳2,500." },
  },
  {
    label: "Durga Puja",
    form: { name: "Durga Puja offer", type: "free_delivery", minOrder: "1500", slots: ["announcement_bar", "cart", "checkout"], headline: "Puja special: free delivery", message: "Free delivery on orders over ৳1,500." },
  },
  {
    label: "Winter Sale",
    form: { name: "Winter Sale", type: "bxgy", buyQty: "2", getQty: "1", slots: ["home_offers", "product_detail", "cart"], headline: "Winter Sale: buy 2 get 1 free", message: "Buy any 2 of the same item and get a third free." },
  },
];

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function fromPromotion(p: Promotion): Form {
  return {
    name: p.name,
    type: p.type,
    discountType: p.discountType ?? "percentage",
    discountValue: p.discountValue?.toString() ?? "",
    maxDiscount: p.maxDiscount?.toString() ?? "",
    minOrder: p.minOrder?.toString() ?? "",
    minQty: p.minQty?.toString() ?? "",
    scope: p.productIds.length ? "products" : p.categoryIds.length ? "categories" : "all",
    products: p.productIds.map((id) => ({ id, name: `Product #${id}`, sku: null, imageUrl: null })),
    categoryIds: p.categoryIds,
    includeSaleItems: p.includeSaleItems,
    buyQty: p.buyQty?.toString() ?? "2",
    getQty: p.getQty?.toString() ?? "1",
    gift: p.giftProductId ? { productId: p.giftProductId, variantId: p.giftVariantId, label: p.gift?.name ?? `Product #${p.giftProductId}` } : null,
    giftQty: String(p.giftQty),
    slots: p.slots,
    headline: p.headline ?? "",
    message: p.message ?? "",
    imageUrl: p.imageUrl ?? "",
    linkUrl: p.linkUrl ?? "",
    startsAt: toLocal(p.startsAt),
    endsAt: toLocal(p.endsAt),
    isActive: p.isActive,
  };
}

function toInput(f: Form): PromotionInput {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    name: f.name.trim(),
    type: f.type,
    discountType: f.type === "discount" ? f.discountType : null,
    discountValue: f.type === "discount" ? n(f.discountValue) : null,
    maxDiscount: f.type === "discount" && f.discountType === "percentage" ? n(f.maxDiscount) : null,
    minOrder: n(f.minOrder),
    minQty: n(f.minQty),
    productIds: f.scope === "products" ? f.products.map((p) => p.id) : [],
    categoryIds: f.scope === "categories" ? f.categoryIds : [],
    includeSaleItems: f.includeSaleItems,
    buyQty: f.type === "bxgy" ? n(f.buyQty) : null,
    getQty: f.type === "bxgy" ? n(f.getQty) : null,
    giftProductId: f.type === "free_gift" ? (f.gift?.productId ?? null) : null,
    giftVariantId: f.type === "free_gift" ? (f.gift?.variantId ?? null) : null,
    giftQty: Number(f.giftQty) || 1,
    slots: f.slots,
    headline: f.headline.trim() || null,
    message: f.message.trim() || null,
    imageUrl: f.imageUrl.trim() || null,
    linkUrl: f.linkUrl.trim() || null,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    isActive: f.isActive,
  };
}

// ------------------------------------------------------------------ pickers

/** Finds a published product; options (size, colour) are chosen by the caller when it needs one. */
function ProductSearch({ onPick, placeholder }: { onPick: (p: PickedProduct) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePromoPickProductsQuery(search, { skip: search.length < 2 });
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input className="pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label={placeholder} />
      {search.length >= 2 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-white shadow-lg dark:bg-slate-900">
          {data.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No published product matches."}</li>
          ) : (
            data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    setQ("");
                    onPick(p);
                  }}
                >
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" /> : <Gift className="h-8 w-8 p-1.5 text-slate-400" />}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-slate-500">{p.variantCount ? `${p.variantCount} options` : taka(p.price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ dialog

function PromotionDialog({ initial, editing, onClose }: { initial: Form; editing: Promotion | null; onClose: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const [create, { isLoading: creating }] = useCreatePromotionMutation();
  const [update, { isLoading: saving }] = useUpdatePromotionMutation();
  const { data: categories = [] } = usePromoCategoriesQuery(undefined, { skip: f.scope !== "categories" });
  const { data: named } = usePromoProductsByIdsQuery(initial.products.map((p) => p.id), { skip: !initial.products.length });
  const [giftChoosing, setGiftChoosing] = useState<PickedProduct | null>(null);
  const { data: giftVariants = [] } = usePromoPickVariantsQuery(giftChoosing?.id ?? "", { skip: !giftChoosing });

  // Real names for the products of an edited promotion.
  useEffect(() => {
    if (named?.length) setF((x) => ({ ...x, products: x.products.map((p) => named.find((n) => n.id === p.id) ?? p) }));
  }, [named]);

  const discounting = f.type === "discount" || f.type === "bxgy";
  const typeHelp = PROMOTION_TYPES.find((t) => t.value === f.type)?.help;

  async function save() {
    try {
      const body = toInput(f);
      if (editing) await update({ id: editing.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success(editing ? "Promotion saved" : "Promotion created");
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "New promotion"}</DialogTitle>
          <DialogDescription>Applies by itself at checkout when the order qualifies. No code needed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label="Name" htmlFor="p-name" hint="Customers see it next to the discount in their cart.">
            <Input id="p-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Eid Sale" />
          </Field>

          <div>
            <Label className="mb-2 block">What does it do?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROMOTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("type", t.value)}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition-colors",
                    f.type === t.value ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                  )}
                  aria-pressed={f.type === t.value}
                >
                  <span className="font-medium">{t.label}</span>
                </button>
              ))}
            </div>
            {typeHelp && <p className="mt-2 text-xs text-slate-500">{typeHelp}</p>}
          </div>

          {f.type === "discount" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Discount type" htmlFor="p-dtype">
                <select id="p-dtype" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.discountType} onChange={(e) => set("discountType", e.target.value as Form["discountType"])}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount (৳)</option>
                </select>
              </Field>
              <Field label={f.discountType === "percentage" ? "Percent off" : "Amount off (৳)"} htmlFor="p-dval">
                <Input id="p-dval" type="number" min={0} value={f.discountValue} onChange={(e) => set("discountValue", e.target.value)} />
              </Field>
              {f.discountType === "percentage" && (
                <Field label="Largest discount (৳)" htmlFor="p-max" hint="Optional cap">
                  <Input id="p-max" type="number" min={0} value={f.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} />
                </Field>
              )}
            </div>
          )}

          {f.type === "bxgy" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer buys" htmlFor="p-buy">
                <Input id="p-buy" type="number" min={1} value={f.buyQty} onChange={(e) => set("buyQty", e.target.value)} />
              </Field>
              <Field label="And gets free" htmlFor="p-get" hint="Of the same product; the cheapest options are the free ones.">
                <Input id="p-get" type="number" min={1} value={f.getQty} onChange={(e) => set("getQty", e.target.value)} />
              </Field>
            </div>
          )}

          {f.type === "free_gift" && (
            <div className="space-y-2">
              <Label>Gift</Label>
              {f.gift ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    <Gift className="mr-2 inline h-4 w-4 text-pink-600" />
                    {f.gift.label}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("gift", null)}>
                    Change
                  </Button>
                </div>
              ) : giftChoosing ? (
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Which option of {giftChoosing.name}?</p>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setGiftChoosing(null)} aria-label="Cancel">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {giftVariants.map((v) => (
                      <Button
                        key={v.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          set("gift", { productId: giftChoosing.id, variantId: v.id, label: `${giftChoosing.name} (${v.label})` });
                          setGiftChoosing(null);
                        }}
                      >
                        {v.label}
                        <span className="ml-1 text-xs text-slate-400">{v.manageStock ? `${v.stockQty ?? 0} left` : ""}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <ProductSearch
                  placeholder="Search the gift product"
                  onPick={(p) => (p.variantCount ? setGiftChoosing(p) : set("gift", { productId: p.id, variantId: null, label: p.name }))}
                />
              )}
              <Field label="How many" htmlFor="p-gqty" className="max-w-[10rem]">
                <Input id="p-gqty" type="number" min={1} max={20} value={f.giftQty} onChange={(e) => set("giftQty", e.target.value)} />
              </Field>
              <p className="text-xs text-slate-500">It comes out of stock like a sale. When it runs out, orders go through without it.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum order (৳)" htmlFor="p-min" hint={f.scope === "all" ? "Optional" : "Spent on the chosen items. Optional."}>
              <Input id="p-min" type="number" min={0} value={f.minOrder} onChange={(e) => set("minOrder", e.target.value)} />
            </Field>
            <Field label="Minimum quantity" htmlFor="p-minq" hint="Optional">
              <Input id="p-minq" type="number" min={1} value={f.minQty} onChange={(e) => set("minQty", e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2">
            <Label>Which products?</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Whole store"],
                  ["products", "Chosen products"],
                  ["categories", "Whole categories"],
                ] as const
              ).map(([v, l]) => (
                <Button key={v} type="button" size="sm" variant={f.scope === v ? "default" : "outline"} onClick={() => set("scope", v)}>
                  {l}
                </Button>
              ))}
            </div>
            {f.scope === "products" && (
              <div className="space-y-2">
                <ProductSearch
                  placeholder="Add a product"
                  onPick={(p) => !f.products.some((x) => x.id === p.id) && set("products", [...f.products, p])}
                />
                <div className="flex flex-wrap gap-2">
                  {f.products.map((p) => (
                    <Badge key={p.id} variant="secondary" className="gap-1">
                      {p.name}
                      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => set("products", f.products.filter((x) => x.id !== p.id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {f.scope === "categories" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: c.depth * 16 }}>
                    <Checkbox
                      checked={f.categoryIds.includes(c.id)}
                      onCheckedChange={(v) => set("categoryIds", v ? [...f.categoryIds, c.id] : f.categoryIds.filter((x) => x !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
                {!categories.length && <p className="p-2 text-sm text-slate-500">No categories yet.</p>}
              </div>
            )}
            {discounting && (
              <Toggle
                checked={f.includeSaleItems}
                onChange={(v) => set("includeSaleItems", v)}
                label="Also discount items already on sale"
                hint="Off: flash-sale and marked-down items don't get this discount or count toward its minimum."
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Where should it show?</Label>
            <div className="grid gap-1 sm:grid-cols-2">
              {PROMOTION_SLOTS.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.slots.includes(s.value)} onCheckedChange={(v) => set("slots", v ? [...f.slots, s.value] : f.slots.filter((x) => x !== s.value))} />
                  {s.label}
                </label>
              ))}
            </div>
            {f.slots.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Headline" htmlFor="p-head" hint="Leave empty to use what the offer is, e.g. “Free delivery over ৳1,500”.">
                  <Input id="p-head" value={f.headline} onChange={(e) => set("headline", e.target.value)} />
                </Field>
                <Field label="Link" htmlFor="p-link" hint="Optional, e.g. /categories/panjabi">
                  <Input id="p-link" value={f.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} />
                </Field>
                <Field label="Message" htmlFor="p-msg" className="sm:col-span-2">
                  <Textarea id="p-msg" rows={2} value={f.message} onChange={(e) => set("message", e.target.value)} />
                </Field>
                <Field label="Banner image URL" htmlFor="p-img" hint="Optional, for home and pop-up slots" className="sm:col-span-2">
                  <Input id="p-img" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts" htmlFor="p-start" hint="Empty = now">
              <Input id="p-start" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </Field>
            <Field label="Ends" htmlFor="p-end" hint="Empty = until you end it">
              <Input id="p-end" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </Field>
          </div>
          <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Active" hint="Off pauses it without losing the settings." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={creating || saving || f.name.trim().length < 2}>
            {creating || saving ? "Saving…" : editing ? "Save" : "Create promotion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ page

const TABS: { value: PromotionState | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

export default function PromotionsPage() {
  const [tab, setTab] = useState<PromotionState | "all">("all");
  const { data, isLoading } = usePromotionsQuery();
  const { can } = useCan();
  const [dialog, setDialog] = useState<{ form: Form; editing: Promotion | null } | null>(null);
  const [update] = useUpdatePromotionMutation();
  const [end] = useEndPromotionMutation();
  const [remove] = useDeletePromotionMutation();

  const rows = useMemo(() => (data ?? []).filter((p) => tab === "all" || p.state === tab), [data, tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, (data ?? []).filter((p) => t.value === "all" || p.state === t.value).length])), [data]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Sparkles}
        title="Promotions"
        description="Offers that apply by themselves at checkout. Only the best discount applies to an order; buy X get Y, free gifts and free delivery come on top."
        actions={
          can("promotions.create") && (
            <Button onClick={() => setDialog({ form: EMPTY, editing: null })}>
              <Plus className="mr-2 h-4 w-4" /> New promotion
            </Button>
          )
        }
      />

      {can("promotions.create") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Quick start:</span>
          {TEMPLATES.map((t) => (
            <Button key={t.label} variant="outline" size="sm" onClick={() => setDialog({ form: { ...EMPTY, ...t.form }, editing: null })}>
              {t.label}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <Button key={t.value} role="tab" aria-selected={tab === t.value} size="sm" variant={tab === t.value ? "default" : "outline"} onClick={() => setTab(t.value)}>
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">{counts[t.value] ?? 0}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !rows.length ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {data?.length ? "No promotions here." : "No promotions yet. Start from a festival template above, or create one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>What it does</TableHead>
                    <TableHead>Applies to</TableHead>
                    <TableHead>Shows on</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.summary}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {p.productIds.length ? `${p.productIds.length} product${p.productIds.length > 1 ? "s" : ""}` : p.categoryIds.length ? `${p.categoryIds.length} categor${p.categoryIds.length > 1 ? "ies" : "y"}` : "Whole store"}
                      </TableCell>
                      <TableCell className="max-w-[14rem] text-xs text-slate-600">{p.slots.length ? p.slots.map((s) => SLOT_LABEL[s] ?? s).join(", ") : "Not shown"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {p.startsAt ? day(p.startsAt) : "Now"} → {p.endsAt ? day(p.endsAt) : "no end"}
                      </TableCell>
                      <TableCell>{p.usedCount}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATE_BADGE[p.state])}>{p.state}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {can("promotions.edit") && (
                          <>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setDialog({ form: fromPromotion(p), editing: p })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {p.state !== "ended" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={p.isActive ? `Pause ${p.name}` : `Resume ${p.name}`}
                                title={p.isActive ? "Pause" : "Resume"}
                                onClick={() => act(() => update({ id: p.id, isActive: !p.isActive }).unwrap(), p.isActive ? "Paused" : "Resumed")}
                              >
                                {p.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </Button>
                            )}
                            {p.state === "live" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`End ${p.name} now`}
                                title="End now"
                                onClick={() => confirm(`End "${p.name}" now? Customers stop getting it straight away.`) && act(() => end(p.id).unwrap(), "Promotion ended")}
                              >
                                <Square className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {can("promotions.delete") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${p.name}`}
                            onClick={() => confirm(`Delete "${p.name}"? Orders that used it keep their record of it.`) && act(() => remove(p.id).unwrap(), "Promotion deleted")}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialog && <PromotionDialog initial={dialog.form} editing={dialog.editing} onClose={() => setDialog(null)} />}
    </div>
  );
}
