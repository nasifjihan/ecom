"use client";

/**
 * A product landing page: the offer at the top, the page's blocks, reviews and an order form
 * (name, phone, address; cash on delivery). Prices and totals come from the server, which also
 * charges the page's offer, so what the form shows is what the order costs.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, Clock, Eye, Minus, Plus, ShieldCheck, Star, Truck } from "lucide-react";
import {
  Button,
  Input,
  Label,
  LocationSelects,
  apiErrorMessage,
  cn,
  formatMoney,
  toast,
  useT,
  type LocationValue,
  useIdempotencyKey,
} from "@ecom/storefront-base";
import type { Faq } from "@/lib/content";
import { useLandingOrderMutation, useLandingQuoteMutation, useLandingViewMutation, type LandingPageData, type LandingQuote } from "@/lib/landing";
import { salesCode } from "@/lib/sales-code";
import { PageSections } from "../../page-sections";

const bdt = (n: number) => formatMoney(n, "BDT");
const MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

/** Time left on the offer; the page reloads when it runs out (the normal price is back). */
function Countdown({ endsAt }: { endsAt: string }) {
  const t = useT();
  const router = useRouter();
  // The clock starts in the browser, so the server's page and the first render agree.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = now === null ? null : Math.max(0, new Date(endsAt).getTime() - now);
  const over = left === 0;
  React.useEffect(() => {
    if (over) router.refresh();
  }, [over, router]);
  const ms = left ?? 0;
  const parts = [
    [Math.floor(ms / 86_400_000), t("days")],
    [Math.floor(ms / 3_600_000) % 24, t("hours")],
    [Math.floor(ms / 60_000) % 60, t("min")],
    [Math.floor(ms / 1000) % 60, t("sec")],
  ] as const;
  return (
    <div className="inline-flex flex-col gap-2" role="timer" aria-label={t("Offer ends in")}>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
        <Clock className="h-4 w-4" aria-hidden /> {t("Offer ends in")}
      </span>
      <div className="flex gap-2">
        {parts.map(([v, label]) => (
          <div key={label} className="min-w-14 rounded-lg bg-foreground px-2 py-1.5 text-center text-background">
            <div className="text-xl font-bold tabular-nums leading-tight">{left === null ? "--" : String(v).padStart(2, "0")}</div>
            <div className="text-[11px] opacity-80">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-4 w-4", i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

function PriceTag({ price, compareAtPrice, large }: { price: number; compareAtPrice: number | null; large?: boolean }) {
  const t = useT();
  const off = compareAtPrice && compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={cn("font-bold text-primary", large ? "text-3xl md:text-4xl" : "text-xl")}>{bdt(price)}</span>
      {off > 0 && (
        <>
          <span className="text-muted-foreground line-through">{bdt(compareAtPrice!)}</span>
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-sm font-semibold text-destructive">{t("{n}% off", { n: off })}</span>
        </>
      )}
    </div>
  );
}

export function LandingView({ page, faqs, preview }: { page: LandingPageData; faqs: Faq[]; preview?: string }) {
  const t = useT();
  const router = useRouter();
  const p = page.product;
  const slug = page.slug;
  const cta = page.ctaText === "Order now" ? t("Order now") : page.ctaText;

  // A visit, counted once per page load (not for previews).
  const [countView] = useLandingViewMutation();
  React.useEffect(() => {
    if (!page.draft) void countView({ slug });
  }, [countView, slug, page.draft]);

  const options = p.variants;
  const firstInStock = options.find((v) => v.inStock) ?? options[0];
  const [variantId, setVariantId] = React.useState<string | null>(firstInStock?.id ?? null);
  const variant = options.find((v) => v.id === variantId) ?? null;
  const shown = variant ?? p;
  const available = variant ? variant.inStock : p.inStock;

  const [qty, setQty] = React.useState(1);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [area, setArea] = React.useState<LocationValue>({});
  const [line1, setLine1] = React.useState("");
  const [note, setNote] = React.useState("");
  const [methodId, setMethodId] = React.useState<string | null>(null);
  const [tried, setTried] = React.useState(false);

  // Price, delivery options and total for what's picked so far.
  const [runQuote, { isLoading: quoting }] = useLandingQuoteMutation();
  const [quote, setQuote] = React.useState<LandingQuote | null>(null);
  const address = React.useMemo(
    () => ({
      locationId: area.locationId ?? null,
      division: area.division ?? "",
      district: area.district ?? "",
      upazila: area.upazila ?? "",
      addressLine1: line1.trim(),
    }),
    [area, line1],
  );
  React.useEffect(() => {
    if (!address.district) {
      setQuote(null);
      return;
    }
    let live = true;
    const id = window.setTimeout(() => {
      runQuote({ slug, preview, variantId, qty, address: { ...address, addressLine1: "" }, shippingMethodId: methodId ?? undefined })
        .unwrap()
        .then((q) => {
          if (!live) return;
          setQuote(q);
          // Pick the cheapest delivery option, or drop one the new address doesn't offer.
          if (!q.shippingOptions.some((o) => o.id === methodId)) setMethodId([...q.shippingOptions].sort((a, b) => a.fee - b.fee)[0]?.id ?? null);
        })
        .catch(() => live && setQuote(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
    // The street line doesn't change the price.
  }, [runQuote, slug, preview, variantId, qty, address.district, address.locationId, methodId]);

  // The cheapest few delivery options, plus the one picked; the rest on request.
  const [allOptions, setAllOptions] = React.useState(false);
  const shownOptions = React.useMemo(() => {
    const list = [...(quote?.shippingOptions ?? [])].sort((a, b) => a.fee - b.fee);
    if (allOptions) return list;
    const few = list.slice(0, 3);
    const picked = list.find((o) => o.id === methodId);
    return picked && !few.includes(picked) ? [...few, picked] : few;
  }, [quote, allOptions, methodId]);

  const [placeOrder, { isLoading: placing }] = useLandingOrderMutation();
  // The same order sent twice (double click, lost connection) is placed once.
  const withKey = useIdempotencyKey();
  const phoneOk = MOBILE.test(phone.replace(/[\s()-]/g, ""));
  const nameOk = name.trim().length >= 2;
  const addressOk = !!address.district && line1.trim().length >= 3;
  const ready = nameOk && phoneOk && addressOk && !!methodId && available && !quote?.problem;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!ready || !methodId) return;
    try {
      const r = await placeOrder(withKey({
        slug,
        preview,
        name: name.trim(),
        phone,
        address,
        variantId,
        qty,
        shippingMethodId: methodId,
        note: note.trim() || null,
        salesCode: salesCode() ?? null,
      })).unwrap();
      toast.success(t("Order placed!"), { description: t("Order #{ref} created successfully", { ref: r.number }) });
      router.push(`/checkout/thank-you?key=${encodeURIComponent(r.orderKey)}`);
    } catch (err) {
      toast.error(t("Order failed"), { description: apiErrorMessage(err, t("Could not place order. Please try again.")) });
    }
  };

  const toForm = () => document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const hero = page.heroImageUrl ?? p.images[0] ?? null;
  const fieldError = (ok: boolean) => tried && !ok;

  return (
    <div className="pb-24 md:pb-0">
      {page.draft && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <Eye className="mr-1.5 inline h-4 w-4" aria-hidden />
          {t("Preview — this page isn't published yet. Orders placed here are real.")}
        </div>
      )}

      {/* Hero */}
      <section className="container grid items-center gap-8 py-8 md:grid-cols-2 md:py-14">
        {hero && (
          <div className="overflow-hidden rounded-2xl bg-muted">
            <img src={hero} alt={p.name} className="aspect-square w-full object-cover" />
          </div>
        )}
        <div className="space-y-5">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{page.headline}</h1>
          {page.subheadline && <p className="text-lg text-muted-foreground">{page.subheadline}</p>}
          {p.reviewCount > 0 && (
            <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Stars rating={p.rating} />
              {p.reviewCount === 1
                ? t("{rating} from 1 review", { rating: p.rating.toFixed(1) })
                : t("{rating} from {n} reviews", { rating: p.rating.toFixed(1), n: p.reviewCount })}
            </a>
          )}
          <PriceTag price={shown.price} compareAtPrice={shown.compareAtPrice} large />
          {page.offer.running && page.offer.endsAt && <Countdown endsAt={page.offer.endsAt} />}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="h-12 px-8 text-base" onClick={toForm} disabled={!p.inStock}>
              {p.inStock ? cta : t("Out of stock")}
            </Button>
          </div>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {page.cashOnDelivery && (
              <li className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-primary" aria-hidden /> {t("Pay when it arrives")}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" aria-hidden /> {t("Delivery all over Bangladesh")}
            </li>
          </ul>
        </div>
      </section>

      {/* The page's own blocks */}
      {page.sections.length > 0 && <PageSections sections={page.sections} faqs={faqs} />}

      {/* Reviews */}
      {page.reviews.length > 0 && (
        <section id="reviews" className="container py-10 md:py-14">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("What customers say")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {page.reviews.map((r) => (
              <figure key={r.id} className="rounded-xl border bg-card p-5">
                <Stars rating={r.rating} />
                {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                <blockquote className="mt-1 text-sm text-muted-foreground">{r.body}</blockquote>
                <figcaption className="mt-3 flex items-center gap-1.5 text-sm font-medium">
                  {r.name}
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {t("Verified purchase")}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Order form */}
      <section id="order" className="scroll-mt-20 bg-muted/40 py-10 md:py-14">
        <div className="container max-w-2xl">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">{page.formTitle ?? t("Order now — pay when it arrives")}</h2>
          {!page.cashOnDelivery ? (
            <div className="mt-6 rounded-xl border bg-card p-6 text-center">
              <p className="text-muted-foreground">{t("Ordering on this page isn't available right now.")}</p>
              <Button asChild className="mt-4">
                <Link href={`/products/${p.slug}`}>{t("See the product")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-xl border bg-card p-5 md:p-7">
              {options.length > 1 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">{t("Choose an option")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {options.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVariantId(v.id)}
                        disabled={!v.inStock}
                        aria-pressed={v.id === variantId}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
                          v.id === variantId ? "border-primary bg-primary/10 font-medium text-primary" : "hover:border-foreground/40",
                        )}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium" id="lp-qty-label">
                  {t("Quantity")}
                </span>
                <div className="flex items-center rounded-lg border" role="group" aria-labelledby="lp-qty-label">
                  <button type="button" className="p-2.5 disabled:opacity-40" onClick={() => setQty((q) => q - 1)} disabled={qty <= 1} aria-label={t("Fewer")}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center font-medium tabular-nums" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    className="p-2.5 disabled:opacity-40"
                    onClick={() => setQty((q) => q + 1)}
                    disabled={qty >= page.maxQty}
                    aria-label={t("More")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lp-name">{t("Your name")}</Label>
                  <Input id="lp-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={fieldError(nameOk)} />
                  {fieldError(nameOk) && <p className="text-xs text-destructive">{t("Enter your name")}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lp-phone">{t("Mobile number")}</Label>
                  <Input
                    id="lp-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={fieldError(phoneOk)}
                  />
                  {fieldError(phoneOk) && <p className="text-xs text-destructive">{t("Enter a mobile number like 01712345678")}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <LocationSelects
                  idPrefix="lp"
                  value={area}
                  onChange={(v) => setArea(v)}
                  renderField={(label, control, id) => (
                    <div className="space-y-1.5">
                      <Label htmlFor={id}>{label}</Label>
                      {control}
                    </div>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lp-address">{t("Full address")}</Label>
                <Input
                  id="lp-address"
                  autoComplete="street-address"
                  placeholder={t("House, road, area")}
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  aria-invalid={fieldError(addressOk)}
                />
                {fieldError(addressOk) && <p className="text-xs text-destructive">{t("Pick your district and write your address")}</p>}
              </div>

              {quote && quote.shippingOptions.length > 1 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">{t("Delivery")}</legend>
                  <div className="space-y-2">
                    {shownOptions.map((o) => (
                      <label key={o.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm", o.id === methodId && "border-primary bg-primary/5")}>
                        <span className="flex items-center gap-2">
                          <input type="radio" name="lp-delivery" checked={o.id === methodId} onChange={() => setMethodId(o.id)} />
                          {o.name}
                          {o.maxDays !== null && <span className="text-muted-foreground">· {t("{min}–{max} days", { min: o.minDays ?? o.maxDays, max: o.maxDays })}</span>}
                        </span>
                        <span className="font-medium">{o.fee === 0 ? t("FREE") : bdt(o.fee)}</span>
                      </label>
                    ))}
                  </div>
                  {shownOptions.length < quote.shippingOptions.length && (
                    <button type="button" className="mt-2 text-sm font-medium text-primary hover:underline" onClick={() => setAllOptions(true)}>
                      {t("Show all {n} delivery options", { n: quote.shippingOptions.length })}
                    </button>
                  )}
                </fieldset>
              )}
              {quote && address.district && quote.shippingOptions.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" aria-hidden /> {t("We don't deliver to this area yet.")}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="lp-note">{t("Note (optional)")}</Label>
                <Input id="lp-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {/* What it costs */}
              <dl className={cn("space-y-1.5 rounded-lg bg-muted/60 p-4 text-sm", quoting && "opacity-60")} aria-live="polite">
                <div className="flex justify-between gap-4">
                  <dt>
                    {p.name}
                    {variant ? ` (${variant.label})` : ""} × {qty}
                  </dt>
                  <dd className="font-medium">{bdt((quote?.unitPrice ?? shown.price) * qty)}</dd>
                </div>
                {quote && methodId && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt>{t("Delivery")}</dt>
                      <dd>{quote.totals.shippingTotal === 0 ? t("FREE") : bdt(quote.totals.shippingTotal)}</dd>
                    </div>
                    {quote.totals.discountTotal > 0 && (
                      <div className="flex justify-between gap-4 text-primary">
                        <dt>{t("Discount")}</dt>
                        <dd>−{bdt(quote.totals.discountTotal)}</dd>
                      </div>
                    )}
                    {quote.totals.taxTotal > 0 && !quote.totals.taxIncluded && (
                      <div className="flex justify-between gap-4">
                        <dt>{t("VAT")}</dt>
                        <dd>{bdt(quote.totals.taxTotal)}</dd>
                      </div>
                    )}
                    {quote.totals.feeTotal > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt>{t("Payment fee")}</dt>
                        <dd>{bdt(quote.totals.feeTotal)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold">
                      <dt>{t("Total — pay on delivery")}</dt>
                      <dd>{bdt(quote.totals.grandTotal)}</dd>
                    </div>
                    {quote.totals.taxIncluded && quote.totals.taxTotal > 0 && (
                      <p className="text-right text-xs text-muted-foreground">{t("Includes VAT {amount}", { amount: bdt(quote.totals.taxTotal) })}</p>
                    )}
                  </>
                )}
                {!address.district && <p className="text-muted-foreground">{t("Pick your district to see the delivery charge.")}</p>}
              </dl>
              {(quote?.problem ?? (!available ? t("This option is out of stock") : null)) && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" aria-hidden /> {quote?.problem ?? t("This option is out of stock")}
                </p>
              )}

              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={placing || !available}>
                {placing ? t("Placing your order…") : quote && methodId ? `${cta} • ${bdt(quote.totals.grandTotal)}` : cta}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Always-there order button on phones */}
      {p.inStock && page.cashOnDelivery && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur md:hidden">
          <Button className="h-11 w-full" onClick={toForm}>
            {cta} • {bdt(shown.price)}
          </Button>
        </div>
      )}
    </div>
  );
}
