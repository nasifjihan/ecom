"use client";

import * as React from "react";
import {
  ShoppingBag,
  ArrowRight,
  Truck,
  Tag,
  ShieldCheck,
  Gift,
  Loader2,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Separator,
  Checkbox,
  Label,
  Skeleton,
  useCart,
  CartItem,
} from "@ecom/storefront-base";
import { cn, formatMoney } from "@ecom/utils";
import { CouponApplyInput, CouponAppliedState } from "./CouponApplyInput";
import { useT } from "../../i18n/provider";
import { GiftBoxCartCard } from "../cart/GiftBoxCartCard";
import { useCart as useCartBoxes } from "../cart/CartProvider";

export type OrderSummaryLineItem = {
  id: string;
  label: string;
  amount: number;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "success" | "destructive";
  isDiscount?: boolean;
  isTax?: boolean;
  bold?: boolean;
  color?: string;
};

export type OrderSummaryCardProps = {
  subtotal: number;
  shippingAmount?: number;
  shippingLabel?: string;
  shippingFree?: boolean;
  shippingLoading?: boolean;
  taxAmount?: number;
  taxLines?: { name: string; amount: number; rate?: number }[];
  taxLoading?: boolean;
  /** Prices already include VAT: the tax is shown as part of the total, not added to it. */
  taxIncluded?: boolean;
  discounts?: OrderSummaryLineItem[];
  couponCode: string;
  onCouponCodeChange: (code: string) => void;
  onApplyCoupon: (e: React.FormEvent) => void | Promise<void>;
  onRemoveCoupon?: () => void;
  appliedCoupon?: CouponAppliedState | null;
  applyingCoupon?: boolean;
  couponError?: string | null;
  customLines?: OrderSummaryLineItem[];
  grandTotal: number;
  placeOrderDisabled?: boolean;
  placeOrderLoading?: boolean;
  placeOrderLabel?: string;
  onPlaceOrder?: () => void;
  termsChecked?: boolean;
  onTermsToggle?: (checked: boolean) => void;
  termsUrl?: string;
  privacyUrl?: string;
  items?: CartItem[];
  itemCount?: number;
  currency?: string;
  freeShippingFrom?: number;
  showItemsPreview?: boolean;
  sticky?: boolean;
  className?: string;
};

