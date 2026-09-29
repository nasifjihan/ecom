"use client";

import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@ecom/utils";
import { useT } from "../../i18n/provider";
import { msg } from "../../i18n/translate";

export type CheckoutStep = {
  id: string;
  label: string;
  description?: string;
};

export const DEFAULT_CHECKOUT_STEPS: CheckoutStep[] = [
  { id: "cart", label: msg("Cart"), description: msg("Review items") },
  { id: "information", label: msg("Information"), description: msg("Contact details") },
  { id: "shipping", label: msg("Shipping"), description: msg("Delivery method") },
  { id: "payment", label: msg("Payment"), description: msg("Payment method") },
  { id: "confirmation", label: msg("Confirmation"), description: msg("Order complete") },
];

export type CheckoutStepperProps = {
  steps?: CheckoutStep[];
  currentStepId: string;
  completedStepIds?: string[];
  onStepClick?: (stepId: string) => void;
  className?: string;
};

export function CheckoutStepper({
  steps = DEFAULT_CHECKOUT_STEPS,
  currentStepId,
  completedStepIds = [],
  onStepClick,
  className,
}: CheckoutStepperProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  const t = useT();

  return (
    <div className={cn("w-full", className)}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = completedStepIds.includes(step.id) || idx < currentIdx;
          const isCurrent = step.id === currentStepId;
          const isClickable = onStepClick && (isCompleted || idx <= currentIdx);

          return (
            <React.Fragment key={step.id}>
              <li className="flex flex-col items-center flex-shrink-0">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  className={cn(
                    "relative group flex items-center justify-center",
                    isClickable && "cursor-pointer",
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-sm md:text-base transition-all border-2",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && !isCompleted && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                      !isCompleted && !isCurrent && "bg-muted border-muted text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className={cn(
                        "text-xs md:text-sm font-semibold whitespace-nowrap",
                        isCurrent && "text-primary",
                        isCompleted && !isCurrent && "text-foreground",
                        !isCompleted && !isCurrent && "text-muted-foreground",
                      )}
                    >
                      {t(step.label)}
                    </div>
                    {step.description && (
                      <div className="hidden md:block text-[11px] text-muted-foreground mt-0.5 max-w-[120px]">
                        {t(step.description)}
                      </div>
                    )}
                  </div>
                </button>
              </li>
              {idx < steps.length - 1 && (
                <li className="flex-1 mx-1 md:mx-2">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      idx < currentIdx || isCompleted ? "bg-primary" : "bg-muted",
                    )}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

export default CheckoutStepper;
