"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  RotateCcw,
  Headphones,
  BadgeCheck,
  Mail,
  User,
  UserPlus,
  Lock,
  Truck,
  FileText,
  CreditCard,
  AlertCircle,
  Check,
  Clock,
  Zap,
  Tag,
} from "lucide-react";
import { PaymentMethod } from "@ecom/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Checkbox,
  Badge,
  Separator,
  Skeleton,
  Button,
  useCart,
  cn,
  formatMoney,
  toast,
  CheckoutStepper,
  DEFAULT_CHECKOUT_STEPS,
  useGetShippingRatesQuery,
  useGetTaxesQuery,
  useApplyCouponMutation,
  usePlaceOrderMutation,
  useGetPaymentMethodsQuery,
  apiErrorMessage,
  ShippingRate,
  CouponApplyInput,
  OrderSummaryCard,
  OrderSummaryLineItem,
  PaymentMethodList,
  DEFAULT_PAYMENT_GATEWAYS,
  PaymentFormData,
  CouponAppliedState,
  mapCouponTypeToDisplay,
  AddressFormData,
} from "@ecom/storefront-base";
import { useAppDispatch, useAppSelector } from "@/lib/store";
import { signIn, useCustomerRegisterMutation, useGetMyAddressesQuery } from "@/lib/account";
import { passwordProblem } from "@/app/account/_components";
import { useCartPriceCheck } from "@/lib/cart-prices";

const CURRENCY = "BDT";

function formatBDT(n: number) {
  return formatMoney(n, CURRENCY);
}

