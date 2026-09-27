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
type RefreshOpts = {
  /** POSTed with the httpOnly refresh cookie when a request returns 401, e.g. "/auth/admin/refresh". */
  path: string;
  /** Called with the new access token, or null when the refresh failed (session is over). */
  onRefreshed: (accessToken: string | null) => void;
};

/**
 * Defaults to process.env — overridable in each Next app via configureBase() at boot.
 */
let apiBaseUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
let getToken: GetTokenFn = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("accessToken");
};

let refreshOpts: RefreshOpts | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureApiClient(opts: {
  baseUrl: string;
  getToken?: GetTokenFn;
  refresh?: RefreshOpts;
}): void {
  apiBaseUrl = opts.baseUrl;
  if (opts.getToken) getToken = opts.getToken;
  if (opts.refresh) refreshOpts = opts.refresh;
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
  let res = await rawBaseQuery(args, api, extraOptions);

  // Access tokens are short-lived: on 401, refresh once via the httpOnly cookie and retry.
  const url = typeof args === "string" ? args : args.url;
  // Auth calls (login, register, refresh) answer 401 for bad credentials: never refresh on those.
  if (res.error?.status === 401 && refreshOpts && !url.startsWith("/auth/")) {
    const opts = refreshOpts;
    refreshInFlight ??= (async () => {
      const r = await rawBaseQuery({ url: opts.path, method: "POST", body: {} }, api, extraOptions);
      const token = (r.data as ApiEnvelope<{ accessToken?: string }> | undefined)?.data?.accessToken ?? null;
      opts.onRefreshed(token);
      return token;
    })().finally(() => {
      refreshInFlight = null;
    });
    if (await refreshInFlight) res = await rawBaseQuery(args, api, extraOptions);
  }

  if (res.error) return { error: res.error };
  // Files (e.g. invoice PDFs) aren't wrapped in an envelope: pass them through as-is.
  const type = res.meta?.response?.headers.get("content-type") ?? "";
  if (type && !type.includes("json")) return { data: res.data };
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

/** Pagination as list endpoints report it in `envelope.meta`. */
export type ApiPageMeta = { page: number; perPage: number; total: number; totalPages: number };

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

/**
 * List endpoints return `data: T[]` with pagination in `meta`. Use in `transformResponse(items, meta)`
 * to get the `{ items, total, page, limit, totalPages }` shape the admin tables expect.
 */
export function toPaginated<T>(items: T[], meta: unknown): Paginated<T> {
  const m = (meta ?? {}) as Partial<ApiPageMeta>;
  return {
    items,
    total: m.total ?? items.length,
    page: m.page ?? 1,
    limit: m.perPage ?? items.length,
    totalPages: m.totalPages ?? 1,
  };
}

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
    "FlashSale",
    "Review",
    "User",
    "Role",
    "Page",
    "Blog",
    "Report",
    "Media",
    "Plan",
    "Subscription",
    "Domain",
    "Faq",
    "Menu",
    "Theme",
    "Homepage",
    "EmailTemplate",
    "EmailLog",
  ],
  endpoints: () => ({}),
});

/**
 * `responseHandler` for endpoints that return a file: the result is an object URL for it
 * (a string, so it can sit in the Redux store), and API errors still come back as JSON.
 */
export const fileResponse = async (r: Response): Promise<unknown> =>
  r.ok ? URL.createObjectURL(await r.blob()) : r.json();

/**
 * Shows or saves a file fetched with `fileResponse`. Call it straight from a click handler:
 * the new tab opens before the file loads, so pop-up blockers allow it.
 */
export async function openFile(
  load: () => Promise<string>,
  { filename, mode }: { filename: string; mode: "open" | "download" },
): Promise<void> {
  const tab = mode === "open" ? window.open("", "_blank") : null;
  try {
    const url = await load();
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export const useLazyQuery = (api as any).useLazyQuery;
