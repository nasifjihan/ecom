/**
 * RTK Query Base API — central client consumed by store-admin, super-admin, and storefronts.
 *
 * Every API endpoint slice is registered here via `api.injectEndpoints`.
 * DO NOT duplicate fetch configurations per app.
 *
 * Base URL set at app boot via:
 *   <ApiProvider api={api}></ApiProvider> or via Redux store setup.
 *
 * Authorization JWTs are added in `prepareHeaders` below from the app's auth store.
 */
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  FetchArgs,
  FetchBaseQueryError,
  BaseQueryFn,
} from "@reduxjs/toolkit/query";

/**
 * The STANDARD response envelope the API returns for every non-streaming response.
 * (See PROJECT_DOCUMENTATION.md Section 21 — never return naked data.)
 */
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: unknown;
  errors?: Record<string, string[]>;
  timestamp: string;
  requestId: string;
};

type GetTokenFn = () => string | null | undefined;

/**
 * Defaults to process.env — overridable in each Next app via configureBase() at boot.
 */
let apiBaseUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
let getToken: GetTokenFn = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("accessToken");
};

export function configureApiClient(opts: { baseUrl: string; getToken?: GetTokenFn }): void {
  apiBaseUrl = opts.baseUrl;
  if (opts.getToken) getToken = opts.getToken;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiBaseUrl,
  credentials: "include",
  mode: "cors",
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    return headers;
  },
});

/**
 * Wrapper that unwraps the ApiEnvelope OR surfaces the structured error.
 * RTK Query expects `{ data }` for success / `{ error }` for failure.
 * The actual RTK data will be `envelope.data` (the typed payload).
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = (async (
  args: string | FetchArgs,
  api: any,
  extraOptions: any,
) => {
  const res = await rawBaseQuery(args, api, extraOptions);
  if (res.error) return { error: res.error };
  const envelope = res.data as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    return {
      error: {
        status: (res.meta?.response?.status as number) || 500,
        data: envelope?.errors ?? envelope?.message ?? "Unknown error",
      },
    };
  }
  return { data: envelope.data, meta: envelope.meta as any };
}) as BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export const api = createApi({
  reducerPath: "ecomApi",
  baseQuery,
  tagTypes: [
    "Me",
    "Store",
    "Product",
    "Category",
    "Brand",
    "Order",
    "Customer",
    "Coupon",
    "User",
    "Role",
    "Page",
    "Blog",
    "Report",
    "Media",
  ],
  endpoints: () => ({}),
});

export const useLazyQuery = (api as any).useLazyQuery;
