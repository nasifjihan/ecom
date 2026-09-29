"use client";

import * as React from "react";
import { moneyAdd, moneyMul, cn } from "@ecom/utils";

export type CartItem = {
  productId: string;
  variantId?: string;
  title: string;
  slug: string;
  image: string;
  price: number;
  qty: number;
  weightKG?: number;
  variantLabel?: string;
  /** Regular price when the item is discounted. */
  compareAtPrice?: number | null;
  /** The running flash sale that sets `price`, if any. */
  flashSale?: { name: string; endsAt: string } | null;
  /** A bulk price the line's quantity reaches ("10+"), if it sets `price`. */
  bulk?: { minQty: number; business: boolean } | null;
};

/** The server's current price for a cart line (see syncPrices). */
export type CartPriceQuote = {
  productId: string;
  variantId?: string | null;
  price: number;
  compareAtPrice?: number | null;
  flashSale?: { name: string; endsAt: string } | null;
  bulk?: { minQty: number; business: boolean } | null;
};

export type CartPriceChange = { item: CartItem; oldPrice: number; newPrice: number };

export type CartState = {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  totalWeightKG: number;
};

type CartContextValue = CartState & {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  updateQty: (productId: string, variantId: string | undefined, qty: number) => void;
  removeItem: (productId: string, variantId: string | undefined) => void;
  clearCart: () => void;
  hasItem: (productId: string, variantId?: string) => boolean;
  /** Applies current server prices to the cart and returns the lines whose price changed. */
  syncPrices: (quotes: CartPriceQuote[]) => CartPriceChange[];
};

const CartContext = React.createContext<CartContextValue | null>(null);

const CART_STORAGE_PREFIX = "cart_";
const DEFAULT_STORE_ID = "default";

const lineKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ""}`;

function deriveState(items: CartItem[]): CartState {
  let subtotal = 0;
  let itemCount = 0;
  let totalWeightKG = 0;
  for (const it of items) {
    subtotal = moneyAdd(subtotal, moneyMul(it.price, it.qty));
    itemCount += it.qty;
    totalWeightKG += (it.weightKG ?? 0) * it.qty;
  }
  return { items, subtotal, itemCount, totalWeightKG };
}

function loadCartFromStorage(storeId: string): CartItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(`${CART_STORAGE_PREFIX}${storeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveCartToStorage(storeId: string, items: CartItem[]) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${CART_STORAGE_PREFIX}${storeId}`, JSON.stringify(items));
  } catch {
    /* storage disabled — ignore */
  }
}

export type CartProviderProps = {
  children: React.ReactNode;
  storeId?: string;
  initialItems?: CartItem[];
};

export function CartProvider({ children, storeId = DEFAULT_STORE_ID, initialItems }: CartProviderProps) {
  const [items, setItems] = React.useState<CartItem[]>(() => initialItems ?? []);
  const [isOpen, setIsOpen] = React.useState(false);
  const storeIdRef = React.useRef(storeId);

  React.useEffect(() => {
    storeIdRef.current = storeId;
  }, [storeId]);

  React.useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
      return;
    }
    const loaded = loadCartFromStorage(storeIdRef.current);
    if (loaded.length > 0) setItems(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    saveCartToStorage(storeIdRef.current, items);
  }, [items]);

  const derived = React.useMemo(() => deriveState(items), [items]);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const syncPrices: CartContextValue["syncPrices"] = React.useCallback((quotes) => {
    const byKey = new Map(quotes.map((q) => [lineKey(q.productId, q.variantId), q]));
    const changes: CartPriceChange[] = [];
    for (const it of itemsRef.current) {
      const q = byKey.get(lineKey(it.productId, it.variantId));
      // A bulk price starting or stopping because the quantity changed isn't news to the shopper.
      const bulkMoved = (it.bulk?.minQty ?? null) !== (q?.bulk?.minQty ?? null);
      if (q && q.price !== it.price && !bulkMoved) changes.push({ item: it, oldPrice: it.price, newPrice: q.price });
    }
    setItems((prev) => {
      let touched = false;
      const next = prev.map((it) => {
        const q = byKey.get(lineKey(it.productId, it.variantId));
        if (!q) return it;
        const flashSale = q.flashSale ? { name: q.flashSale.name, endsAt: q.flashSale.endsAt } : null;
        const bulk = q.bulk ? { minQty: q.bulk.minQty, business: q.bulk.business } : null;
        const same =
          (it.bulk?.minQty ?? null) === (bulk?.minQty ?? null) &&
          (it.bulk?.business ?? null) === (bulk?.business ?? null) &&
          it.price === q.price &&
          (it.compareAtPrice ?? null) === (q.compareAtPrice ?? null) &&
          (it.flashSale?.name ?? null) === (flashSale?.name ?? null) &&
          (it.flashSale?.endsAt ?? null) === (flashSale?.endsAt ?? null);
        if (same) return it;
        touched = true;
        return { ...it, price: q.price, compareAtPrice: q.compareAtPrice ?? null, flashSale, bulk };
      });
      return touched ? next : prev;
    });
    return changes;
  }, []);

  const addItem: CartContextValue["addItem"] = React.useCallback((raw) => {
    const incoming: CartItem = { qty: 1, weightKG: 0, ...raw };
    setItems((prev) => {
      const idx = prev.findIndex(
        (it) => it.productId === incoming.productId && (it.variantId ?? "__none__") === (incoming.variantId ?? "__none__"),
      );
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx]!;
        next[idx] = { ...existing, qty: existing.qty + incoming.qty };
        return next;
      }
      return [...prev, incoming];
    });
    setIsOpen(true);
  }, []);

  const updateQty: CartContextValue["updateQty"] = React.useCallback((productId, variantId, qty) => {
    setItems((prev) =>
      prev
        .map((it) => {
          const match = it.productId === productId && (it.variantId ?? "__none__") === (variantId ?? "__none__");
          if (!match) return it;
          return { ...it, qty: Math.max(1, qty) };
        }),
    );
  }, []);

  const removeItem: CartContextValue["removeItem"] = React.useCallback((productId, variantId) => {
    setItems((prev) =>
      prev.filter(
        (it) => !(it.productId === productId && (it.variantId ?? "__none__") === (variantId ?? "__none__")),
      ),
    );
  }, []);

  const clearCart: CartContextValue["clearCart"] = React.useCallback(() => {
    setItems([]);
  }, []);

  const hasItem: CartContextValue["hasItem"] = React.useCallback(
    (productId, variantId) =>
      items.some((it) => it.productId === productId && (it.variantId ?? "__none__") === (variantId ?? "__none__")),
    [items],
  );

  const value: CartContextValue = React.useMemo(
    () => ({
      ...derived,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen((v) => !v),
      addItem,
      updateQty,
      removeItem,
      clearCart,
      hasItem,
      syncPrices,
    }),
    [derived, isOpen, addItem, updateQty, removeItem, clearCart, hasItem, syncPrices],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a <CartProvider>. Wrap your app in <CartProvider>.");
  }
  return ctx;
}

export { CartContext };
export default CartProvider;
