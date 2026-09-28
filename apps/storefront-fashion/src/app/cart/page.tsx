"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ShoppingCart,
  ArrowRight,
  ArrowLeft,
  Tag,
  Gift,
  Truck,
  Shield,
  X,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Separator,
  Skeleton,
  Label,
  useCart,
  useGetProductsQuery,
  useT,
  cn,
  formatMoney,
  toast,
} from "@ecom/storefront-base";
import { cartLineKey, useCartPriceCheck } from "@/lib/cart-prices";
import { CartPromotionSummary, PromoSlotStrip, promotionLines } from "@/app/_components/promotions";

function formatBDT(n: number) {
  return formatMoney(n, "BDT");
}

export default function CartPage() {
  const { items, subtotal, itemCount, updateQty, removeItem, clearCart } = useCart();
  const t = useT();
  const [mounted, setMounted] = React.useState(false);
  const { problems, hasProblems, promotions } = useCartPriceCheck();
  const promoLines = promotionLines(promotions);
  const afterOffers = Math.max(0, Math.round((subtotal - (promotions?.droppedForCoupon ? 0 : promotions?.total ?? 0)) * 100) / 100);

  React.useEffect(() => setMounted(true), []);

  const { data: suggestions } = useGetProductsQuery({ featured: true, perPage: 8, sort: "popular" });
  const crossSell = React.useMemo(() => {
    const inCart = new Set(items.map((i) => i.productId));
    return (suggestions?.items ?? []).filter((p) => !inCart.has(p.id)).slice(0, 3);
  }, [suggestions, items]);

  return (
    <div className="container py-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <ShoppingBag className="h-7 w-7 text-primary" /> {t("Shopping Cart")}
        </h1>
        <p className="text-muted-foreground">
          {mounted
            ? itemCount > 0
              ? t("You have {n} items in your cart", { n: itemCount })
              : t("Your cart is currently empty")
            : t("Loading cart...")}
        </p>
      </div>


      <div className="grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
        <section>
          {!mounted ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-2xl">
                  <Skeleton className="h-24 w-24 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-9 w-36 mt-2" />
                    <div className="flex justify-between"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-20" /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 px-6 border rounded-3xl bg-card text-center"
            >
              <div className="h-28 w-28 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <ShoppingCart className="h-14 w-14 text-primary/60" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t("Your cart is empty")}</h2>
              <p className="text-muted-foreground max-w-sm mb-8">
                {t("Looks like you haven't added anything yet. Explore our catalog to find something you love!")}
              </p>
              <div className="flex flex-wrap items-center gap-3 justify-center">
                <Button size="lg" asChild>
                  <Link href="/products">
                    <ShoppingBag className="h-5 w-5 mr-2" /> {t("Start Shopping")}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/">
                    <ArrowLeft className="h-5 w-5 mr-2" /> {t("Back to Home")}
                  </Link>
                </Button>
              </div>

              <Separator className="my-12 w-48" />

              <div className="w-full text-left">
                <h3 className="font-semibold mb-4">{t("Customers also viewed")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {crossSell.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.slug}`}
                      className="group block p-3 rounded-xl border hover:shadow-soft hover:border-primary/30 transition-all"
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 mb-3">
                        <img src={p.image} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      </div>
                      <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors mb-1 min-h-[2.5rem]">{p.title}</h4>
                      <div className="font-bold text-primary">{formatBDT(p.price)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <div className="hidden md:grid grid-cols-[120px_1fr_auto] gap-4 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 rounded-t-2xl border border-b-0">
                <span>{t("Product")}</span>
                <div className="grid grid-cols-[1fr_100px_140px_80px_40px] gap-4">
                  <span>{t("Details")}</span>
                  <span>{t("Unit Price")}</span>
                  <span>{t("Quantity")}</span>
                  <span className="text-right">{t("Total")}</span>
                  <span></span>
                </div>
              </div>

              <div className={cn("divide-y border rounded-2xl bg-card", "md:rounded-t-none")}>
                {items.map((item) => {
                  const lineTotal = Math.round(item.price * item.qty * 100) / 100;
                  const problem = problems[cartLineKey(item.productId, item.variantId)];
                  return (
                    <div key={`${item.productId}-${item.variantId ?? "none"}`} className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr_auto] gap-3 md:gap-4 p-4 hover:bg-muted/20 transition-colors">
                      <Link href={`/products/${item.slug}`} className="h-20 md:h-24 w-20 md:w-24 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border">
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                      </Link>

                      <div className="md:grid md:grid-cols-[1fr_100px_140px_80px_40px] md:gap-4 md:items-center min-w-0">
                        <div className="min-w-0 mb-3 md:mb-0">
                          <Link href={`/products/${item.slug}`} className="block">
                            <h3 className="font-medium md:text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">{item.title}</h3>
                          </Link>
                          {item.variantLabel && <div className="text-xs text-muted-foreground mt-1">{item.variantLabel}</div>}
                          {item.flashSale && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/10">
                              <Zap className="h-3 w-3" /> {item.flashSale.name}
                            </div>
                          )}
                          {problem && (
                            <div className="mt-1 flex items-start gap-1 text-xs font-medium text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5 mt-px flex-shrink-0" /> {problem}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 md:hidden">
                            Unit: {formatBDT(item.price)}
                            {item.compareAtPrice ? <span className="ml-1 line-through">{formatBDT(item.compareAtPrice)}</span> : null}
                          </div>
                        </div>

                        <div className="hidden md:block text-sm font-medium">
                          {formatBDT(item.price)}
                          {item.compareAtPrice ? (
                            <div className="text-xs font-normal text-muted-foreground line-through">{formatBDT(item.compareAtPrice)}</div>
                          ) : null}
                        </div>

                        <div className="mb-3 md:mb-0">
                          <div className="inline-flex items-center border rounded-lg overflow-hidden">
                            <button
                              onClick={() => {
                                if (item.qty <= 1) removeItem(item.productId, item.variantId);
                                else updateQty(item.productId, item.variantId, item.qty - 1);
                              }}
                              className="h-9 w-8 flex items-center justify-center hover:bg-accent transition-colors"
                              aria-label={t("Decrease quantity")}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="h-9 min-w-[2.5rem] flex items-center justify-center font-semibold text-sm border-x px-2">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}
                              className="h-9 w-8 flex items-center justify-center hover:bg-accent transition-colors"
                              aria-label={t("Increase quantity")}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="md:text-right md:pr-2 flex items-center justify-between md:block">
                          <span className="font-bold md:text-base">{formatBDT(lineTotal)}</span>
                        </div>

                        <div className="md:pl-1 flex items-center justify-end mt-2 md:mt-0">
                          <button
                            onClick={() => {
                              removeItem(item.productId, item.variantId);
                              toast.info(t("Item removed from cart"));
                            }}
                            className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            aria-label={t("Remove item")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 border rounded-2xl bg-muted/20">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">{t("Shipping and taxes calculated at checkout.")}</span>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" asChild>
                    <Link href="/products">
                      <ArrowLeft className="h-4 w-4 mr-2" /> {t("Continue Shopping")}
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { clearCart(); toast.info(t("Cart cleared")); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> {t("Clear Cart")}
                  </Button>
                </div>
              </div>

              <div className="p-5 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-secondary/5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-secondary" /> {t("You May Also Like")}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {crossSell.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.slug}`}
                      className="group block aspect-square rounded-xl overflow-hidden bg-slate-100 relative"
                    >
                      <img src={p.image} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs">
                        <div className="font-semibold line-clamp-1">{p.title}</div>
                        <div className="text-[11px] opacity-90">{formatBDT(p.price)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside>
          <Card className="lg:sticky lg:top-24 shadow-soft">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" /> {t("Order Summary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    {t("Subtotal")}
                    <Badge variant="secondary" className="text-[10px] px-1.5">{t("{n} items", { n: itemCount })}</Badge>
                  </span>
                  <span className="font-medium">{formatBDT(subtotal)}</span>
                </div>
                {promoLines.map((l) => (
                  <div key={l.id} className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> {l.label}
                    </span>
                    <span className="font-medium">−{formatBDT(l.amount)}</span>
                  </div>
                ))}
                <CartPromotionSummary promotions={promotions} />

                <p className="text-xs text-muted-foreground pt-2 border-t">
                  {t("Delivery charge, VAT and promo codes are calculated at checkout from your address.")}
                </p>
              </div>

              <Separator />

              <div className="bg-muted/30 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">{promoLines.length ? t("After offers") : t("Subtotal")}</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-primary">{formatBDT(afterOffers)}</div>
                    <div className="text-[11px] text-muted-foreground">{t("Before delivery and VAT")}</div>
                  </div>
                </div>
              </div>

              <PromoSlotStrip slot="cart" />

              <div className="space-y-2.5">
                {hasProblems && (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 mt-px flex-shrink-0" />
                    {t("Some items can't be ordered as they are. Change or remove them to continue.")}
                  </p>
                )}
                <Button
                  size="lg"
                  className="w-full h-12 text-base shadow-hover"
                  disabled={items.length === 0 || hasProblems}
                  onClick={() => {
                    if (items.length === 0 || hasProblems) return;
                    window.location.href = "/checkout";
                  }}
                >
                  {t("Proceed to Checkout")}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/products">
                    <ArrowLeft className="h-4 w-4 mr-2" /> {t("Continue Shopping")}
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <Truck className="h-5 w-5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold">{t("Nationwide")}</span>
                  <span className="text-[9px] text-muted-foreground">{t("Delivery")}</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <Shield className="h-5 w-5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold">{t("Secure")}</span>
                  <span className="text-[9px] text-muted-foreground">100%</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <Gift className="h-5 w-5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold">{t("COD")}</span>
                  <span className="text-[9px] text-muted-foreground">{t("Available")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
