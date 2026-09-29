"use client";

/** URL redirects and broken links (API: /admin/redirects). */
import { api } from "@ecom/api-client";

export interface Redirect {
  id: string;
  fromPath: string;
  toUrl: string;
  statusCode: 301 | 302;
  isActive: boolean;
  auto: boolean;
  note: string | null;
  hits: number;
  lastHitAt: string | null;
  createdAt: string;
}

export interface RedirectsPage {
  rows: Redirect[];
  total: number;
  page: number;
  perPage: number;
  brokenLinks: number;
}

export interface BrokenLink {
  id: string;
  path: string;
  hits: number;
  referrer: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface RedirectInput {
  fromPath: string;
  toUrl: string;
  statusCode: 301 | 302;
  isActive?: boolean;
  note?: string | null;
}

const T = { type: "Page" as const, id: "REDIRECTS" };
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export const redirectsApi = api.injectEndpoints({
  endpoints: (b) => ({
    redirects: b.query<RedirectsPage, { search?: string; page?: number }>({
      query: (params) => ({ url: "/admin/redirects", params: clean(params) }),
      providesTags: [T],
    }),
    brokenLinks: b.query<{ rows: BrokenLink[]; total: number; page: number; perPage: number }, { page?: number }>({
      query: (params) => ({ url: "/admin/redirects/broken", params: clean(params) }),
      providesTags: [T],
    }),
    saveRedirect: b.mutation<Redirect, RedirectInput & { id?: string }>({
      query: ({ id, ...body }) => ({ url: id ? `/admin/redirects/${id}` : "/admin/redirects", method: id ? "PATCH" : "POST", body }),
      invalidatesTags: [T],
    }),
    deleteRedirects: b.mutation<{ deleted: number }, string[]>({
      query: (ids) => ({ url: "/admin/redirects/delete", method: "POST", body: { ids } }),
      invalidatesTags: [T],
    }),
    importRedirects: b.mutation<{ added: number; updated: number; errors: { line: number; message: string }[] }, string>({
      query: (text) => ({ url: "/admin/redirects/import", method: "POST", body: { text } }),
      invalidatesTags: [T],
    }),
    dismissBroken: b.mutation<{ deleted: number }, string[] | "all">({
      query: (ids) => ({ url: "/admin/redirects/broken/dismiss", method: "POST", body: { ids } }),
      invalidatesTags: [T],
    }),
  }),
});

export const {
  useRedirectsQuery,
  useBrokenLinksQuery,
  useSaveRedirectMutation,
  useDeleteRedirectsMutation,
  useImportRedirectsMutation,
  useDismissBrokenMutation,
} = redirectsApi;
