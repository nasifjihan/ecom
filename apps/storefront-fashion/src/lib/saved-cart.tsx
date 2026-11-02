"use client";

/**
 * The cart kept on the server (API: modules/storefront/saved-cart): saved as it changes for
 * signed-in shoppers, joined with the account's on sign-in, and saved for guests once checkout has
 * a phone or email (so the shop can remind them). The cart's token stays in this browser.
 */
import * as React from "react";
import { api } from "@ecom/api-client";
import { useCart, type CartItem } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";

const TOKEN_KEY = "cartToken";
interface SavedItem {
  productId: string;
  variantId: string | null;
  qty: number;
  title: string;
  slug: string;
  image: string;
  price: number;
  weightKG: number;
  variantLabel?: string;
}
type Line = { productId: string; variantId?: string | null; qty: number };
interface Contact {
  phone?: string;
  email?: string;
  firstName?: string;
}

const savedCartApi = api.injectEndpoints({
  endpoints: (b) => ({
    saveCart: b.mutation<{ token: string | null }, { token?: string | null; items: Line[]; contact?: Contact }>({
      query: (body) => ({ url: "/storefront/cart", method: "PUT", body }),
    }),
    joinCart: b.mutation<{ token: string | null; items: SavedItem[] }, { token?: string | null; items: Line[] }>({
      query: (body) => ({ url: "/storefront/cart/join", method: "POST", body }),
    }),
    recoverCart: b.mutation<{ token: string | null; items: SavedItem[] }, string>({
      query: (token) => ({ url: `/storefront/cart/recover/${encodeURIComponent(token)}` }),
    }),
    unsubscribeCart: b.mutation<{ unsubscribed: boolean }, string>({
      query: (token) => ({ url: `/storefront/cart/unsubscribe/${encodeURIComponent(token)}`, method: "POST" }),
    }),
  }),
  overrideExisting: false,
});
export const { useRecoverCartMutation, useUnsubscribeCartMutation } = savedCartApi;

export function cartToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setCartToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the cart is still saved on the account when signed in.
  }
}

/** A saved cart's items as the cart holds them. */
export const toCartItems = (items: SavedItem[]): CartItem[] =>
  items.map((i) => ({
    productId: i.productId,
    variantId: i.variantId ?? undefined,
    title: i.title,
    slug: i.slug,
    image: i.image,
    price: i.price,
    qty: i.qty,
    weightKG: i.weightKG,
    variantLabel: i.variantLabel,
  }));

const CONTACT_EVENT = "cart:contact";
/** Checkout calls this with the phone / email typed, so a guest's cart can be saved and reminded. */
export function rememberCartContact(contact: Contact) {
  window.dispatchEvent(new CustomEvent<Contact>(CONTACT_EVENT, { detail: contact }));
}

/** Keeps the browser's cart and the saved one in step. Renders nothing. */
export function CartSync() {
  const { items, replaceItems } = useCart();
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  const [save] = savedCartApi.useSaveCartMutation();
  const [join] = savedCartApi.useJoinCartMutation();
  const joined = React.useRef(false);
  const contact = React.useRef<Contact | undefined>(undefined);
  const lines = React.useMemo<Line[]>(() => items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, qty: i.qty })), [items]);
  const key = JSON.stringify(lines);
  // The latest cart, for the sign-in join (which runs once per sign-in, not on every change).
  const latest = React.useRef(lines);
  latest.current = lines;

  // Signing in: join the account's saved cart with this browser's.
  React.useEffect(() => {
    if (!signedIn) {
      joined.current = false;
      return;
    }
    if (joined.current) return;
    joined.current = true;
    void join({ token: cartToken(), items: latest.current })
      .unwrap()
      .then((r) => {
        setCartToken(r.token);
        if (r.items.length) replaceItems(toCartItems(r.items));
      })
      .catch(() => undefined);
  }, [signedIn, join, replaceItems]);

  const push = React.useCallback(() => {
    if (!signedIn && !cartToken() && !contact.current) return;
    void save({ token: cartToken(), items: JSON.parse(key) as Line[], contact: contact.current })
      .unwrap()
      .then((r) => setCartToken(r.token))
      .catch(() => undefined);
  }, [key, signedIn, save]);

  // Save a moment after the cart changes.
  React.useEffect(() => {
    const timer = setTimeout(push, 1500);
    return () => clearTimeout(timer);
  }, [push]);

  React.useEffect(() => {
    const onContact = (e: Event) => {
      const c = (e as CustomEvent<Contact>).detail;
      contact.current = { ...contact.current, ...c };
      push();
    };
    window.addEventListener(CONTACT_EVENT, onContact);
    return () => window.removeEventListener(CONTACT_EVENT, onContact);
  }, [push]);
  return null;
}
