"use client";

/**
 * The gift box builder: pick a box style, fill it with products the box takes, add a message,
 * then add the whole box to the cart (CartProvider boxes). Checkout checks the box again.
 */
import * as React from "react";
import { Check, Gift, Minus, Plus, ShoppingBag, X } from "lucide-react";
import {
  Button,
  Skeleton,
  cn,
  formatMoney,
  toast,
  useCart,
  useGetProductBySlugQuery,
  useGetProductsQuery,
  useT,
  type CartItem,
  type ProductSummary,
} from "@ecom/storefront-base";
import type { GiftBoxDetail } from "@/lib/giftboxes";

const bdt = (n: number) => formatMoney(n, "BDT");
const PAGE = 24;

type Picked = CartItem;
const pickKey = (p: { productId: string; variantId?: string }) => `${p.productId}:${p.variantId ?? ""}`;

/** Options of a product with sizes or colours, to pick one for the box. */
function OptionPicker({ product, onPick, onCancel }: { product: ProductSummary; onPick: (item: Picked) => void; onCancel: () => void }) {
  const t = useT();
  const { data, isLoading } = useGetProductBySlugQuery(product.slug);
  const [variantId, setVariantId] = React.useState<string>("");
  const variant = data?.variants.find((v) => v.id === variantId);
  return (
    <div className="space-y-2">
      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <select
          aria-label={t("Choose an option")}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{t("Choose an option")}</option>
          {data?.variants.map((v) => (
            <option key={v.id} value={v.id} disabled={!v.inStock}>
              {v.label} · {bdt(v.price)}
              {v.inStock ? "" : ` (${t("Out of stock")})`}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={!variant}
          onClick={() =>
            variant &&
            onPick({
              productId: product.id,
              variantId: variant.id,
              title: product.title,
              slug: product.slug,
              image: variant.image ?? product.image,
              price: variant.price,
              variantLabel: variant.label,
              qty: 1,
            })
          }
        >
          {t("Put in box")}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} aria-label={t("Cancel")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function GiftBoxBuilder({ box }: { box: GiftBoxDetail }) {
  const t = useT();
  const { addBox } = useCart();
  const styles = box.box.styles;
  const [styleId, setStyleId] = React.useState<string | null>(styles.find((s) => s.inStock)?.id ?? null);
  const style = styles.find((s) => s.id === styleId) ?? null;
  const boxPrice = style?.price ?? box.box.price;
  const boxAvailable = styles.length ? !!style?.inStock : box.box.inStock;

  const [picked, setPicked] = React.useState<Picked[]>([]);
  const [message, setMessage] = React.useState("");
  const [choosing, setChoosing] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const count = picked.reduce((s, p) => s + p.qty, 0);
  const full = count >= box.maxItems;

  // What the box takes: hand-picked products, and products in its categories (or anything).
  const byIds = useGetProductsQuery({ ids: box.productIds.join(","), perPage: 60 }, { skip: !box.productIds.length });
  const anyProduct = !box.productIds.length && !box.categoryIds.length;
  const byCategory = useGetProductsQuery(
    { categoryId: box.categoryIds.length ? box.categoryIds.join(",") : undefined, perPage: PAGE * page },
    { skip: !box.categoryIds.length && !anyProduct },
  );
  const products = React.useMemo(() => {
    const seen = new Set<string>([box.box.id]);
    const out: ProductSummary[] = [];
    for (const p of [...(byIds.data?.items ?? []), ...(byCategory.data?.items ?? [])]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [byIds.data, byCategory.data, box.box.id]);
  const loading = byIds.isLoading || byCategory.isLoading;
  const more = (byCategory.data?.total ?? 0) > (byCategory.data?.items.length ?? 0);

  const add = (item: Picked) => {
    if (full) return;
    setPicked((prev) => {
      const i = prev.findIndex((p) => pickKey(p) === pickKey(item));
      if (i < 0) return [...prev, { ...item, qty: 1 }];
      const next = [...prev];
      next[i] = { ...next[i]!, qty: next[i]!.qty + 1 };
      return next;
    });
    setChoosing(null);
  };
  const change = (key: string, delta: number) =>
    setPicked((prev) => prev.map((p) => (pickKey(p) === key ? { ...p, qty: p.qty + delta } : p)).filter((p) => p.qty > 0));
  const inBox = (productId: string) => picked.filter((p) => p.productId === productId).reduce((s, p) => s + p.qty, 0);

  const total = boxPrice + picked.reduce((s, p) => s + p.price * p.qty, 0);
  const tooLong = message.length > box.messageMax;
  const ready = boxAvailable && count >= box.minItems && count <= box.maxItems && !tooLong;

  const addToCart = () => {
    if (!ready) return;
    addBox({
      key: `gb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      giftBoxId: box.id,
      name: box.name,
      slug: box.slug,
      message: box.allowMessage && message.trim() ? message.trim() : undefined,
      box: {
        productId: box.box.id,
        variantId: style?.id,
        title: box.box.name,
        slug: box.box.slug,
        image: style?.image ?? box.box.image ?? box.imageUrl ?? "",
        price: boxPrice,
        variantLabel: style?.label,
        qty: 1,
      },
      items: picked,
    });
    toast.success(t("Gift box added to your cart"));
    setPicked([]);
    setMessage("");
  };

  return (
    <div className="container py-8 md:py-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
          {box.imageUrl ? <img src={box.imageUrl} alt="" className="h-full w-full object-cover" /> : <Gift className="h-10 w-10 text-primary" aria-hidden />}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{box.name}</h1>
          {box.description && <p className="mt-1 max-w-2xl text-muted-foreground">{box.description}</p>}
          <p className="mt-2 text-sm font-medium">{t("Fill it with {min} to {max} items.", { min: box.minItems, max: box.maxItems })}</p>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {styles.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("1. Choose your box")}</h2>
              <div className="flex flex-wrap gap-2">
                {styles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!s.inStock}
                    aria-pressed={s.id === styleId}
                    onClick={() => setStyleId(s.id)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      s.id === styleId ? "border-primary bg-primary/10 font-medium text-primary" : "hover:border-foreground/40",
                    )}
                  >
                    {s.label} · {bdt(s.price)}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">{styles.length ? t("2. Pick what goes in") : t("1. Pick what goes in")}</h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground">{t("Nothing can go in this box right now.")}</p>
            ) : (
              <>
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {products.map((p) => {
                    const n = inBox(p.id);
                    const out = p.isOutOfStock === true || p.stockStatus === "OUT_OF_STOCK";
                    return (
                      <li key={p.id} className={cn("flex flex-col rounded-xl border bg-card p-3", n > 0 && "border-primary ring-1 ring-primary")}>
                        <div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-muted">
                          <img src={p.image} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                          {n > 0 && (
                            <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                              {n}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{p.title}</p>
                        <p className="mb-2 text-sm font-semibold text-primary">{bdt(p.price)}</p>
                        <div className="mt-auto">
                          {choosing === p.id ? (
                            <OptionPicker product={p} onPick={add} onCancel={() => setChoosing(null)} />
                          ) : (
                            <Button
                              size="sm"
                              variant={n > 0 ? "secondary" : "default"}
                              className="w-full"
                              disabled={out || full}
                              onClick={() =>
                                p.hasVariants
                                  ? setChoosing(p.id)
                                  : add({ productId: p.id, title: p.title, slug: p.slug, image: p.image, price: p.price, qty: 1 })
                              }
                            >
                              {out ? t("Out of stock") : n > 0 ? t("Add another") : t("Put in box")}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {more && (
                  <div className="mt-6 text-center">
                    <Button variant="outline" onClick={() => setPage((x) => x + 1)} disabled={byCategory.isFetching}>
                      {t("Show more")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-24" aria-label={t("Your box")}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Gift className="h-5 w-5 text-primary" aria-hidden /> {t("Your box")}
          </h2>
          <div aria-live="polite">
            <div className="mb-1 flex justify-between text-sm">
              <span>{t("{n} of {max} items", { n: count, max: box.maxItems })}</span>
              {count < box.minItems ? (
                <span className="text-muted-foreground">{t("Add {n} more", { n: box.minItems - count })}</span>
              ) : (
                <span className="flex items-center gap-1 text-primary">
                  <Check className="h-4 w-4" aria-hidden /> {t("Ready")}
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (count / box.maxItems) * 100)}%` }} />
            </div>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2 text-muted-foreground">
              <span>
                {t("Box")}: {box.box.name}
                {style ? ` (${style.label})` : ""}
              </span>
              <span>{bdt(boxPrice)}</span>
            </li>
            {picked.map((p) => (
              <li key={pickKey(p)} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {p.title}
                  {p.variantLabel ? ` (${p.variantLabel})` : ""}
                </span>
                <span className="flex items-center rounded-md border">
                  <button type="button" className="p-1" onClick={() => change(pickKey(p), -1)} aria-label={t("Fewer")}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center tabular-nums">{p.qty}</span>
                  <button type="button" className="p-1 disabled:opacity-40" onClick={() => change(pickKey(p), 1)} disabled={full} aria-label={t("More")}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </span>
                <span className="w-20 text-right">{bdt(p.price * p.qty)}</span>
              </li>
            ))}
            {picked.length === 0 && <li className="text-muted-foreground">{t("Nothing in the box yet.")}</li>}
          </ul>

          {box.allowMessage && (
            <div className="space-y-1.5">
              <label htmlFor="gb-message" className="text-sm font-medium">
                {t("Message card (optional)")}
              </label>
              <textarea
                id="gb-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("Eid Mubarak! With love from …")}
                aria-invalid={tooLong}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <p className={cn("text-right text-xs", tooLong ? "text-destructive" : "text-muted-foreground")}>
                {message.length}/{box.messageMax}
              </p>
            </div>
          )}

          <div className="flex justify-between border-t pt-3 text-base font-bold">
            <span>{t("Total")}</span>
            <span>{bdt(total)}</span>
          </div>
          <Button size="lg" className="h-12 w-full" disabled={!ready} onClick={addToCart}>
            <ShoppingBag className="mr-2 h-4 w-4" /> {t("Add box to cart")}
          </Button>
          {!boxAvailable && <p className="text-sm text-destructive">{t("This box is out of stock.")}</p>}
        </aside>
      </div>
    </div>
  );
}
