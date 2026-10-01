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
  MapPin,
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
  useT,
  msg,
  cn,
  formatMoney,
  toast,
  CheckoutStepper,
  DEFAULT_CHECKOUT_STEPS,
  useGetShippingRatesQuery,
  LocationSelects,
  type LocationValue,
  useGetTaxesQuery,
  useApplyCouponMutation,
  usePlaceOrderMutation,
  useGetPaymentMethodsQuery,
  useGetDeliveryChoicesQuery,
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
  useIdempotencyKey,
} from "@ecom/storefront-base";
import { useAppDispatch, useAppSelector } from "@/lib/store";
import { useMyLoyaltyQuery } from "@/lib/loyalty";
import { signIn, useCustomerRegisterMutation, useGetMyAddressesQuery } from "@/lib/account";
import { passwordProblem } from "@/app/account/_components";
import { CourierPicker, DeliveryTimePicker, type SlotPick } from "./_delivery-choices";
import { useCartPriceCheck } from "@/lib/cart-prices";
import { useAvailableCouponsQuery } from "@/lib/promotions";
import { CartPromotionSummary, PromoSlotStrip, promotionLines } from "@/app/_components/promotions";
import { salesCode } from "@/lib/sales-code";

const CURRENCY = "BDT";

function formatBDT(n: number) {
  return formatMoney(n, CURRENCY);
}

const TRUST_BADGES = [
  { icon: <ShieldCheck className="h-4 w-4" />, label: msg("Secure Checkout"), desc: msg("SSL Encrypted") },
  { icon: <RotateCcw className="h-4 w-4" />, label: msg("Free Returns"), desc: msg("7 days return") },
  { icon: <Headphones className="h-4 w-4" />, label: msg("24/7 Support"), desc: msg("We're here") },
  { icon: <BadgeCheck className="h-4 w-4" />, label: msg("100% Protected"), desc: msg("Purchase safe") },
];

