"use client";

/** Gift boxes shoppers fill themselves (API: /admin/gift-boxes). */
import { api } from "@ecom/api-client";

export interface GiftBox {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  boxProduct: { id: string; name: string; published: boolean; price: number | null };
  minItems: number;
  maxItems: number;
  productIds: string[];
  categoryIds: string[];
  allowMessage: boolean;
  messageMax: number;
  isActive: boolean;
  sortOrder: number;
  sold: number;
  updatedAt: string;
  /** Only on one box: the hand-picked products with names. */
  products?: { id: string; name: string }[];
}

export interface GiftBoxInput {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  boxProductId: string;
  minItems: number;
  maxItems: number;
  productIds: string[];
  categoryIds: string[];
  allowMessage: boolean;
  messageMax: number;
  isActive: boolean;
  sortOrder: number;
}

const T = { type: "Page" as const, id: "GIFT_BOXES" };

export const giftBoxesApi = api.injectEndpoints({
  endpoints: (b) => ({
    giftBoxes: b.query<GiftBox[], void>({ query: () => "/admin/gift-boxes", providesTags: [T] }),
    giftBox: b.query<GiftBox, string>({ query: (id) => `/admin/gift-boxes/${id}`, providesTags: [T] }),
    saveGiftBox: b.mutation<GiftBox, GiftBoxInput & { id?: string }>({
      query: ({ id, ...body }) => ({ url: id ? `/admin/gift-boxes/${id}` : "/admin/gift-boxes", method: id ? "PATCH" : "POST", body }),
      invalidatesTags: [T],
    }),
    deleteGiftBox: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/gift-boxes/${id}`, method: "DELETE" }),
      invalidatesTags: [T],
    }),
  }),
});

export const { useGiftBoxesQuery, useGiftBoxQuery, useSaveGiftBoxMutation, useDeleteGiftBoxMutation } = giftBoxesApi;
