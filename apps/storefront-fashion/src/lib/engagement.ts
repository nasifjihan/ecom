"use client";

/**
 * Search suggestions, order tracking, the flash-sale page, reviews, questions and the wishlist
 * (API: modules/storefront/engagement). The wishlist is kept in the browser for guests and on the
 * account once signed in; what a guest saved is added to the account when they log in.
 */
import * as React from "react";
import { api } from "@ecom/api-client";
import { toast, type ProductSummary } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";

export interface SearchSuggestions {
  products: { id: string; slug: string; title: string; image: string; price: number; compareAtPrice: number | null }[];
  categories: { name: string; slug: string }[];
  terms: string[];
}

export interface TrackedOrder {
  number: string;
  status: string;
  placedAt: string;
  paymentStatus: string;
  total: number;
  step: number;
  steps: { label: string; done: boolean; at: string | null }[];
  items: { title: string; option: string | null; qty: number; image: string | null; gift: boolean }[];
  parcels: { code: string; status: string; courier: string | null; trackingNumber: string | null; trackingUrl: string | null; updatedAt: string }[];
}

export interface FlashSalePage {
  name: string;
  slug: string;
  description: string | null;
  endsAt: string;
  banner: { image: string; title: string | null; subtitle: string | null; ctaText: string | null; ctaUrl: string | null } | null;
  products: ProductSummary[];
}

const WISHLIST = { type: "Customer" as const, id: "WISHLIST" };

const engagementApi = api.injectEndpoints({
  endpoints: (b) => ({
    searchSuggest: b.query<SearchSuggestions, string>({
      query: (q) => ({ url: "/storefront/search/suggest", params: { q } }),
      keepUnusedDataFor: 60,
    }),
    popularSearches: b.query<string[], void>({ query: () => "/storefront/search/popular", keepUnusedDataFor: 600 }),
    trackOrder: b.mutation<TrackedOrder, { number: string; phone: string }>({
      query: (params) => ({ url: "/storefront/track", params }),
    }),
    flashSalePage: b.query<FlashSalePage[], void>({ query: () => "/storefront/flash-sales" }),
    askQuestion: b.mutation<{ id: string; status: string }, { productId: string; name?: string; question: string }>({
      query: ({ productId, ...body }) => ({ url: `/storefront/products/${productId}/questions`, method: "POST", body }),
    }),
    submitReview: b.mutation<{ id: string; status: string; verified: boolean }, { productId: string; rating: number; title?: string; body?: string }>({
      query: ({ productId, ...body }) => ({ url: `/storefront/products/${productId}/reviews`, method: "POST", body }),
      invalidatesTags: (_r, _e, { productId }) => [{ type: "Product", id: `MY-REVIEW-${productId}` }],
    }),
    myReview: b.query<{ id: string; rating: number; status: string; createdAt: string } | null, string>({
      query: (productId) => `/storefront/products/${productId}/my-review`,
      providesTags: (_r, _e, productId) => [{ type: "Product", id: `MY-REVIEW-${productId}` }],
    }),
    wishlistIds: b.query<string[], void>({ query: () => "/storefront/account/wishlist/ids", providesTags: [WISHLIST] }),
    wishlistProducts: b.query<ProductSummary[], void>({ query: () => "/storefront/account/wishlist", providesTags: [WISHLIST] }),
    addToWishlist: b.mutation<string[], string[]>({
      query: (productIds) => ({ url: "/storefront/account/wishlist", method: "POST", body: { productIds } }),
      invalidatesTags: [WISHLIST],
    }),
    removeFromWishlist: b.mutation<string[], string>({
      query: (productId) => ({ url: `/storefront/account/wishlist/${productId}`, method: "DELETE" }),
      invalidatesTags: [WISHLIST],
    }),
  }),
  overrideExisting: false,
});

export const {
  useSearchSuggestQuery,
  usePopularSearchesQuery,
  useTrackOrderMutation,
  useFlashSalePageQuery,
  useAskQuestionMutation,
  useSubmitReviewMutation,
  useMyReviewQuery,
  useWishlistIdsQuery,
  useWishlistProductsQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
} = engagementApi;

// ------------------------------------------------------------------ wishlist

const GUEST_KEY = "wishlist:v1";
const CHANGED = "wishlist-changed";

function readGuest(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(GUEST_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeGuest(ids: string[]) {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: the heart still works until the page reloads.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * The wishlist for the current visitor: `ids`, `has(id)` and `toggle(id, title?)`. Guests keep it
 * in this browser; signed-in customers on their account (a guest's list moves over on login).
 */
export function useWishlist() {
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  const [guest, setGuest] = React.useState<string[]>([]);
  const { data: serverIds } = useWishlistIdsQuery(undefined, { skip: !signedIn });
  const [add] = useAddToWishlistMutation();
  const [remove] = useRemoveFromWishlistMutation();
  const merging = React.useRef(false);

  React.useEffect(() => {
    const sync = () => setGuest(readGuest());
    sync();
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // After logging in, what was saved as a guest joins the account's list.
  React.useEffect(() => {
    if (!signedIn || merging.current) return;
    const saved = readGuest();
    if (!saved.length) return;
    merging.current = true;
    add(saved)
      .unwrap()
      .then(() => writeGuest([]))
      .catch(() => undefined)
      .finally(() => (merging.current = false));
  }, [signedIn, add]);

  const ids = React.useMemo(() => new Set(signedIn ? (serverIds ?? []) : guest), [signedIn, serverIds, guest]);

  const toggle = React.useCallback(
    async (id: string, title?: string) => {
      const on = !ids.has(id);
      try {
        if (signedIn) {
          if (on) await add([id]).unwrap();
          else await remove(id).unwrap();
        } else {
          const cur = readGuest();
          writeGuest(on ? [...new Set([id, ...cur])] : cur.filter((x) => x !== id));
        }
        toast.success(on ? "Saved to your wishlist" : "Removed from your wishlist", title ? { description: title } : undefined);
      } catch {
        toast.error("Couldn't update your wishlist. Please try again.");
      }
    },
    [ids, signedIn, add, remove],
  );

  return { ids, count: ids.size, has: (id: string) => ids.has(id), toggle, signedIn, guestIds: guest };
}