export default function CheckoutPage() {
  const router = useRouter();
  const t = useT();
  const { items, boxes, subtotal, itemCount, totalWeightKG, clearCart } = useCart();
  // Gift boxes go to the server as their lines, tagged with the box.
  const boxLines = React.useMemo(
    () =>
      boxes.flatMap((b) =>
        [{ it: b.box, role: "box" as const }, ...b.items.map((it) => ({ it, role: "item" as const }))].map(({ it, role }) => ({
          productId: it.productId,
          variantId: it.variantId,
          qty: it.qty,
          price: it.price,
          title: it.title,
          image: it.image,
          variantLabel: it.variantLabel,
          weightKG: it.weightKG,
          box: { key: b.key, giftBoxId: b.giftBoxId, role, ...(role === "box" ? { message: b.message ?? null } : {}) },
        })),
      ),
    [boxes],
  );
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const customerName = useAppSelector((s) => s.auth.customerName);
  const customerEmail = useAppSelector((s) => s.auth.customerEmail);

  const [currentStepId, setCurrentStepId] = React.useState<string>("information");
  const [completedStepIds, setCompletedStepIds] = React.useState<string[]>(["cart"]);

  const [contactEmail, setContactEmail] = React.useState(customerEmail ?? "");
  const [subscribeNewsletter, setSubscribeNewsletter] = React.useState(false);
  const [createAccount, setCreateAccount] = React.useState(false);
  const [accountPassword, setAccountPassword] = React.useState("");

  const [shippingAddress, setShippingAddress] = React.useState<Partial<AddressFormData> & LocationValue>({
    country: "BD",
    division: "",
    district: "",
    upazila: "",
    locationId: null,
  });
  const [billingSameAsShipping, setBillingSameAsShipping] = React.useState(true);
  const [billingAddress, setBillingAddress] = React.useState<Partial<AddressFormData>>({});

  const [selectedShippingRateId, setSelectedShippingRateId] = React.useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [paymentFormData, setPaymentFormData] = React.useState<PaymentFormData>({});

  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<CouponAppliedState | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  // Re-prices the cart on the server; with the applied coupon, so promotions it can't be combined with drop off.
  const {
    problems: cartProblems,
    hasProblems: cartHasProblems,
    recheck: recheckCart,
    promotions,
    member,
  } = useCartPriceCheck({ couponCode: appliedCoupon?.valid ? appliedCoupon.couponCode : undefined, email: contactEmail || undefined });
  const promoDiscount = promotions && !promotions.droppedForCoupon ? promotions.total : 0;
  // A signed-in customer's loyalty level discount (worked out by the server with the coupon applied).
  const memberDiscount = member?.discount ?? 0;
  const { data: loyalty } = useMyLoyaltyQuery(undefined, { skip: !isAuthenticated });
  const [payFromWallet, setPayFromWallet] = React.useState(false);
  const { data: availableCoupons = [] } = useAvailableCouponsQuery();

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
      upazila: s.upazila || a.upazila || "",
      locationId: s.locationId ?? a.locationId ?? null,
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
      upazila: shippingAddress.upazila,
      locationId: shippingAddress.locationId,
      subtotal,
      weightKG: totalWeightKG,
      qty: itemCount,
    }),
    [
      shippingAddress.country,
      shippingAddress.division,
      shippingAddress.district,
      shippingAddress.upazila,
      shippingAddress.locationId,
      subtotal,
      totalWeightKG,
      itemCount,
    ],
  );

  const {
    data: rawRates,
    isLoading: ratesLoading,
    isError: ratesError,
  } = useGetShippingRatesQuery(shippingQueryArgs, {
    // Bangladesh rates need a district first; other countries match on the country alone.
    skip: !mounted || itemCount === 0 || (shippingQueryArgs.countryCode === "BD" && !shippingQueryArgs.district),
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

  // Delivery day and time (options that use slots) and the courier, when the shop lets customers choose.
  const { data: deliveryChoices } = useGetDeliveryChoicesQuery(undefined, { skip: !mounted || itemCount === 0 });
  const [slotPick, setSlotPick] = React.useState<SlotPick | null>(null);
  const [courierPick, setCourierPick] = React.useState<string | null>(null);
  const slotDays = React.useMemo(() => deliveryChoices?.days ?? [], [deliveryChoices]);
  const couriers = React.useMemo(() => deliveryChoices?.couriers ?? [], [deliveryChoices]);
  const pickedSlot = selectedRate?.useSlots && slotPick
    ? slotDays.find((d) => d.date === slotPick.date)?.slots.find((s) => s.id === slotPick.slotId && s.available) ?? null
    : null;
  React.useEffect(() => {
    // A slot that filled up or closed since it was picked is dropped.
    if (slotPick && deliveryChoices && !slotDays.some((d) => d.date === slotPick.date && d.slots.some((s) => s.id === slotPick.slotId && s.available))) setSlotPick(null);
  }, [deliveryChoices, slotDays, slotPick]);
  React.useEffect(() => {
    if (couriers.length && !couriers.some((c) => c.id === courierPick)) setCourierPick(couriers[0]!.id);
  }, [couriers, courierPick]);
  // The slot's charge isn't waived by free delivery.
  const slotFee = pickedSlot?.fee ?? 0;
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const isShippingFree = selectedRate
    ? selectedRate.cost === 0 || Boolean(appliedCoupon?.freeShipping) || Boolean(promotions?.freeDelivery && !promotions.droppedForCoupon)
    : false;
  const shippingAmount = (selectedRate && !isShippingFree ? selectedRate.cost : 0) + slotFee;

  const { data: enabledGateways } = useGetPaymentMethodsQuery(undefined, { skip: !mounted });
  const paymentGateways = React.useMemo(
    () =>
      enabledGateways
        ? DEFAULT_PAYMENT_GATEWAYS.flatMap((g) => {
            const cfg = enabledGateways.find((e) => e.code === g.id);
            if (!cfg) return [];
            const manual =
              cfg.mode === "manual"
                ? { accountNumber: cfg.accountNumber, accountType: cfg.accountType, instructions: cfg.instructions }
                : undefined;
            return [{ ...g, brandName: cfg.name || g.brandName, extraFee: cfg.feeFixed > 0 ? cfg.feeFixed : undefined, manual }];
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
      subtotal: Math.max(0, subtotal - couponDiscount - promoDiscount - memberDiscount),
      shipping: shippingAmount,
    }),
    [shippingAddress.country, shippingAddress.division, shippingAddress.district, subtotal, couponDiscount, promoDiscount, memberDiscount, shippingAmount],
  );

  const {
    data: taxData,
    isLoading: taxLoading,
  } = useGetTaxesQuery(taxQueryArgs, {
    skip: !mounted || itemCount === 0,
    refetchOnMountOrArgChange: true,
  });

  const actualTaxTotal = taxData?.total ?? 0;
  // VAT-inclusive prices: the VAT is already inside them, so it isn't added to the total.
  const taxIncluded = !!taxData?.included;
  const actualTaxLines = taxData?.lines ?? [];

  const gatewayFee = selectedGatewayConfig
    ? Math.round(
        (selectedGatewayConfig.feeFixed + ((subtotal - couponDiscount - promoDiscount - memberDiscount) * selectedGatewayConfig.feePercent) / 100) * 100,
      ) / 100
    : 0;
  const discountsArr: OrderSummaryLineItem[] = promotionLines(promotions).map((l) => ({
    id: l.id,
    label: l.label,
    amount: l.amount,
    isDiscount: true,
    color: "text-green-600 font-medium",
  }));
  if (couponDiscount > 0) {
    discountsArr.push({
      id: "coupon",
      label: t("Coupon \"{code}\"", { code: appliedCoupon!.couponCode }),
      amount: couponDiscount,
      isDiscount: true,
      color: "text-green-600 font-medium",
      badge: appliedCoupon?.discountType === "FREE_SHIPPING" ? t("Free Ship") : undefined,
    });
  }

  if (memberDiscount > 0) {
    discountsArr.push({
      id: "member",
      label: t("{level} member ({percent}% off)", { level: member!.level, percent: member!.percent }),
      amount: memberDiscount,
      isDiscount: true,
      color: "text-green-600 font-medium",
    });
  }

  const orderTotal = Math.max(0, subtotal + shippingAmount + (taxIncluded ? 0 : actualTaxTotal) + gatewayFee - couponDiscount - promoDiscount - memberDiscount);
  // The wallet pays what the shop allows; the payment method covers the rest.
  const walletBalance = loyalty?.wallet.enabled ? loyalty.wallet.balance : 0;
  const walletUsed =
    payFromWallet && walletBalance > 0
      ? Math.round(Math.min(walletBalance, (orderTotal * (loyalty?.wallet.maxPercent ?? 100)) / 100, orderTotal) * 100) / 100
      : 0;
  if (walletUsed > 0) {
    discountsArr.push({ id: "wallet", label: t("Paid from your wallet"), amount: walletUsed, isDiscount: true, color: "text-primary font-medium" });
  }
  const grandTotal = Math.max(0, Math.round((orderTotal - walletUsed) * 100) / 100);

  const [applyCoupon, { isLoading: applyingCoupon }] = useApplyCouponMutation();
  const [placeOrder, { isLoading: placingOrder }] = usePlaceOrderMutation();
  // The same order sent twice (double click, lost connection) is placed once.
  const withKey = useIdempotencyKey();

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyCode(couponCode);
  };

  const applyCode = async (raw: string) => {
    if (!raw.trim()) return;
    setCouponError(null);
    try {
      const code = raw.trim().toUpperCase();
      const result = await applyCoupon({
        code,
        subtotal,
        items: [
          ...items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            price: it.price,
            qty: it.qty,
          })),
          ...boxLines.map((l) => ({ productId: l.productId, variantId: l.variantId, price: l.price, qty: l.qty })),
        ],
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
        toast.success(t("Coupon applied!"), {
          description:
            result.worksWithPromotions === false && promoDiscount > 0
              ? t("-৳{amount} with {code}. It can't be combined with other offers, so they're removed.", { amount: result.discountAmount, code: result.couponCode })
              : t("-৳{amount} OFF with {code}", { amount: result.discountAmount, code: result.couponCode }),
        });
      } else {
        setCouponError(result.errorMessage ?? t("Invalid or expired coupon code"));
        setAppliedCoupon(null);
        toast.error(t("Invalid coupon"), {
          description: result.errorMessage ?? t("Check the code and try again"),
        });
      }
    } catch (err: any) {
      const msg = apiErrorMessage(err, t("Could not apply coupon. Try again."));
      setCouponError(msg);
      toast.error(t("Coupon error"), { description: msg });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCode("");
    toast.info(t("Coupon removed"));
  };

  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "information":
        // Email is optional (many customers only give a phone), but a new account needs one.
        if ((contactEmail.trim() || createAccount) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
          toast.error(createAccount ? t("Email needed for an account") : t("Check your email"), {
            description: createAccount ? t("Enter your email to create an account, or untick it.") : t("That doesn't look like an email address. Leave it empty if you don't have one."),
          });
          return false;
        }
        if (createAccount && !isAuthenticated && passwordProblem(accountPassword)) {
          toast.error(t("Choose a stronger password"), { description: t(passwordProblem(accountPassword)!) });
          return false;
        }
        return true;
      case "shipping":
        if (!selectedShippingRateId) {
          toast.error(t("Choose shipping method"), { description: t("Select a shipping method to continue") });
          return false;
        }
        if (selectedRate?.useSlots && !pickedSlot) {
          toast.error(t("Pick a delivery time"), { description: t("Choose the day and time you'd like your order.") });
          return false;
        }
        if (!shippingAddress.firstName || !shippingAddress.lastName ||
            !shippingAddress.addressLine1 || !shippingAddress.phone ||
            !shippingAddress.district) {
          toast.error(t("Fill shipping address"), { description: t("All required fields in shipping address are required") });
          return false;
        }
        return true;
      case "payment":
        if (!selectedPaymentMethod) {
          toast.error(t("Payment method required"), { description: t("Please select a payment method") });
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
      toast.error(t("Your cart is empty"));
      return;
    }
    if (cartHasProblems) {
      toast.error(t("Some items can't be ordered"), { description: Object.values(cartProblems)[0] });
      return;
    }
    if (!validateStep("information") || !validateStep("shipping") || !validateStep("payment")) return;
    if (!termsChecked) {
      toast.error(t("Accept terms first"), { description: t("Please read and agree to Terms & Conditions") });
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
        toast.error(t("Couldn't create your account"), {
          description: `${apiErrorMessage(err)} ${t("You can untick \"Create an account\" to check out as a guest.")}`,
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
        upazila: shippingAddress.upazila ?? "",
        locationId: shippingAddress.country === "BD" ? shippingAddress.locationId ?? null : null,
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


      // bKash / Nagad / Rocket / bank paid by hand: send the transaction ID if the customer has one.
      const method = selectedPaymentMethod ?? PaymentMethod.COD;
      const wallet = (paymentFormData as Record<string, { accountNumber?: string; transactionId?: string } | undefined>)[method];
      const bankRef = paymentFormData.bankTransfer?.referenceId?.trim();
      const manualPayment =
        selectedGatewayConfig?.mode !== "manual"
          ? undefined
          : method === PaymentMethod.BANK_TRANSFER
            ? bankRef
              ? { transactionId: bankRef }
              : undefined
            : wallet?.transactionId?.trim()
              ? { transactionId: wallet.transactionId.trim(), senderNumber: wallet.accountNumber?.trim() || undefined }
              : undefined;

      const result = await placeOrder(withKey({
        email: contactEmail.trim() || customerEmail || shippingPayload.email || undefined,
        phone: shippingPayload.phone,
        isGuest: !signedIn,
        subscribeNewsletter,
        shippingAddress: shippingPayload,
        billingAddress: billingPayload,
        billingSameAsShipping,
        shippingMethodId: selectedRate?.methodId,
        deliverySlot: selectedRate?.useSlots && slotPick ? slotPick : undefined,
        courierAccountId: couriers.length && courierPick ? courierPick : undefined,
        shippingProviderId: selectedRate?.providerId,
        shippingCost: shippingAmount,
        paymentGateway: selectedPaymentMethod ?? PaymentMethod.COD,
        payment: manualPayment,
        couponCodes: appliedCoupon?.valid ? [appliedCoupon.couponCode] : [],
        items: [
          ...items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            qty: it.qty,
            price: it.price,
            title: it.title,
            image: it.image,
            variantLabel: it.variantLabel,
            weightKG: it.weightKG,
          })),
          ...boxLines,
        ],
        subtotal,
        shippingTotal: shippingAmount,
        taxTotal: actualTaxTotal,
        discountTotal: couponDiscount + promoDiscount + memberDiscount,
        grandTotal,
        currency: CURRENCY,
        termsAgreed: true,
        useWallet: walletUsed > 0,
        salesCode: salesCode(),
      })).unwrap();

      toast.success(t("Order placed!"), { description: t("Order #{ref} created successfully", { ref: result.orderRef }) });
      clearCart();
      setCompletedStepIds((prev) => [...prev, "information", "shipping", "payment"]);
      setCurrentStepId("confirmation");

      if (result.paymentError) toast.error(t("Payment page not opened"), { description: result.paymentError });
      if (result.redirectPaymentURL) {
        window.location.href = result.redirectPaymentURL;
      } else {
        router.push(`/checkout/thank-you?key=${encodeURIComponent(result.orderKey)}`);
      }
    } catch (err: any) {
      const msg = apiErrorMessage(err, t("Could not place order. Please try again."));
      toast.error(t("Order failed"), { description: msg });
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
        <h1 className="text-2xl font-bold mb-2">{t("Your cart is empty")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("Add some products first, then come back to checkout.")}
        </p>
        <Button size="lg" asChild>
          <Link href="/products">{t("Browse Products")}</Link>
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
                <div className="text-xs md:text-sm font-semibold leading-tight">{t(b.label)}</div>
                <div className="hidden md:block text-[11px] text-muted-foreground leading-tight">
                  {t(b.desc)}
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
                    {t("Section 1: Contact Information")}
                  </CardTitle>
                  <Badge variant={isAuthenticated ? "success" : "secondary"}>
                    {isAuthenticated ? t("Logged in") : t("Guest Checkout")}
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
                          {t("Welcome back, {name}!", { name: customerName ?? t("Valued Customer") })}
                        </div>
                        <div className="text-sm text-green-700/80">{customerEmail}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-dashed">
                        <User className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <span className="text-muted-foreground">{t("Already have an account?")} </span>
                          <Link href="/account/login?next=/checkout" className="font-semibold text-primary hover:underline">
                            {t("Log in")}
                          </Link>
                          <span className="text-muted-foreground"> {t("for a faster checkout experience.")}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("Email Address (optional)")}</Label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className={cn(!contactEmail && "border-muted")}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("For the order confirmation by email. Order updates also come by SMS to your phone.")}
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={subscribeNewsletter}
                          onCheckedChange={setSubscribeNewsletter}
                        />
                        <Label className="text-sm cursor-pointer text-foreground leading-relaxed">
                          {t("Subscribe to our newsletter for exclusive discounts, new arrivals and flash sales.")}
                          <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">
                            {t("Unsubscribe at any time. We respect your privacy.")}
                          </span>
                        </Label>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-primary" />
                            <Label className="font-semibold cursor-pointer">{t("Create an account?")}</Label>
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
                                  {t("Create an account now to track orders, save addresses & earn loyalty points with future purchases.")}
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">{t("Password *")}</Label>
                                  <Input
                                    type="password"
                                    placeholder={t("8+ characters, an uppercase letter and a number")}
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
                    {t("Section 2: Shipping Address")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "firstName", label: msg("First Name *"), placeholder: "John", required: true },
                      { key: "lastName", label: msg("Last Name *"), placeholder: "Doe", required: true },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label>{t(f.label)}</Label>
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
                    <Label>{t("Company (Optional)")}</Label>
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
                      <Label>{t("Country *")}</Label>
                      <select
                        value={shippingAddress.country ?? "BD"}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, country: e.target.value }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="BD">🇧🇩 {t("Bangladesh")}</option>
                        <option value="US">🇺🇸 United States</option>
                        <option value="GB">🇬🇧 United Kingdom</option>
                        <option value="CA">🇨🇦 Canada</option>
                        <option value="AU">🇦🇺 Australia</option>
                        <option value="IN">🇮🇳 India</option>
                      </select>
                    </div>
                  </div>
                  {(shippingAddress.country ?? "BD") === "BD" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <LocationSelects
                        idPrefix="ship"
                        value={shippingAddress}
                        onChange={(v) => setShippingAddress((s) => ({ ...s, ...v }))}
                        renderField={(label, control, id) => (
                          <div className="space-y-1.5">
                            <Label htmlFor={id}>{label}</Label>
                            {control}
                          </div>
                        )}
                      />
                      <div className="space-y-1.5">
                        <Label htmlFor="ship-postcode">{t("Postcode (optional)")}</Label>
                        <Input
                          id="ship-postcode"
                          placeholder={t("e.g. 1205")}
                          value={shippingAddress.postcode ?? ""}
                          onChange={(e) => setShippingAddress((s) => ({ ...s, postcode: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ship-state">{t("State / Region")}</Label>
                        <Input
                          id="ship-state"
                          value={shippingAddress.division ?? ""}
                          onChange={(e) => setShippingAddress((s) => ({ ...s, division: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ship-city">{t("City *")}</Label>
                        <Input
                          id="ship-city"
                          value={shippingAddress.district ?? ""}
                          onChange={(e) => setShippingAddress((s) => ({ ...s, district: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ship-postcode">{t("Postcode / ZIP")}</Label>
                        <Input
                          id="ship-postcode"
                          value={shippingAddress.postcode ?? ""}
                          onChange={(e) => setShippingAddress((s) => ({ ...s, postcode: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>{t("Address Line 1 *")}</Label>
                    <Input
                      placeholder="House #42, Road #11, Banani"
                      value={shippingAddress.addressLine1 ?? ""}
                      onChange={(e) =>
                        setShippingAddress((s) => ({ ...s, addressLine1: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Address Line 2 (Optional)")}</Label>
                    <Input
                      placeholder={t("Apartment, suite, floor, building")}
                      value={shippingAddress.addressLine2 ?? ""}
                      onChange={(e) =>
                        setShippingAddress((s) => ({ ...s, addressLine2: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>{t("Phone Number *")}</Label>
                      <Input
                        placeholder="+8801XXXXXXXXX"
                        value={shippingAddress.phone ?? ""}
                        onChange={(e) =>
                          setShippingAddress((s) => ({ ...s, phone: e.target.value }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t("Rider will call this number for delivery coordination")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("Email")}</Label>
                      <Input
                        type="email"
                        placeholder={t("Contact email (same as above if filled)")}
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
                        {t("Billing address same as shipping")}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("Uncheck if billing differs (for corporate/invoice orders)")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    {t("Section 3: Shipping Method")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {ratesLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : shippingQueryArgs.countryCode === "BD" && !shippingQueryArgs.district ? (
                    <div className="p-6 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                      <MapPin className="h-6 w-6 mx-auto mb-2" />
                      {t("Pick your division and district above to see delivery options and prices.")}
                    </div>
                  ) : rates.length === 0 ? (
                    <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-center">
                      <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="font-semibold text-amber-800 mb-1">
                        {ratesError
                          ? t("We couldn't load delivery options")
                          : t("Sorry, no carriers available for your location")}
                      </p>
                      <p className="text-sm text-amber-700/80">
                        {ratesError
                          ? t("Check the division and district, then try again.")
                          : t("Please contact support or try a different shipping address.")}
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
                                      <Tag className="h-3 w-3" /> {t("Cheapest")}
                                    </Badge>
                                  )}
                                  {isFastest && !isCheapest && (
                                    <Badge variant="default" className="text-[10px] px-2 py-0.5 gap-1">
                                      <Zap className="h-3 w-3" /> {t("Fastest")}
                                    </Badge>
                                  )}
                                  {rateIsFree && (
                                    <Badge variant="success" className="text-[10px] px-2 py-0.5 gap-1">
                                      {t("FREE")}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>
                                    {t("Estimated:")} {rate.estimatedLabel ?? t("{min}-{max} days", { min: rate.minDeliveryDays ?? 1, max: rate.maxDeliveryDays ?? 5 })}
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
                                  {rateIsFree ? t("FREE") : formatBDT(rate.cost)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedRate?.useSlots && (
                    <DeliveryTimePicker days={slotDays} value={pickedSlot ? slotPick : null} onChange={setSlotPick} />
                  )}
                  {couriers.length > 0 && <CourierPicker couriers={couriers} value={courierPick} onChange={setCourierPick} />}
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">{t("VAT / Tax Breakdown")}</h4>
                      </div>
                      {taxLoading && <Skeleton className="h-5 w-20 rounded" />}
                    </div>
                    <div className="rounded-xl border bg-muted/20 overflow-hidden">
                      <div className="divide-y">
                        {actualTaxLines.map((line, i) => (
                          <div key={i} className="flex justify-between items-center px-4 py-2.5 text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              {t(line.name)}
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
                          <span>{taxIncluded ? t("VAT included in prices") : t("Total Tax")}</span>
                          <span className="text-primary">{formatBDT(actualTaxTotal)}</span>
                        </div>
                      </div>
                    </div>
                    {taxIncluded && actualTaxTotal > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("Prices already include VAT, so nothing is added to your total.")}
                      </p>
                    )}
                    {(shippingAddress.country ?? "BD") !== "BD" && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {t("International orders may be subject to export-exempt Zero rate VAT and customs duties at destination.")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {t("Section 4: Payment Method")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isAuthenticated && walletBalance > 0 && (
                    <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-primary"
                        checked={payFromWallet}
                        onChange={(e) => setPayFromWallet(e.target.checked)}
                      />
                      <span className="text-sm">
                        <span className="font-medium">{t("Pay from my wallet")}</span>{" "}
                        <span className="text-muted-foreground">({t("{amount} available", { amount: formatBDT(walletBalance) })})</span>
                        {payFromWallet && (
                          <span className="block text-xs text-muted-foreground">
                            {t("{amount} from your wallet", { amount: formatBDT(walletUsed) })}
                            {grandTotal > 0 ? t(", {amount} by the method below", { amount: formatBDT(grandTotal) }) : t(". Nothing more to pay")}
                            {(loyalty?.wallet.maxPercent ?? 100) < 100 ? t(" (the wallet can pay up to {percent}% of an order)", { percent: loyalty!.wallet.maxPercent }) : ""}{t(".")}
                          </span>
                        )}
                      </span>
                    </label>
                  )}
                  <PaymentMethodList
                    gateways={paymentGateways}
                    selectedMethod={selectedPaymentMethod}
                    onSelect={setSelectedPaymentMethod}
                    formData={paymentFormData}
                    onFormDataChange={setPaymentFormData}
                    currency={CURRENCY}
                    amount={grandTotal}
                  />
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-between gap-3 lg:hidden">
                <Button variant="outline" size="lg" asChild>
                  <Link href="/cart">← {t("Back to Cart")}</Link>
                </Button>
                <Button size="lg" onClick={handlePlaceOrder} disabled={placingOrder || cartHasProblems} className="h-12">
                  {placingOrder ? t("Placing Order...") : `${t("Place Order")} • ${formatBDT(grandTotal)}`}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="space-y-4">
          {cartHasProblems && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertCircle className="h-4 w-4" /> {t("Some items can't be ordered")}
              </div>
              <ul className="mt-2 space-y-1 text-destructive/90">
                {Object.values(cartProblems).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href="/cart" className="mt-2 inline-block font-medium underline">
                {t("Update your cart")}
              </Link>
            </div>
          )}
          <CartPromotionSummary promotions={promotions} className="mb-4" />
          <PromoSlotStrip slot="checkout" className="mb-4" />
          {!appliedCoupon?.valid && availableCoupons.length > 0 && (
            <div className="mb-4 rounded-xl border p-4">
              <p className="mb-2 text-sm font-semibold">{t("Coupons you can use")}</p>
              <ul className="space-y-2">
                {availableCoupons.slice(0, 5).map((c) => (
                  <li key={c.code} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-mono font-semibold">{c.code}</span>
                      {c.forYou && <span className="ml-2 rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary">{t("For you")}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {c.summary}
                        {c.minSubtotal ? ` ${t("on orders over {amount}", { amount: formatBDT(c.minSubtotal) })}` : ""}
                        {c.worksWithPromotions ? "" : ` · ${t("not with other offers")}`}
                      </span>
                    </span>
                    <Button type="button" size="sm" variant="outline" disabled={applyingCoupon} onClick={() => void applyCode(c.code)}>
                      {t("Apply")}
                    </Button>
                  </li>
                ))}
              </ul>
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
            taxIncluded={taxIncluded}
            taxLoading={taxLoading}
            discounts={discountsArr}
            customLines={
              gatewayFee > 0
                ? [
                    {
                      id: "gateway-fee",
                      label: t("{method} fee", { method: selectedGatewayConfig?.name ?? t("Payment") }),
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
            placeOrderLabel={`${t("Place Order")} • ${formatBDT(grandTotal)}`}
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
