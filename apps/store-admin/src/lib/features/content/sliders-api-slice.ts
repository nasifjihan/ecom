"use client";

/** Saved sliders: hero slides that hero blocks on the homepage, pages and landing pages can use (API: /admin/content/sliders). */
import { api } from "@ecom/api-client";
import type { HeroSlide } from "./content-api-slice";

export interface Slider {
  id: string;
  name: string;
  slides: HeroSlide[];
  /** Where hero blocks use it, e.g. "Homepage", "Page: About us". */
  usedOn: string[];
  updatedAt: string;
}

const TAG = { type: "Store" as const, id: "SLIDERS" };

export const slidersApi = api.injectEndpoints({
  endpoints: (b) => ({
    sliders: b.query<Slider[], void>({ query: () => "/admin/content/sliders", providesTags: [TAG] }),
    createSlider: b.mutation<Slider, { name: string; slides: HeroSlide[] }>({
      query: (body) => ({ url: "/admin/content/sliders", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    updateSlider: b.mutation<Slider, { id: string; name: string; slides: HeroSlide[] }>({
      query: ({ id, ...body }) => ({ url: `/admin/content/sliders/${id}`, method: "PUT", body }),
      invalidatesTags: [TAG],
    }),
    deleteSlider: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/admin/content/sliders/${id}`, method: "DELETE" }),
      invalidatesTags: [TAG],
    }),
  }),
  overrideExisting: false,
});

export const { useSlidersQuery, useCreateSliderMutation, useUpdateSliderMutation, useDeleteSliderMutation } = slidersApi;
