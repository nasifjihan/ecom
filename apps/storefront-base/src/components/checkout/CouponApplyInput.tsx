"use client";

import * as React from "react";
import { Tag, X, Check, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  cn,
  formatMoney,
} from "@ecom/storefront-base";
import { useT } from "../../i18n/provider";

export type CouponAppliedState = {
  valid: boolean;
  couponCode: string;
  discountAmount: number;
  discountType?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING" | "BOGO";
  freeShipping?: boolean;
  message?: string;
  newCartTotal?: number;
  newSubtotal?: number;
  errorMessage?: string;
};

export type CouponApplyInputProps = {
  couponCode: string;
  onCouponCodeChange: (code: string) => void;
  onApply: (e: React.FormEvent) => void | Promise<void>;
  onRemove?: () => void;
  applied?: CouponAppliedState | null;
  applying?: boolean;
  error?: string | null;
  currency?: string;
  inputClassName?: string;
  buttonClassName?: string;
  className?: string;
};

export function CouponApplyInput({
  couponCode,
  onCouponCodeChange,
  onApply,
  onRemove,
  applied = null,
  applying = false,
  error = null,
  currency = "BDT",
  inputClassName,
  buttonClassName,
  className,
}: CouponApplyInputProps) {
  const isApplied = applied?.valid === true && applied.couponCode.length > 0;
  const t = useT();
  const hasError = Boolean(error || applied?.errorMessage);
  const errorMsg = error || applied?.errorMessage;

  return (
    <div className={cn("space-y-2 w-full", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5" />
        {t("Promo / Coupon Code")}
      </Label>

      {isApplied ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
          <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
            <Check className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <span className="uppercase tracking-wide">{applied.couponCode}</span>
              {applied.discountType === "PERCENTAGE" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  {t("Percentage")}
                </span>
              )}
              {applied.discountType === "FIXED" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  {t("Fixed")}
                </span>
              )}
              {applied.freeShipping && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  {t("Free Shipping")}
                </span>
              )}
            </div>
            <div className="text-xs text-green-700 mt-0.5">
              {applied.discountAmount > 0 && (
                <span className="font-semibold">-{formatMoney(applied.discountAmount, currency)}</span>
              )}
              {applied.message && ` • ${applied.message}`}
            </div>
          </div>
          {onRemove && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="h-8 w-8 rounded-full text-green-700 hover:bg-green-100 hover:text-red-600 flex-shrink-0"
              aria-label={t("Remove coupon")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <Form onSubmit={onApply}>
          <div className="flex flex-col sm:flex-row gap-2">
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  placeholder={t("Enter coupon code")}
                  value={couponCode}
                  onChange={(e) => onCouponCodeChange(e.target.value)}
                  disabled={applying}
                  className={cn(
                    "uppercase tracking-wider",
                    hasError && "border-destructive focus-visible:ring-destructive",
                    inputClassName,
                  )}
                />
              </FormControl>
            </FormItem>
            <Button
              type="submit"
              disabled={applying || !couponCode.trim()}
              variant={hasError ? "outline" : "default"}
              className={cn(
                "min-w-[90px]",
                hasError && "text-destructive border-destructive hover:bg-destructive/10",
                buttonClassName,
              )}
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Applying")}
                </>
              ) : (
                t("Apply")
              )}
            </Button>
          </div>
        </Form>
      )}

      {hasError && errorMsg && !isApplied && (
        <p className="text-xs text-destructive flex items-start gap-1.5 px-1">
          <span className="mt-0.5">⚠️</span>
          {errorMsg}
        </p>
      )}

      {!isApplied && !hasError && (
        <p className="text-[11px] text-muted-foreground px-1">
          💡 {t("Have a promo code? Enter it above to unlock exclusive discounts.")}
        </p>
      )}
    </div>
  );
}

export default CouponApplyInput;
