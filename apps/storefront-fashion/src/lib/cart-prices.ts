"use client";

/**
 * Keeps the saved cart on current prices. The cart lives in the browser, so a flash sale can start
 * or end (or a price change) after an item was added. The cart and checkout pages ask the API for
 * the prices checkout will charge, update the cart, and say which lines changed or can't be bought.
 */
import * as React from "react";
import { api } from "@ecom/api-client";
import { formatMoney, toast, useCart, type CartPriceQuote } from "@ecom/storefront-base";

type CartPriceLine = Omit<CartPriceQuote, "price"> & {
  price: number | null;
  qty: number;
  flashSale: { name: string; slug: string; endsAt: string; remaining: number | null } | null;
  problem: string | null;
};

const cartPricesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    cartPrices: builder.mutation<
      { items: CartPriceLine[] },
      { items: Array<{ productId: string; variantId?: string; qty: number }> }
    >({
      query: (body) => ({ url: "/storefront/checkout/cart/prices", method: "POST", body }),
    }),
  }),
  overrideExisting: false,
});

export const { useCartPricesMutation } = cartPricesApi;

export const cartLineKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ""}`;

/**
 * Checks the cart against the server whenever its lines or quantities change.
 * `problems` maps a line key to what stops it being bought (out of stock, gone, too few left).
 */
export function useCartPriceCheck() {
  const { items, syncPrices } = useCart();
  const [check] = useCartPricesMutation();
  const [problems, setProblems] = React.useState<Record<string, string>>({});
  const [checking, setChecking] = React.useState(false);
  const [round, setRound] = React.useState(0);

  const key = items.map((i) => `${cartLineKey(i.productId, i.variantId)}x${i.qty}`).join("|");
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  React.useEffect(() => {
    const lines = itemsRef.current.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }));
    if (!lines.length) {
      setProblems({});
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await check({ items: lines }).unwrap();
        if (cancelled) return;
        const changes = syncPrices(
          res.items.filter((l): l is CartPriceLine & { price: number } => l.price !== null),
        );
        setProblems(
          Object.fromEntries(
            res.items.filter((l) => l.problem).map((l) => [cartLineKey(l.productId, l.variantId), l.problem as string]),
          ),
        );
        if (changes.length) {
          const first = changes[0]!;
          toast.info(changes.length === 1 ? "A price in your cart changed" : "Prices in your cart changed", {
            description:
              changes.length === 1
                ? `${first.item.title} is now ${formatMoney(first.newPrice, "BDT")} (was ${formatMoney(first.oldPrice, "BDT")}).`
                : `${changes.length} items now have new prices. Your totals are up to date.`,
          });
        }
      } catch {
        // Offline or API down: keep the saved prices; checkout re-prices on the server anyway.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, round, check, syncPrices]);

  const recheck = React.useCallback(() => setRound((r) => r + 1), []);
  return { problems, hasProblems: Object.keys(problems).length > 0, checking, recheck };
}
