"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  ScrollArea,
  Separator,
  Skeleton,
} from "../ui";
import { useCart, type CartItem } from "./CartProvider";
import { cn, formatMoney, moneyMul } from "@ecom/utils";

export type CartDrawerProps = {
  storeName?: string;
  currency?: string;
  onProceedToCheckout?: () => void;
  className?: string;
};

function CartItemRow({
  item,
  currency,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem;
  currency: string;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const lineTotal = moneyMul(item.price, item.qty);
  return (
    <div className="flex gap-3 py-4">
      <Link
        href={`/products/${item.slug}`}
        className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border"
      >
        <img src={item.image} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${item.slug}`} className="block">
              <h4 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">{item.title}</h4>
            </Link>
            {item.variantLabel && <p className="text-xs text-muted-foreground mt-0.5">{item.variantLabel}</p>}
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors flex-shrink-0"
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center border rounded-md">
            <button
              onClick={() => onUpdateQty(item.qty - 1)}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-l-md transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="h-8 min-w-[2.5rem] flex items-center justify-center text-sm font-medium border-x px-2">
              {item.qty}
            </span>
            <button
              onClick={() => onUpdateQty(item.qty + 1)}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-r-md transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-right">
            <span className="font-bold">{formatMoney(lineTotal, currency)}</span>
            <div className="text-[11px] text-muted-foreground">
              {formatMoney(item.price, currency)} each
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemRowSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-auto flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export function CartDrawer({
  storeName = "Fashion BD",
  currency = "BDT",
  onProceedToCheckout,
  className,
}: CartDrawerProps) {
  const {
    isOpen,
    closeCart,
    items,
    subtotal,
    itemCount,
    updateQty,
    removeItem,
  } = useCart();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const defaultGoToCheckout = React.useCallback(() => {
    window.location.href = "/checkout";
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={(o: boolean) => !o && closeCart()}>
      <SheetContent className={cn("w-full sm:max-w-md", className)}>
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Your Cart {itemCount > 0 && <span className="text-sm font-normal text-muted-foreground">({itemCount} items)</span>}
              </SheetTitle>
              <SheetDescription className="sr-only">Review your {storeName} cart before checkout.</SheetDescription>
            </div>
            <button
              onClick={closeCart}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ShoppingCart className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Your cart is empty</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Looks like you haven't added anything yet. Start shopping to fill your cart!
            </p>
            <Button onClick={closeCart} asChild>
              <Link href="/products">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Start Shopping
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6 my-2">
              <div>
                {!mounted
                  ? Array.from({ length: 3 }).map((_, i) => <CartItemRowSkeleton key={i} />)
                  : items.map((item, idx) => (
                      <React.Fragment key={`${item.productId}-${item.variantId ?? "none"}`}>
                        <CartItemRow
                          item={item}
                          currency={currency}
                          onUpdateQty={(q) => {
                            if (q <= 0) {
                              removeItem(item.productId, item.variantId);
                            } else {
                              updateQty(item.productId, item.variantId, q);
                            }
                          }}
                          onRemove={() => removeItem(item.productId, item.variantId)}
                        />
                        {idx < items.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
              </div>
            </ScrollArea>

            <div className="mt-auto pt-4 space-y-4">
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                  <span className="font-medium">{formatMoney(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium text-muted-foreground">Calculated at checkout</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-bold text-base">
                  <span>Total</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
              </div>

              <SheetFooter className="!flex-row space-y-0 gap-2">
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/cart" onClick={closeCart}>
                    View Cart
                  </Link>
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    closeCart();
                    (onProceedToCheckout ?? defaultGoToCheckout)();
                  }}
                >
                  Proceed to Checkout
                  <Trash2 className="hidden" />
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default CartDrawer;
