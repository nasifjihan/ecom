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
  cn,
  formatMoney,
  toast,
} from "@ecom/storefront-base";

const PLACEHOLDER_IMG = (seed: string) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `fashion product ${seed} studio photo e-commerce clean white background professional`,
  )}&image_size=portrait_4_3`.replace("/v1/text_to_image?", `/v1/text_to_image?cache=cart-${seed}&`);

const CROSS_SELL = [
  { id: "xs1", slug: "cross-pkt-tissue", title: "Premium Cotton Pocket Tissue (Pack of 10)", image: PLACEHOLDER_IMG("tissue-pack"), price: 420 },
  { id: "xs2", slug: "cross-garment-bag", title: "Travel Garment Storage Bag", image: PLACEHOLDER_IMG("garment-bag"), price: 890 },
  { id: "xs3", slug: "cross-steam-iron", title: "Portable Handheld Garment Steamer", image: PLACEHOLDER_IMG("steamer"), price: 3290 },
];

function formatBDT(n: number) {
  return formatMoney(n, "BDT");
}

export default function CartPage() {
  const { items, subtotal, itemCount, updateQty, removeItem, clearCart } = useCart();
  const [couponCode, setCouponCode] = React.useState("");
  const [couponApplied, setCouponApplied] = React.useState<null | { code: string; amount: number; type: "percent" | "fixed" }>(null);
  const [applyingCoupon, setApplyingCoupon] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const shippingEstimate = subtotal >= 1000 ? 0 : subtotal > 0 ? 120 : 0;
  const vatRate = 0.05;
  const vatAmount = subtotal > 0 ? Math.round(subtotal * vatRate * 100) / 100 : 0;
  const discountAmount = couponApplied?.amount ?? 0;

  const grandTotal = Math.max(0, subtotal + shippingEstimate + vatAmount - discountAmount);

  const applyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    await new Promise((r) => setTimeout(r, 700));
    setApplyingCoupon(false);
    const code = couponCode.trim().toUpperCase();
    if (code === "EID20") {
      const discount = Math.round(subtotal * 0.2 * 100) / 100;
      setCouponApplied({ code, amount: Math.min(discount, 2000), type: "percent" });
      toast.success("Coupon applied!", { description: `৳${discount} OFF with EID20` });
    } else if (code === "BD100") {
      setCouponApplied({ code, amount: 100, type: "fixed" });
      toast.success("Coupon applied!", { description: "৳100 OFF with BD100" });
    } else {
      setCouponApplied(null);
      toast.error("Invalid coupon code", { description: "Try EID20 or BD100" });
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
    toast.info("Coupon removed");
  };

  const progressTowardFreeShipping = Math.min(100, Math.max(0, (subtotal / 1000) * 100));
  const shippingDelta = Math.max(0, 1000 - subtotal);

  return (
    <div className="container py-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <ShoppingBag className="h-7 w-7 text-primary" /> Shopping Cart
        </h1>
        <p className="text-muted-foreground">
          {mounted
            ? itemCount > 0
              ? `You have ${itemCount} item${itemCount > 1 ? "s" : ""} in your cart`
              : "Your cart is currently empty"
            : "Loading cart..."}
        </p>
      </div>

      {mounted && subtotal > 0 && shippingDelta > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50/60 to-orange-50 border border-amber-200"
        >
          <div className="flex items-start gap-3">
            <Gift className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-800 font-medium mb-1.5">
                Add <span className="font-bold">{formatBDT(shippingDelta)}</span> more for <span className="font-bold">FREE Delivery</span>! 🎉
              </p>
              <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressTowardFreeShipping}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                />
              </div>
            </div>
            <Button size="sm" variant="outline" className="flex-shrink-0 bg-white" asChild>
              <Link href="/products">
                Shop more <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      )}

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
              <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground max-w-sm mb-8">
                Looks like you haven't added anything yet. Explore our fashion catalog to find something you love!
              </p>
              <div className="flex flex-wrap items-center gap-3 justify-center">
                <Button size="lg" asChild>
                  <Link href="/products">
                    <ShoppingBag className="h-5 w-5 mr-2" /> Start Shopping
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/">
                    <ArrowLeft className="h-5 w-5 mr-2" /> Back to Home
                  </Link>
                </Button>
              </div>

              <Separator className="my-12 w-48" />

              <div className="w-full text-left">
                <h3 className="font-semibold mb-4">Customers also viewed</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {CROSS_SELL.map((p) => (
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
                <span>Product</span>
                <div className="grid grid-cols-[1fr_100px_140px_80px_40px] gap-4">
                  <span>Details</span>
                  <span>Unit Price</span>
                  <span>Quantity</span>
                  <span className="text-right">Total</span>
                  <span></span>
                </div>
              </div>

              <div className={cn("divide-y border rounded-2xl bg-card", "md:rounded-t-none")}>
                {items.map((item) => {
                  const lineTotal = Math.round(item.price * item.qty * 100) / 100;
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
                          <div className="text-xs text-muted-foreground mt-1 md:hidden">Unit: {formatBDT(item.price)}</div>
                        </div>

                        <div className="hidden md:block text-sm font-medium">{formatBDT(item.price)}</div>

                        <div className="mb-3 md:mb-0">
                          <div className="inline-flex items-center border rounded-lg overflow-hidden">
                            <button
                              onClick={() => {
                                if (item.qty <= 1) removeItem(item.productId, item.variantId);
                                else updateQty(item.productId, item.variantId, item.qty - 1);
                              }}
                              className="h-9 w-8 flex items-center justify-center hover:bg-accent transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="h-9 min-w-[2.5rem] flex items-center justify-center font-semibold text-sm border-x px-2">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}
                              className="h-9 w-8 flex items-center justify-center hover:bg-accent transition-colors"
                              aria-label="Increase quantity"
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
                              toast.info("Item removed from cart");
                            }}
                            className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            aria-label="Remove item"
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
                  <span className="text-muted-foreground">Shipping and taxes calculated at checkout.</span>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" asChild>
                    <Link href="/products">
                      <ArrowLeft className="h-4 w-4 mr-2" /> Continue Shopping
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { clearCart(); toast.info("Cart cleared"); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Clear Cart
                  </Button>
                </div>
              </div>

              <div className="p-5 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-secondary/5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-secondary" /> You May Also Like
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {CROSS_SELL.map((p) => (
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
                <ShoppingBag className="h-5 w-5 text-primary" /> Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    Subtotal
                    <Badge variant="secondary" className="text-[10px] px-1.5">{itemCount} items</Badge>
                  </span>
                  <span className="font-medium">{formatBDT(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    Shipping
                    {shippingEstimate === 0 && subtotal > 0 && (
                      <Badge variant="success" className="text-[10px] px-1.5">FREE</Badge>
                    )}
                  </span>
                  <span className={cn("font-medium", shippingEstimate === 0 && subtotal > 0 && "text-green-600")}>
                    {subtotal === 0 ? "—" : shippingEstimate === 0 ? "৳0.00" : formatBDT(shippingEstimate)}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground flex flex-col">
                    <span>VAT (5%)</span>
                    <span className="text-[11px] text-muted-foreground/80">Incl. in final price</span>
                  </span>
                  <span className="font-medium">{subtotal === 0 ? "—" : formatBDT(vatAmount)}</span>
                </div>

                {couponApplied && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between pt-2 border-t"
                  >
                    <span className="text-green-600 font-medium flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5" />
                      Coupon "{couponApplied.code}"
                      <button onClick={removeCoupon} className="text-destructive/70 hover:text-destructive ml-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                    <span className="text-green-600 font-medium">-{formatBDT(discountAmount)}</span>
                  </motion.div>
                )}
              </div>

              <Separator />

              <form onSubmit={applyCoupon} className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Promo Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="EID20 or BD100"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="uppercase tracking-wider"
                    disabled={!!couponApplied}
                  />
                  <Button
                    type="submit"
                    variant={couponApplied ? "outline" : "default"}
                    disabled={applyingCoupon || !!couponApplied}
                    className="min-w-[80px]"
                  >
                    {applyingCoupon ? "..." : couponApplied ? "Applied ✓" : "Apply"}
                  </Button>
                </div>
                {!couponApplied && (
                  <p className="text-[11px] text-muted-foreground">
                    💡 Try <code className="px-1.5 py-0.5 rounded bg-muted text-primary font-semibold">EID20</code> for 20% OFF, or <code className="px-1.5 py-0.5 rounded bg-muted text-primary font-semibold">BD100</code> for ৳100 OFF.
                  </p>
                )}
              </form>

              <Separator />

              <div className="bg-muted/30 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">Grand Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-primary">{formatBDT(grandTotal)}</div>
                    <div className="text-[11px] text-muted-foreground">Incl. all taxes & fees</div>
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5" /> You're saving {formatBDT(discountAmount + (subtotal >= 1000 ? 120 : 0))}!
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <Button
                  size="lg"
                  className="w-full h-12 text-base shadow-hover"
                  disabled={items.length === 0}
                  onClick={() => {
                    if (items.length === 0) return;
                    window.location.href = "/checkout";
                  }}
                >
                  Proceed to Checkout
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/products">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Continue Shopping
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <Truck className="h-5 w-5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold">Free Ship</span>
                  <span className="text-[9px] text-muted-foreground">৳1000+</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <Shield className="h-5 w-5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold">Secure</span>
                  <span className="text-[9px] text-muted-foreground">100%</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <Gift className="h-5 w-5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold">COD</span>
                  <span className="text-[9px] text-muted-foreground">Available</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
