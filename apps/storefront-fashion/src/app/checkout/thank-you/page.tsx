"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Home,
  Truck,
  MapPin,
  CreditCard,
  Mail,
  Phone,
  FileText,
  Package,
  ChevronRight,
  ShoppingBag,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { PaymentMethod } from "@ecom/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Separator,
  ProductCard,
  ProductCardData,
  cn,
  formatMoney,
  toast,
  CheckoutStepper,
  useGetOrderByKeyQuery,
  useGetProductsQuery,
  type OrderAddressSummary,
} from "@ecom/storefront-base";

const CURRENCY = "BDT";
const formatBDT = (n: number) => formatMoney(n, CURRENCY);

const PAYMENT_GATEWAY_LABELS: Record<string, string> = {
  [PaymentMethod.STRIPE]: "Credit / Debit Card (Stripe)",
  [PaymentMethod.BKASH]: "bKash",
  [PaymentMethod.NAGAD]: "Nagad",
  [PaymentMethod.ROCKET]: "Rocket",
  [PaymentMethod.SSLCOMMERZ]: "SSLCommerz",
  [PaymentMethod.COD]: "Cash On Delivery",
  [PaymentMethod.BANK_TRANSFER]: "Bank Transfer",
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "secondary" | "destructive" }> = {
  paid: { label: "Paid", variant: "success" },
  unpaid: { label: "Awaiting Payment", variant: "secondary" },
  failed: { label: "Payment Failed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "default" },
};

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const [copied, setCopied] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const orderKey = searchParams.get("key") ?? "";
  const { data: order, isLoading, isError } = useGetOrderByKeyQuery(orderKey, { skip: !orderKey });
  const { data: suggestions } = useGetProductsQuery({ featured: true, perPage: 3, sort: "popular" });
  const crossSell: ProductCardData[] = suggestions?.items ?? [];

  const expectedDelivery = React.useMemo(() => {
    const d = order ? new Date(order.createdAt) : new Date();
    const start = new Date(d);
    start.setDate(start.getDate() + 2);
    const end = new Date(d);
    end.setDate(end.getDate() + 5);
    return {
      start: start.toLocaleDateString("en-BD", { day: "numeric", month: "short" }),
      end: end.toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" }),
    };
  }, [order]);

  if (!mounted || (orderKey && isLoading)) {
    return (
      <div className="container py-10">
        <div className="animate-pulse max-w-4xl mx-auto">
          <div className="h-40 w-full mb-6 rounded-3xl bg-muted" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-72 rounded-2xl bg-muted" />
            <div className="h-72 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!orderKey || isError || !order) {
    return (
      <div className="container py-24 text-center max-w-xl">
        <h1 className="text-2xl font-bold mb-2">We couldn't find that order</h1>
        <p className="text-muted-foreground mb-6">The order link is incomplete or has expired. If you just placed an order, check your email or contact support with your phone number.</p>
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4 mr-2" /> Back to Home
          </Link>
        </Button>
      </div>
    );
  }

  const orderRef = order.orderRef;
  const status = order.status;
  const paymentGateway = order.paymentGateway;
  const pStatus =
    order.paymentGateway === PaymentMethod.COD && order.paymentStatus === "unpaid"
      ? { label: "Pay on Delivery", variant: "secondary" as const }
      : PAYMENT_STATUS_LABELS[order.paymentStatus] ?? { label: order.paymentStatus, variant: "default" as const };
  const orderItems = order.items;

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(orderRef);
      setCopied(true);
      toast.success("Copied!", { description: `Order #${orderRef} copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  const addressLines = (a: OrderAddressSummary) => ({
    name: a.name,
    address: a.address,
    city: [a.city, a.division].filter(Boolean).join(", "),
    postcode: a.postcode ?? "",
    country: a.country === "BD" ? "Bangladesh" : a.country ?? "",
  });
  const customer = {
    email: order.email,
    phone: order.phone ?? "",
    shipping: addressLines(order.shipping),
    billing: addressLines(order.billing),
  };

  return (
    <div className="container py-6 md:py-10 max-w-6xl">
      <div className="mb-8 max-w-3xl mx-auto">
        <CheckoutStepper
          currentStepId="confirmation"
          completedStepIds={["cart", "information", "shipping", "payment"]}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center max-w-2xl mx-auto"
      >
        <div className="relative inline-flex mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 12 }}
            className="h-24 w-24 md:h-28 md:w-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20"
          >
            <CheckCircle2 className="h-12 w-12 md:h-14 md:w-14 text-white" strokeWidth={2.5} />
          </motion.div>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-white border-4 border-background flex items-center justify-center shadow-lg"
          >
            <ShoppingBag className="h-4 w-4 text-primary" />
          </motion.div>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
          Your Order Has Been Received!
        </h1>
        <p className="text-muted-foreground mb-6 text-base md:text-lg">
          Thank you for shopping with Fashion BD. Keep your order reference handy; we'll contact you on {customer.phone || "your phone"} before delivery.
        </p>

        <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/5 via-background to-secondary/5 border-2 border-primary/10 shadow-sm">
          <div className="text-left sm:border-r sm:pr-5 border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Order Reference
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl font-black font-mono text-primary tracking-wide">
                {orderRef}
              </span>
              <button
                onClick={copyRef}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  copied ? "bg-green-500 text-white" : "bg-muted hover:bg-muted/70 text-muted-foreground",
                )}
                aria-label="Copy order ref"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success" className="text-xs px-3 py-1 gap-1 h-8">
              <Check className="h-3 w-3" /> Status: {status}
            </Badge>
            <Badge variant={pStatus.variant} className="text-xs px-3 py-1 gap-1 h-8">
              <CreditCard className="h-3 w-3" /> {pStatus.label}
            </Badge>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Order Summary ({orderItems.length} item{orderItems.length > 1 ? "s" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {orderItems.map((it) => {
                  const lineTotal = it.lineTotal;
                  return (
                    <div
                      key={it.id}
                      className="flex gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors"
                    >
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-slate-100 border flex-shrink-0">
                        <img
                          src={it.image}
                          alt={it.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
                          {it.qty}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="font-medium text-sm leading-tight line-clamp-2 mb-1">
                          {it.title}
                        </p>
                        {it.variantLabel && <p className="text-xs text-muted-foreground">{it.variantLabel}</p>}
                      </div>
                      <div className="text-right py-0.5 flex-shrink-0">
                        <p className="font-bold">{formatBDT(lineTotal)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {it.qty} × {formatBDT(it.price)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatBDT(order.itemsSubtotal)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon{order.couponUsed ? ` "${order.couponUsed}"` : ""}</span>
                    <span className="font-medium">-{formatBDT(order.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping ({order.shippingMethodName})</span>
                  <span className={cn("font-medium", order.shippingTotal === 0 && "text-green-600")}>
                    {order.shippingTotal === 0 ? "FREE" : formatBDT(order.shippingTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span className="font-medium">{formatBDT(order.taxTotal)}</span>
                </div>
                {order.feeTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment fee</span>
                    <span className="font-medium">{formatBDT(order.feeTotal)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-2xl font-black text-primary">{formatBDT(order.grandTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="font-semibold">{customer.shipping.name}</div>
                <div className="text-muted-foreground">{customer.shipping.address}</div>
                <div className="text-muted-foreground">
                  {customer.shipping.city}, {customer.shipping.postcode}
                </div>
                <div className="text-muted-foreground">{customer.shipping.country}</div>
                <div className="pt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="font-semibold">{customer.billing.name}</div>
                <div className="text-muted-foreground">{customer.billing.address}</div>
                <div className="text-muted-foreground">
                  {customer.billing.city}, {customer.billing.postcode}
                </div>
                <div className="text-muted-foreground">{customer.billing.country}</div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Payment Method:</span>
                  <span className="font-semibold text-xs">
                    {PAYMENT_GATEWAY_LABELS[paymentGateway] ?? paymentGateway}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Expected Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-primary mb-1">
                {expectedDelivery.start} — {expectedDelivery.end}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                We'll send you tracking updates via SMS & email once your order ships.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-background border">
                <Truck className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold">Track Your Order</div>
                  <div className="text-muted-foreground">Available after dispatch</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <Button className="w-full h-11" asChild>
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" /> Continue Shopping
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Order Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium break-all">{customer.email}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {crossSell.length > 0 && (
      <section className="mb-10">
        <div className="flex items-end justify-between mb-6 gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              You Might Also Like
            </h2>
            <p className="text-muted-foreground mt-1">Popular picks from our store</p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/products">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {crossSell.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      )}

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Need help with your order?</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Our customer support team is available 24/7. Have your order reference number {orderRef} ready when contacting us.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" asChild>
              <Link href="/faq">FAQ Page</Link>
            </Button>
            <Button asChild>
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
