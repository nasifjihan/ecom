"use client";

/**
 * Promotions in the storefront's display slots, the pop-up on arrival, and the cart/checkout box
 * that says what the order gets ("10% off", "free gift") and how close the next offer is.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Gift, Sparkles, Tag, Truck, X } from "lucide-react";
import { Button, cn } from "@ecom/storefront-base";
import { useSlotPromotionsQuery, type CartPromotions, type PromoSlot, type SlotPromotion } from "@/lib/promotions";

const ICONS = { discount: Tag, free_gift: Gift, bxgy: Sparkles, free_delivery: Truck } as const;

function Cta({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/** Home and category banners: one row per live promotion in the slot. */
export function PromoBanners({ promotions, className }: { promotions: SlotPromotion[]; className?: string }) {
  if (!promotions.length) return null;
  return (
    <section className={cn("container", className)} aria-label="Offers">
      <div className={cn("grid gap-4", promotions.length > 1 && "md:grid-cols-2")}>
        {promotions.map((p) => {
          const Icon = ICONS[p.type];
          return (
            <div key={p.id} className="relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-gradient-to-r from-primary/10 via-card to-card p-5">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl object-cover" loading="lazy" />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold leading-tight">{p.headline}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.message?.trim() ? p.message : p.summary}</p>
              </div>
              {p.linkUrl && (
                <Button size="sm" asChild>
                  <Cta href={p.linkUrl}>
                    Shop <ArrowRight className="ml-1 h-4 w-4" />
                  </Cta>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Home offers section: cards side by side. */
export function PromoOffers({ promotions }: { promotions: SlotPromotion[] }) {
  if (!promotions.length) return null;
  return (
    <section className="container" aria-labelledby="offers-heading">
      <h2 id="offers-heading" className="mb-4 text-2xl font-bold">
        Offers
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((p) => {
          const Icon = ICONS[p.type];
          const body = (
            <>
              {p.imageUrl && <img src={p.imageUrl} alt="" className="mb-3 aspect-[16/9] w-full rounded-xl object-cover" loading="lazy" />}
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Icon className="h-4 w-4" /> {p.summary}
              </div>
              <h3 className="mt-1 font-bold">{p.headline}</h3>
              {p.message && <p className="mt-1 text-sm text-muted-foreground">{p.message}</p>}
              {p.endsAt && <p className="mt-2 text-xs text-muted-foreground">Ends {new Date(p.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>}
            </>
          );
          return p.linkUrl ? (
            <Cta key={p.id} href={p.linkUrl} className="block rounded-2xl border bg-card p-4 transition-shadow hover:shadow-soft">
              {body}
            </Cta>
          ) : (
            <div key={p.id} className="rounded-2xl border bg-card p-4">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Loads a slot on the client (product page, category list, cart, checkout). */
export function PromoSlotStrip({ slot, productId, categorySlug, className }: { slot: PromoSlot; productId?: string; categorySlug?: string; className?: string }) {
  const { data = [] } = useSlotPromotionsQuery({ slot, productId, categorySlug });
  if (!data.length) return null;
  if (slot === "category_banner") return <PromoBanners promotions={data} className={cn("px-0", className)} />;
  return (
    <ul className={cn("space-y-2", className)} aria-label="Offers">
      {data.map((p) => {
        const Icon = ICONS[p.type];
        return (
          <li key={p.id} className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span>
              <span className="font-semibold">{p.headline}</span>
              {p.message && <span className="block text-xs text-muted-foreground">{p.message}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Shown once per visit when a promotion uses the pop-up slot. */
export function EntryPopup() {
  const { data = [] } = useSlotPromotionsQuery({ slot: "entry_popup" });
  const [open, setOpen] = React.useState(false);
  const p = data[0];
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const key = p ? `promo-popup-${p.id}` : "";

  React.useEffect(() => {
    if (!p) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
    } catch {
      // Storage blocked: show it anyway.
    }
    if (seen) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [p, key]);

  const close = React.useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }, [key]);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!p || !open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-popup-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60">
          <X className="h-4 w-4" />
        </button>
        {p.imageUrl && <img src={p.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />}
        <div className="p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.summary}</p>
          <h2 id="promo-popup-title" className="mt-1 text-2xl font-bold">
            {p.headline}
          </h2>
          {p.message && <p className="mt-2 text-sm text-muted-foreground">{p.message}</p>}
          <div className="mt-5 flex justify-center gap-2">
            {p.linkUrl ? (
              <Button asChild onClick={close}>
                <Cta href={p.linkUrl}>Shop now</Cta>
              </Button>
            ) : (
              <Button onClick={close}>Start shopping</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the cart gets from automatic promotions, and how close the next offer is. */
export function CartPromotionSummary({ promotions, className }: { promotions: CartPromotions | null; className?: string }) {
  if (!promotions) return null;
  const { discount, bxgy, gifts, freeDelivery, nudges, notes, droppedForCoupon } = promotions;
  const anything = !!discount || !!freeDelivery || droppedForCoupon || bxgy.length + gifts.length + nudges.length + notes.length > 0;
  if (!anything) return null;
  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {droppedForCoupon && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Your coupon can&apos;t be combined with other offers, so they&apos;re not applied.
        </p>
      )}
      {gifts.map((g) => (
        <div key={g.promotionId} className="flex items-center gap-3 rounded-lg bg-pink-50 px-3 py-2 dark:bg-pink-500/10">
          {g.imageUrl ? <img src={g.imageUrl} alt="" className="h-10 w-10 rounded object-cover" /> : <Gift className="h-5 w-5 text-pink-600" />}
          <span className="text-xs">
            <span className="font-semibold text-pink-700 dark:text-pink-300">Free gift</span>
            <span className="block">
              {g.qty} × {g.title}
            </span>
          </span>
        </div>
      ))}
      {freeDelivery && (
        <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Truck className="h-4 w-4" /> Free delivery ({freeDelivery.name})
        </p>
      )}
      {nudges.map((n) => (
        <p key={`${n.id}-${n.message}`} className="flex items-start gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs">
          <Sparkles className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" /> {n.message}
        </p>
      ))}
      {notes.map((n) => (
        <p key={n} className="text-xs text-muted-foreground">
          {n}
        </p>
      ))}
    </div>
  );
}

/** Discount lines for an order summary: the promotion discount and each buy X get Y. */
export function promotionLines(p: CartPromotions | null): { id: string; label: string; amount: number }[] {
  if (!p || p.droppedForCoupon) return [];
  return [
    ...(p.discount ? [{ id: `promo-${p.discount.id}`, label: p.discount.name, amount: p.discount.amount }] : []),
    ...p.bxgy.map((b) => ({ id: `bxgy-${b.id}-${b.productId}`, label: `${b.name}: ${b.freeUnits} free`, amount: b.amount })),
  ];
}
