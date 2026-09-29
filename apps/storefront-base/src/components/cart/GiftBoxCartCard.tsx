"use client";

/** A gift box in the cart: the box and its style, what's in it, the card message and its price. */
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Gift, MessageSquareQuote, Trash2 } from "lucide-react";
import { cn, formatMoney } from "@ecom/utils";
import { useT } from "../../i18n/provider";
import { boxTotal, type CartBox } from "./CartProvider";

export interface GiftBoxCartCardProps {
  box: CartBox;
  currency?: string;
  onRemove?: () => void;
  /** What stops the box being bought (something in it sold out, say). */
  problem?: string;
  /** Smaller, for order summaries. */
  compact?: boolean;
  className?: string;
}

export function GiftBoxCartCard({ box, currency = "BDT", onRemove, problem, compact, className }: GiftBoxCartCardProps) {
  const t = useT();
  const count = box.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className={cn("rounded-lg border", problem ? "border-destructive/40 bg-destructive/5" : "border-primary/20 bg-primary/5", compact ? "p-3" : "p-4", className)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", compact ? "h-9 w-9" : "h-12 w-12")}>
          <Gift className={compact ? "h-4 w-4" : "h-6 w-6"} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/gift-boxes/${box.slug}`} className="font-medium hover:underline">
                {box.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {t("{n} items", { n: count })}
                {box.box.variantLabel ? ` · ${box.box.variantLabel}` : ""}
              </p>
            </div>
            <span className="shrink-0 font-semibold">{formatMoney(boxTotal(box), currency)}</span>
          </div>
          <ul className={cn("mt-2 space-y-0.5 text-sm", compact && "text-xs")}>
            <li className="flex justify-between gap-2 text-muted-foreground">
              <span className="truncate">{t("Box")}: {box.box.title}</span>
              <span>{formatMoney(box.box.price, currency)}</span>
            </li>
            {box.items.map((i) => (
              <li key={`${i.productId}:${i.variantId ?? ""}`} className="flex justify-between gap-2">
                <span className="truncate">
                  {i.qty} × {i.title}
                  {i.variantLabel ? ` (${i.variantLabel})` : ""}
                </span>
                <span className="text-muted-foreground">{formatMoney(i.price * i.qty, currency)}</span>
              </li>
            ))}
          </ul>
          {box.message && (
            <p className="mt-2 flex items-start gap-1.5 text-sm italic text-muted-foreground">
              <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> “{box.message}”
            </p>
          )}
          {problem && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {problem}
            </p>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t("Remove box")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GiftBoxCartCard;