export function OrderSummaryCard({
  subtotal,
  shippingAmount,
  shippingLabel,
  shippingFree = false,
  shippingLoading = false,
  taxAmount = 0,
  taxLines = [],
  taxLoading = false,
  taxIncluded = false,
  discounts = [],
  couponCode,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  appliedCoupon = null,
  applyingCoupon = false,
  couponError = null,
  customLines = [],
  grandTotal,
  placeOrderDisabled = false,
  placeOrderLoading = false,
  placeOrderLabel,
  onPlaceOrder,
  termsChecked = false,
  onTermsToggle,
  termsUrl = "/terms-of-service",
  privacyUrl = "/privacy-policy",
  items,
  itemCount,
  currency = "BDT",
  freeShippingFrom = 1000,
  showItemsPreview = true,
  sticky = true,
  className,
}: OrderSummaryCardProps) {
  const cart = useCart();
  const { boxes } = useCartBoxes();
  const t = useT();
  const displayItems = items ?? cart.items;
  const displayItemCount = itemCount ?? cart.itemCount;

  const totalDiscount = discounts.reduce((sum, d) => sum + (d.isDiscount ? d.amount : 0), 0);

  const progressTowardFreeShipping = React.useMemo(
    () => Math.min(100, Math.max(0, (subtotal / (freeShippingFrom || 1000)) * 100)),
    [subtotal, freeShippingFrom],
  );
  const shippingDelta = Math.max(0, (freeShippingFrom || 0) - subtotal);

  return (
    <Card
      className={cn(
        "shadow-soft border",
        sticky && "lg:sticky lg:top-24",
        className,
      )}
    >
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          {t("Order Summary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {showItemsPreview && displayItems.length > 0 && (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {displayItems.slice(0, 5).map((item) => {
              const lineTotal = Math.round(item.price * item.qty * 100) / 100;
              return (
                <div
                  key={`${item.productId}-${item.variantId ?? "none"}`}
                  className="flex gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-100 border flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
                      {item.qty}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-xs font-medium leading-tight line-clamp-2">
                      {item.title}
                    </p>
                    {item.variantLabel && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.variantLabel}
                      </p>
                    )}
                  </div>
                  <div className="text-right py-0.5 flex-shrink-0">
                    <span className="text-xs font-semibold">{formatMoney(lineTotal, currency)}</span>
                  </div>
                </div>
              );
            })}
            {displayItems.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                {t("+{n} more items", { n: displayItems.length - 5 })}
              </p>
            )}
          </div>
        )}
        {showItemsPreview && !items && boxes.length > 0 && (
          <div className="space-y-2">
            {boxes.map((b) => (
              <GiftBoxCartCard key={b.key} box={b} currency={currency} compact />
            ))}
          </div>
        )}

        {subtotal > 0 && shippingDelta > 0 && (freeShippingFrom ?? 0) > 0 && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-start gap-2 mb-2">
              <Gift className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {t("Add {amount} more for FREE Delivery!", { amount: formatMoney(shippingDelta, currency) })}
              </p>
            </div>
            <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${progressTowardFreeShipping}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              {t("Subtotal")}
              <Badge variant="secondary" className="text-[10px] px-1.5">
                {displayItemCount === 1 ? t("1 item") : t("{n} items", { n: displayItemCount })}
              </Badge>
            </span>
            <span className="font-medium">{formatMoney(subtotal, currency)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              <Truck className="h-3.5 w-3.5" />
              {t("Shipping")}
              {shippingFree && (
                <Badge variant="success" className="text-[10px] px-1.5">{t("FREE")}</Badge>
              )}
            </span>
            {shippingLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <span
                className={cn(
                  "font-medium",
                  shippingFree && subtotal > 0 && "text-green-600",
                )}
              >
                {subtotal === 0
                  ? "—"
                  : shippingFree && subtotal > 0
                    ? formatMoney(0, currency)
                    : shippingAmount !== undefined
                      ? formatMoney(shippingAmount, currency)
                      : t("Calculating...")}
              </span>
            )}
          </div>

          {shippingLabel && !shippingLoading && shippingAmount !== undefined && shippingAmount > 0 && (
            <p className="text-[11px] text-muted-foreground pl-5">
              {shippingLabel ?? t("Standard Shipping")}
            </p>
          )}

          {taxLoading ? (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("Taxes & Fees")}</span>
              <Skeleton className="h-5 w-20" />
            </div>
          ) : taxIncluded ? null : taxLines.length > 0 ? (
            <div className="space-y-1.5">
              {taxLines.map((line, i) => (
                <div key={i} className="flex justify-between items-center pl-0">
                  <span className="text-muted-foreground text-xs pl-5">
                    {t(line.name)}
                    {line.rate !== undefined && <span className="text-[10px] ml-1">({(line.rate * 100).toFixed(0)}%)</span>}
                  </span>
                  <span className="font-medium text-xs">{formatMoney(line.amount, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1 border-t border-dashed">
                <span className="text-muted-foreground text-xs flex items-center gap-1">
                  <Info className="h-3 w-3" /> {t("Total Tax")}
                </span>
                <span className="font-semibold text-xs">{formatMoney(taxAmount, currency)}</span>
              </div>
            </div>
          ) : (
            taxAmount > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground flex flex-col">
                  <span>{t("VAT / Tax")}</span>
                </span>
                <span className="font-medium">{formatMoney(taxAmount, currency)}</span>
              </div>
            )
          )}

          {discounts.map((d, i) => (
            <div key={i} className="flex justify-between items-center pt-1">
              <span className={cn("flex items-center gap-2", d.color)}>
                {d.isDiscount && <Tag className="h-3.5 w-3.5" />}
                {d.label}
                {d.badge && (
                  <Badge variant={d.badgeVariant ?? "secondary"} className="text-[10px] px-1.5">
                    {d.badge}
                  </Badge>
                )}
              </span>
              <span
                className={cn(
                  d.isDiscount && "text-green-600",
                  d.bold && "font-bold",
                  !d.bold && "font-medium",
                )}
              >
                {d.isDiscount && "-"}
                {formatMoney(d.amount, currency)}
              </span>
            </div>
          ))}

          {customLines.map((line, i) => (
            <div key={`custom-${i}`} className="flex justify-between items-center pt-1">
              <span className={cn(line.color ?? "text-muted-foreground")}>
                {line.label}
                {line.badge && (
                  <Badge variant={line.badgeVariant ?? "secondary"} className="text-[10px] px-1.5 ml-2">
                    {line.badge}
                  </Badge>
                )}
              </span>
              <span className={cn(line.bold && "font-bold", !line.bold && "font-medium")}>
                {line.isDiscount && "-"}
                {formatMoney(line.amount, currency)}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        <CouponApplyInput
          couponCode={couponCode}
          onCouponCodeChange={onCouponCodeChange}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
          applied={appliedCoupon}
          applying={applyingCoupon}
          error={couponError}
          currency={currency}
        />

        <Separator />

        <div className="bg-muted/30 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-sm">{t("Grand Total")}</span>
            <div className="text-right">
              <div className="text-2xl font-black text-primary tracking-tight">
                {formatMoney(grandTotal, currency)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {taxIncluded && taxAmount > 0
                  ? t("Includes VAT {amount}", { amount: formatMoney(taxAmount, currency) })
                  : t("Incl. all taxes & fees")}
              </div>
            </div>
          </div>
          {totalDiscount > 0 && (
            <div className="text-xs text-green-600 font-semibold flex items-center gap-1 pt-1">
              <Gift className="h-3.5 w-3.5" />
              {t("You're saving {amount} today!", { amount: formatMoney(totalDiscount, currency) })}
            </div>
          )}
        </div>

        {onTermsToggle !== undefined && (
          <div className="flex items-start gap-3">
            <Checkbox
              checked={termsChecked}
              onCheckedChange={onTermsToggle}
            />
            <Label className="text-xs leading-relaxed cursor-pointer text-muted-foreground">
              {t("I have read and agree to the")}{" "}
              <a href={termsUrl} className="text-primary hover:underline font-medium">
                {t("Terms & Conditions")}
              </a>{" "}
              {t("and")}{" "}
              <a href={privacyUrl} className="text-primary hover:underline font-medium">
                {t("Privacy Policy")}
              </a>
              {t(".")}
            </Label>
          </div>
        )}

        <div className="space-y-2.5">
          <Button
            size="lg"
            className="w-full h-12 text-base shadow-hover relative"
            disabled={placeOrderDisabled || placeOrderLoading}
            onClick={onPlaceOrder}
          >
            {placeOrderLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {t("Processing...")}
              </>
            ) : (
              <>
                {placeOrderLabel ?? t("Place Order")}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
            <Truck className="h-5 w-5 text-primary mb-1" />
            <span className="text-[10px] font-semibold">{t("Fast Ship")}</span>
            <span className="text-[9px] text-muted-foreground">{t("24-72hrs")}</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
            <ShieldCheck className="h-5 w-5 text-primary mb-1" />
            <span className="text-[10px] font-semibold">{t("100% Secure")}</span>
            <span className="text-[9px] text-muted-foreground">{t("SSL Encrypted")}</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
            <Gift className="h-5 w-5 text-primary mb-1" />
            <span className="text-[10px] font-semibold">{t("7 Days")}</span>
            <span className="text-[9px] text-muted-foreground">{t("Easy Returns")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default OrderSummaryCard;