const TRUST_BADGES = [
  { icon: <ShieldCheck className="h-4 w-4" />, label: "Secure Checkout", desc: "SSL Encrypted" },
  { icon: <RotateCcw className="h-4 w-4" />, label: "Free Returns", desc: "7 days return" },
  { icon: <Headphones className="h-4 w-4" />, label: "24/7 Support", desc: "We're here" },
  { icon: <BadgeCheck className="h-4 w-4" />, label: "100% Protected", desc: "Purchase safe" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, itemCount, totalWeightKG, clearCart } = useCart();
  const { problems: cartProblems, hasProblems: cartHasProblems, recheck: recheckCart } = useCartPriceCheck();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const customerName = useAppSelector((s) => s.auth.customerName);
  const customerEmail = useAppSelector((s) => s.auth.customerEmail);

  const [currentStepId, setCurrentStepId] = React.useState<string>("information");
  const [completedStepIds, setCompletedStepIds] = React.useState<string[]>(["cart"]);

  const [contactEmail, setContactEmail] = React.useState(customerEmail ?? "");
  const [subscribeNewsletter, setSubscribeNewsletter] = React.useState(false);
  const [createAccount, setCreateAccount] = React.useState(false);
  const [accountPassword, setAccountPassword] = React.useState("");

  const [shippingAddress, setShippingAddress] = React.useState<Partial<AddressFormData>>({
    country: "BD",
    division: "Dhaka",
    district: "",
  });
  const [billingSameAsShipping, setBillingSameAsShipping] = React.useState(true);
  const [billingAddress, setBillingAddress] = React.useState<Partial<AddressFormData>>({});

  const [selectedShippingRateId, setSelectedShippingRateId] = React.useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [paymentFormData, setPaymentFormData] = React.useState<PaymentFormData>({});

  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<CouponAppliedState | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);

  const [termsChecked, setTermsChecked] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Signed-in customers: the session is restored after the first render, so pick up
  // their email then, and fill the address from their default saved address once.
  const dispatch = useAppDispatch();
  const [registerCustomer] = useCustomerRegisterMutation();
  React.useEffect(() => {
    if (isAuthenticated && customerEmail) setContactEmail((e) => e || customerEmail);
  }, [isAuthenticated, customerEmail]);
  const { data: savedAddresses } = useGetMyAddressesQuery(undefined, { skip: !mounted || !isAuthenticated });
  const prefilled = React.useRef(false);
  React.useEffect(() => {
    if (prefilled.current || !savedAddresses?.length) return;
    const a = savedAddresses.find((x) => x.type === "shipping" && x.isDefault) ?? savedAddresses.find((x) => x.type === "shipping") ?? savedAddresses[0]!;
    prefilled.current = true;
    setShippingAddress((s) => ({
      ...s,
      firstName: s.firstName || a.firstName,
      lastName: s.lastName || a.lastName,
      company: s.company || a.company || undefined,
      country: a.countryCode || s.country,
      division: a.state || s.division,
      district: s.district || a.city,
      postcode: s.postcode || a.postcode || "",
      addressLine1: s.addressLine1 || a.address1,
      addressLine2: s.addressLine2 || a.address2 || "",
      phone: s.phone || a.phone || "",
    }));
  }, [savedAddresses]);

  const shippingQueryArgs = React.useMemo(
    () => ({
      countryCode: shippingAddress.country ?? "BD",
      division: shippingAddress.division,
      district: shippingAddress.district,
      subtotal,
      weightKG: totalWeightKG,
      qty: itemCount,
    }),
    [shippingAddress.country, shippingAddress.division, shippingAddress.district, subtotal, totalWeightKG, itemCount],
  );

  const {
    data: rawRates,
    isLoading: ratesLoading,
    isError: ratesError,
  } = useGetShippingRatesQuery(shippingQueryArgs, {
    skip: !mounted || itemCount === 0,
    refetchOnMountOrArgChange: true,
  });

  const rates: ShippingRate[] = React.useMemo(() => rawRates ?? [], [rawRates]);

  React.useEffect(() => {
    // Rates change with the address; keep the selection only while it is still offered.
    if (rates.length === 0) {
      if (selectedShippingRateId) setSelectedShippingRateId(null);
      return;
    }
    if (!selectedShippingRateId || !rates.some((r) => r.methodId === selectedShippingRateId)) {
      const sorted = [...rates].sort((a, b) => a.cost - b.cost);
      setSelectedShippingRateId(sorted[0]!.methodId);
    }
  }, [rates, selectedShippingRateId]);

  const selectedRate = rates.find((r) => r.methodId === selectedShippingRateId);
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const isShippingFree = selectedRate ? selectedRate.cost === 0 || Boolean(appliedCoupon?.freeShipping) : false;
  const shippingAmount = selectedRate && !isShippingFree ? selectedRate.cost : 0;

  const { data: enabledGateways } = useGetPaymentMethodsQuery(undefined, { skip: !mounted });
  const paymentGateways = React.useMemo(
    () =>
      enabledGateways
        ? DEFAULT_PAYMENT_GATEWAYS.flatMap((g) => {
            const cfg = enabledGateways.find((e) => e.code === g.id);
            return cfg ? [{ ...g, extraFee: cfg.feeFixed > 0 ? cfg.feeFixed : undefined }] : [];
          })
        : DEFAULT_PAYMENT_GATEWAYS,
    [enabledGateways],
  );
  const selectedGatewayConfig = enabledGateways?.find((g) => g.code === selectedPaymentMethod);

  const taxQueryArgs = React.useMemo(
    () => ({
      countryCode: shippingAddress.country ?? "BD",
      division: shippingAddress.division,
      district: shippingAddress.district,
      subtotal: Math.max(0, subtotal - couponDiscount),
      shipping: shippingAmount,
    }),
    [shippingAddress.country, shippingAddress.division, shippingAddress.district, subtotal, couponDiscount, shippingAmount],
  );

  const {
    data: taxData,
    isLoading: taxLoading,
  } = useGetTaxesQuery(taxQueryArgs, {
    skip: !mounted || itemCount === 0,
    refetchOnMountOrArgChange: true,
  });

  const actualTaxTotal = taxData?.total ?? 0;
  const actualTaxLines = taxData?.lines ?? [];

  const gatewayFee = selectedGatewayConfig
    ? Math.round(
        (selectedGatewayConfig.feeFixed + ((subtotal - couponDiscount) * selectedGatewayConfig.feePercent) / 100) * 100,
      ) / 100
    : 0;
  const discountsArr: OrderSummaryLineItem[] = [];
  if (couponDiscount > 0) {
    discountsArr.push({
      id: "coupon",
      label: `Coupon "${appliedCoupon!.couponCode}"`,
      amount: couponDiscount,
      isDiscount: true,
      color: "text-green-600 font-medium",
      badge: appliedCoupon?.discountType === "FREE_SHIPPING" ? "Free Ship" : undefined,
    });
  }

  const grandTotal = Math.max(0, subtotal + shippingAmount + actualTaxTotal + gatewayFee - couponDiscount);

  const [applyCoupon, { isLoading: applyingCoupon }] = useApplyCouponMutation();
  const [placeOrder, { isLoading: placingOrder }] = usePlaceOrderMutation();

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError(null);
    try {
      const code = couponCode.trim().toUpperCase();
      const result = await applyCoupon({
        code,
        subtotal,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          price: it.price,
          qty: it.qty,
        })),
        shippingTotal: shippingAmount,
        countryCode: shippingAddress.country,
        email: contactEmail || undefined,
      }).unwrap();

      if (result.valid) {
        setAppliedCoupon({
          valid: true,
          couponCode: result.couponCode,
          discountAmount: result.discountAmount,
          discountType: mapCouponTypeToDisplay(result.discountType as any),
          freeShipping: result.freeShipping,
          message: result.message,
          newCartTotal: result.newCartTotal,
          newSubtotal: result.newSubtotal,
        });
        setCouponCode("");
        toast.success("Coupon applied!", {
          description: `-৳${result.discountAmount} OFF with ${result.couponCode}`,
        });
      } else {
        setCouponError(result.errorMessage ?? "Invalid or expired coupon code");
        setAppliedCoupon(null);
        toast.error("Invalid coupon", {
          description: result.errorMessage ?? "Check the code and try again",
        });
      }
    } catch (err: any) {
      const msg = apiErrorMessage(err, "Could not apply coupon. Try again.");
      setCouponError(msg);
      toast.error("Coupon error", { description: msg });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCode("");
    toast.info("Coupon removed");
  };

  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "information":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
          toast.error("Valid email required", { description: "Please enter a valid contact email" });
          return false;
        }
        if (createAccount && !isAuthenticated && passwordProblem(accountPassword)) {
          toast.error("Choose a stronger password", { description: passwordProblem(accountPassword)! });
          return false;
        }
        return true;
      case "shipping":
        if (!selectedShippingRateId) {
          toast.error("Choose shipping method", { description: "Select a shipping method to continue" });
          return false;
        }
        if (!shippingAddress.firstName || !shippingAddress.lastName ||
            !shippingAddress.addressLine1 || !shippingAddress.phone ||
            !shippingAddress.district || !shippingAddress.postcode) {
          toast.error("Fill shipping address", { description: "All required fields in shipping address are required" });
          return false;
        }
        return true;
      case "payment":
        if (!selectedPaymentMethod) {
          toast.error("Payment method required", { description: "Please select a payment method" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const advanceStep = () => {
    if (!validateStep(currentStepId)) return;
    setCompletedStepIds((prev) => (prev.includes(currentStepId) ? prev : [...prev, currentStepId]));
    const idx = DEFAULT_CHECKOUT_STEPS.findIndex((s) => s.id === currentStepId);
    if (idx >= 0 && idx < DEFAULT_CHECKOUT_STEPS.length - 1) {
      const next = DEFAULT_CHECKOUT_STEPS[idx + 1]!;
      setCurrentStepId(next.id);
    }
  };

  const handlePlaceOrder = async () => {
    if (itemCount === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (cartHasProblems) {
      toast.error("Some items can't be ordered", { description: Object.values(cartProblems)[0] });
      return;
    }
    if (!validateStep("information") || !validateStep("shipping") || !validateStep("payment")) return;
    if (!termsChecked) {
      toast.error("Accept terms first", { description: "Please read and agree to Terms & Conditions" });
      return;
    }

    // "Create an account": register first, so the order is placed on the new account.
    let signedIn = isAuthenticated;
    if (createAccount && !isAuthenticated) {
      try {
        const account = await registerCustomer({
          email: contactEmail.trim(),
          password: accountPassword,
          firstName: shippingAddress.firstName ?? "",
          lastName: shippingAddress.lastName ?? "",
          phone: shippingAddress.phone || undefined,
          acceptMarketing: subscribeNewsletter,
        }).unwrap();
        signIn(dispatch, account);
        signedIn = true;
        setCreateAccount(false);
      } catch (err) {
        toast.error("Couldn't create your account", {
          description: `${apiErrorMessage(err)} You can untick "Create an account" to check out as a guest.`,
        });
        return;
      }
    }

    try {
      const shippingPayload = {
        firstName: shippingAddress.firstName ?? "",
        lastName: shippingAddress.lastName ?? "",
        company: shippingAddress.company,
        country: shippingAddress.country ?? "BD",
        division: shippingAddress.division ?? "",
        district: shippingAddress.district ?? "",
        postcode: shippingAddress.postcode ?? "",
        addressLine1: shippingAddress.addressLine1 ?? "",
        addressLine2: shippingAddress.addressLine2 ?? "",
        phone: shippingAddress.phone ?? "",
        email: contactEmail || shippingAddress.email || customerEmail || undefined,
      };

      const billingPayload = billingSameAsShipping
        ? shippingPayload
        : {
            firstName: billingAddress.firstName ?? "",
            lastName: billingAddress.lastName ?? "",
            company: billingAddress.company,
            country: billingAddress.country ?? "BD",
            division: billingAddress.division ?? "",
            district: billingAddress.district ?? "",
            postcode: billingAddress.postcode ?? "",
            addressLine1: billingAddress.addressLine1 ?? "",
            addressLine2: billingAddress.addressLine2 ?? "",
            phone: billingAddress.phone ?? shippingAddress.phone ?? "",
            email: contactEmail || billingAddress.email || shippingAddress.email || customerEmail || undefined,
          };


      const result = await placeOrder({
        email: contactEmail || customerEmail || shippingPayload.email || "",
        phone: shippingPayload.phone,
        isGuest: !signedIn,
        subscribeNewsletter,
        shippingAddress: shippingPayload,
        billingAddress: billingPayload,
        billingSameAsShipping,
        shippingMethodId: selectedRate?.methodId,
        shippingProviderId: selectedRate?.providerId,
        shippingCost: shippingAmount,
        paymentGateway: selectedPaymentMethod ?? PaymentMethod.COD,
        paymentDetails: paymentFormData as Record<string, unknown>,
        couponCodes: appliedCoupon?.valid ? [appliedCoupon.couponCode] : [],
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          qty: it.qty,
          price: it.price,
          title: it.title,
          image: it.image,
          variantLabel: it.variantLabel,
          weightKG: it.weightKG,
        })),
        subtotal,
        shippingTotal: shippingAmount,
        taxTotal: actualTaxTotal,
        discountTotal: couponDiscount,
        grandTotal,
        currency: CURRENCY,
        termsAgreed: true,
      }).unwrap();

      toast.success("Order placed!", { description: `Order #${result.orderRef} created successfully` });
      clearCart();
      setCompletedStepIds((prev) => [...prev, "information", "shipping", "payment"]);
      setCurrentStepId("confirmation");

      if (result.redirectPaymentURL) {
        window.location.href = result.redirectPaymentURL;
      } else {
        router.push(`/checkout/thank-you?key=${encodeURIComponent(result.orderKey)}`);
      }
    } catch (err: any) {
      const msg = apiErrorMessage(err, "Could not place order. Please try again.");
      toast.error("Order failed", { description: msg });
      // Stock or a flash-sale price may have run out: refresh the cart so it shows what changed.
      recheckCart();
    }
  };

  const cheapest = React.useMemo(() => {
    if (!rates.length) return null;
    return [...rates].sort((a, b) => a.cost - b.cost)[0]?.methodId ?? null;
  }, [rates]);
  const fastest = React.useMemo(() => {
    if (!rates.length) return null;
    return [...rates].sort(
      (a, b) => (a.maxDeliveryDays ?? 99) - (b.maxDeliveryDays ?? 99),
    )[0]?.methodId ?? null;
  }, [rates]);

  if (!mounted) {
    return (
      <div className="container py-10">
        <Skeleton className="h-16 w-full mb-8 rounded-2xl" />
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[500px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="container py-16 text-center max-w-xl mx-auto">
        <div className="h-28 w-28 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
          <Tag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-8">
          Add some products first, then come back to checkout.
        </p>
        <Button size="lg" asChild>
          <Link href="/products">Browse Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6 md:py-10">
      <div className="mb-8 space-y-5">
        <CheckoutStepper
          currentStepId={currentStepId}
          completedStepIds={completedStepIds}
          onStepClick={(id) => {
            const idx = DEFAULT_CHECKOUT_STEPS.findIndex((s) => s.id === id);
            const curIdx = DEFAULT_CHECKOUT_STEPS.findIndex((s) => s.id === currentStepId);
            if (idx <= curIdx) setCurrentStepId(id);
          }}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {TRUST_BADGES.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-xl bg-card border"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                {b.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs md:text-sm font-semibold leading-tight">{b.label}</div>
                <div className="hidden md:block text-[11px] text-muted-foreground leading-tight">
                  {b.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
        <section className="space-y-6 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Section 1: Contact Information
                  </CardTitle>
                  <Badge variant={isAuthenticated ? "success" : "secondary"}>
                    {isAuthenticated ? "Logged in" : "Guest Checkout"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-5">
                  {isAuthenticated ? (
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-green-800">
                          Welcome back, {customerName ?? "Valued Customer"}!
                        </div>
                        <div className="text-sm text-green-700/80">{customerEmail}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-dashed">
                        <User className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <span className="text-muted-foreground">Already have an account? </span>
                          <Link href="/account/login?next=/checkout" className="font-semibold text-primary hover:underline">
                            Log in
                          </Link>
                          <span className="text-muted-foreground"> for a faster checkout experience.</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email Address *</Label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className={cn(!contactEmail && "border-muted")}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          We'll send your order confirmation and tracking updates to this email.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={subscribeNewsletter}
                          onCheckedChange={setSubscribeNewsletter}
                        />
                        <Label className="text-sm cursor-pointer text-foreground leading-relaxed">
                          Subscribe to our newsletter for exclusive discounts, new arrivals and flash sales.
                          <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">
                            Unsubscribe at any time. We respect your privacy.
                          </span>
                        </Label>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-primary" />
                            <Label className="font-semibold cursor-pointer">Create an account?</Label>
                          </div>
                          <Checkbox
                            checked={createAccount}
                            onCheckedChange={setCreateAccount}
                          />
                        </div>
                        <AnimatePresence>
                          {createAccount && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                                <div className="flex items-start gap-2 text-xs text-primary/80">
                                  <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                  Create an account now to track orders, save addresses & earn loyalty points with future purchases.
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Password *</Label>
                                  <Input
                                    type="password"
                                    placeholder="8+ characters, an uppercase letter and a number"
                                    value={accountPassword}
                                    onChange={(e) => setAccountPassword(e.target.value)}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Section 2: Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "firstName", label: "First Name *", placeholder: "John", required: true },
                      { key: "lastName", label: "Last Name *", placeholder: "Doe", required: true },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label>{f.label}</Label>
                        <Input
                          placeholder={f.placeholder}
                          value={(shippingAddress as any)[f.key] ?? ""}
                          onChange={(e) =>
                            setShippingAddress((s) => ({ ...s, [f.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company (Optional)</Label>
                    <Input
                      placeholder="Acme Ltd."
                      value={shippingAddress.company ?? ""}
                      onChange={(e) =>
                        setShippingAddress((s) => ({ ...s, company: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Country *</Label>
                      <select
                        value={shippingAddress.country ?? "BD"}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, country: e.target.value }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="BD">🇧🇩 Bangladesh</option>
                        <option value="US">🇺🇸 United States</option>
                        <option value="GB">🇬🇧 United Kingdom</option>
                        <option value="CA">🇨🇦 Canada</option>
                        <option value="AU">🇦🇺 Australia</option>
                        <option value="IN">🇮🇳 India</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Division / State *</Label>
                      <select
                        value={shippingAddress.division ?? "Dhaka"}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, division: e.target.value }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {[
                          "Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal",
                          "Sylhet", "Rangpur", "Mymensingh",
                        ].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>District / City *</Label>
                      <Input
                        placeholder="e.g. Dhanmondi, Dhaka"
                        value={shippingAddress.district ?? ""}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, district: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postcode / ZIP *</Label>
                      <Input
                        placeholder="e.g. 1205"
                        value={shippingAddress.postcode ?? ""}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, postcode: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address Line 1 *</Label>
                    <Input
                      placeholder="House #42, Road #11, Banani"
                      value={shippingAddress.addressLine1 ?? ""}
                      onChange={(e) =>
                        setShippingAddress((s) => ({ ...s, addressLine1: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address Line 2 (Optional)</Label>
                    <Input
                      placeholder="Apartment, suite, floor, building"
                      value={shippingAddress.addressLine2 ?? ""}
                      onChange={(e) =>
                        setShippingAddress((s) => ({ ...s, addressLine2: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Phone Number *</Label>
                      <Input
                        placeholder="+8801XXXXXXXXX"
                        value={shippingAddress.phone ?? ""}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, phone: e.target.value }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Rider will call this number for delivery coordination
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="Contact email (same as above if filled)"
                        value={shippingAddress.email ?? contactEmail ?? ""}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, email: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={billingSameAsShipping}
                      onCheckedChange={setBillingSameAsShipping}
                    />
                    <div>
                      <Label className="font-semibold cursor-pointer">
                        Billing address same as shipping
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Uncheck if billing differs (for corporate/invoice orders)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Section 3: Shipping Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {ratesLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : rates.length === 0 ? (
                    <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-center">
                      <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="font-semibold text-amber-800 mb-1">
                        {ratesError
                          ? "We couldn't load delivery options"
                          : "Sorry, no carriers available for your location"}
                      </p>
                      <p className="text-sm text-amber-700/80">
                        {ratesError
                          ? "Check the division and district, then try again."
                          : "Please contact support or try a different shipping address."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rates.map((rate) => {
                        const isSelected = selectedShippingRateId === rate.methodId;
                        const rateIsFree = rate.cost === 0;
                        const isCheapest = cheapest === rate.methodId;
                        const isFastest = fastest === rate.methodId;
                        return (
                          <div
                            key={rate.methodId}
                            onClick={() => setSelectedShippingRateId(rate.methodId)}
                            className={cn(
                              "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                                : "border-muted hover:border-muted-foreground/40 hover:shadow-sm",
                            )}
                          >
                            <div className="flex items-start gap-3 md:gap-4">
                              <div
                                className={cn(
                                  "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                  isSelected ? "border-primary bg-primary" : "border-muted",
                                )}
                              >
                                {isSelected && (
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="font-semibold text-base">{rate.methodName}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    {rate.providerName}
                                  </span>
                                  {isCheapest && (
                                    <Badge variant="success" className="text-[10px] px-2 py-0.5 gap-1">
                                      <Tag className="h-3 w-3" /> Cheapest
                                    </Badge>
                                  )}
                                  {isFastest && !isCheapest && (
                                    <Badge variant="default" className="text-[10px] px-2 py-0.5 gap-1">
                                      <Zap className="h-3 w-3" /> Fastest
                                    </Badge>
                                  )}
                                  {rateIsFree && (
                                    <Badge variant="success" className="text-[10px] px-2 py-0.5 gap-1">
                                      FREE
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>
                                    Estimated: {rate.estimatedLabel ?? `${rate.minDeliveryDays ?? 1}-${rate.maxDeliveryDays ?? 5} days`}
                                  </span>
                                </div>
                                {rate.description && (
                                  <p className="text-xs text-muted-foreground/80">{rate.description}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0 md:ml-4">
                                <div
                                  className={cn(
                                    "text-xl font-black",
                                    rateIsFree ? "text-green-600" : "text-foreground",
                                  )}
                                >
                                  {rateIsFree ? "FREE" : formatBDT(rate.cost)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">VAT / Tax Breakdown</h4>
                      </div>
                      {taxLoading && <Skeleton className="h-5 w-20 rounded" />}
                    </div>
                    <div className="rounded-xl border bg-muted/20 overflow-hidden">
                      <div className="divide-y">
                        {actualTaxLines.map((line, i) => (
                          <div key={i} className="flex justify-between items-center px-4 py-2.5 text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              {line.name}
                              {typeof line.rate === "number" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                                  {(line.rate * 100).toFixed(0)}%
                                </span>
                              )}
                            </span>
                            <span className="font-medium">{formatBDT(line.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center px-4 py-2.5 bg-card font-semibold">
                          <span>Total Tax</span>
                          <span className="text-primary">{formatBDT(actualTaxTotal)}</span>
                        </div>
                      </div>
                    </div>
                    {(shippingAddress.country ?? "BD") !== "BD" && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        International orders may be subject to export-exempt Zero rate VAT and customs duties at destination.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Section 4: Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentMethodList
                    gateways={paymentGateways}
                    selectedMethod={selectedPaymentMethod}
                    onSelect={setSelectedPaymentMethod}
                    formData={paymentFormData}
                    onFormDataChange={setPaymentFormData}
                    currency={CURRENCY}
                  />
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-between gap-3 lg:hidden">
                <Button variant="outline" size="lg" asChild>
                  <Link href="/cart">← Back to Cart</Link>
                </Button>
                <Button size="lg" onClick={handlePlaceOrder} disabled={placingOrder || cartHasProblems} className="h-12">
                  {placingOrder ? "Placing Order..." : `Place Order • ${formatBDT(grandTotal)}`}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="space-y-4">
          {cartHasProblems && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertCircle className="h-4 w-4" /> Some items can&apos;t be ordered
              </div>
              <ul className="mt-2 space-y-1 text-destructive/90">
                {Object.values(cartProblems).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href="/cart" className="mt-2 inline-block font-medium underline">
                Update your cart
              </Link>
            </div>
          )}
          <OrderSummaryCard
            subtotal={subtotal}
            shippingAmount={shippingAmount}
            shippingLabel={selectedRate?.methodName}
            shippingFree={isShippingFree}
            shippingLoading={ratesLoading}
            taxAmount={actualTaxTotal}
            taxLines={actualTaxLines}
            taxLoading={taxLoading}
            discounts={discountsArr}
            customLines={
              gatewayFee > 0
                ? [
                    {
                      id: "gateway-fee",
                      label: `${selectedGatewayConfig?.name ?? "Payment"} fee`,
                      amount: gatewayFee,
                    },
                  ]
                : []
            }
            couponCode={couponCode}
            onCouponCodeChange={setCouponCode}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
            appliedCoupon={appliedCoupon}
            applyingCoupon={applyingCoupon}
            couponError={couponError}
            grandTotal={grandTotal}
            placeOrderDisabled={placingOrder || cartHasProblems}
            placeOrderLoading={placingOrder}
            placeOrderLabel={`Place Order • ${formatBDT(grandTotal)}`}
            onPlaceOrder={handlePlaceOrder}
            termsChecked={termsChecked}
            onTermsToggle={setTermsChecked}
            currency={CURRENCY}
            sticky
            showItemsPreview
          />
        </aside>
      </div>
    </div>
  );
}
