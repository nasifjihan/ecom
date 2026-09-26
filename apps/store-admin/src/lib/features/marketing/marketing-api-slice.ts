"use client";

import { api, toPaginated } from "@ecom/api-client";
import type { CouponType, ExportFormat } from "@ecom/shared-types";
import type { PaginationDto } from "@ecom/zod-schemas";

export interface Coupon {
  id: string | number;
  code: string;
  description?: string;
  type: CouponType;
  amount: number;
  minimumSpend?: number;
  maximumSpend?: number;
  individualUseOnly?: boolean;
  excludeSaleItems?: boolean;
  productIds?: (string | number)[];
  excludeProductIds?: (string | number)[];
  categoryIds?: (string | number)[];
  excludeCategoryIds?: (string | number)[];
  allowedEmails?: string[];
  usageLimit?: number;
  usageLimitPerXCustomers?: number;
  usageLimitPerUser?: number;
  freeShipping?: boolean;
  validFrom?: string;
  validUntil?: string;
  usageCount?: number;
  isActive?: boolean;
  bogoBuyQty?: number;
  bogoGetQty?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CouponListFilters extends Partial<PaginationDto> {
  type?: CouponType;
  status?: "active" | "expired" | "upcoming";
  usageMin?: number;
  usageMax?: number;
  usagePerCustomer?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface CouponListResponse {
  items: Coupon[];
  total: number;
  page: number;
  perPage: number;
}

export interface CouponUsageOrder {
  id: string | number;
  orderNumber: string;
  customerName: string;
  date: string;
  total: number;
  discount: number;
}

export interface CreateCouponDto extends Omit<Coupon, "id" | "usageCount" | "isActive" | "createdAt" | "updatedAt"> {}

export interface UpdateCouponDto extends Partial<CreateCouponDto> {}

export interface BulkUpdateCouponsDto {
  ids: (string | number)[];
  action: "enable" | "disable" | "delete";
}

export interface ExportCouponsDto extends CouponListFilters {
  format: ExportFormat;
}

export interface FlashSale {
  id: string | number;
  title: string;
  bannerImage?: string;
  startDate: string;
  endDate: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  applyTo: "all" | "products" | "categories";
  productIds?: (string | number)[];
  categoryIds?: (string | number)[];
  excludeOnSale?: boolean;
  minQtyPerOrder?: number;
  maxQtyPerOrder?: number;
  perUserLimit?: number;
  visibility?: boolean;
  priority?: number;
  currentSalesCount?: number;
  revenueGenerated?: number;
  productsIncludedCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashSaleListFilters extends Partial<PaginationDto> {
  status?: "active" | "scheduled" | "expired";
}

export interface FlashSaleListResponse {
  items: FlashSale[];
  total: number;
  page: number;
  perPage: number;
}

export interface CreateFlashSaleDto extends Omit<FlashSale, "id" | "currentSalesCount" | "revenueGenerated" | "productsIncludedCount" | "createdAt" | "updatedAt"> {}

export interface UpdateFlashSaleDto extends Partial<CreateFlashSaleDto> {}

export type ReviewStatus = "pending" | "approved" | "spam" | "trashed";

export interface Review {
  id: string | number;
  reviewerName: string;
  reviewerEmail?: string;
  reviewerAvatar?: string;
  verified?: boolean;
  productId: string | number;
  productName: string;
  productImage?: string;
  rating: number;
  title?: string;
  text: string;
  reply?: string;
  status: ReviewStatus;
  submittedAt: string;
  updatedAt?: string;
}

export interface ReviewListFilters extends Partial<PaginationDto> {
  customerId?: string | number;
  productId?: string | number;
  status?: ReviewStatus;
  rating?: number[];
  verifiedOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReviewListResponse {
  items: Review[];
  total: number;
  page: number;
  perPage: number;
}

export interface UpdateReviewDto {
  approved?: boolean;
  rating?: number;
  reply?: string;
  title?: string;
  text?: string;
  status?: ReviewStatus;
}

export interface BulkUpdateReviewsDto {
  ids: (string | number)[];
  action: "approve" | "unapprove" | "spam" | "unspam" | "trash" | "restore" | "delete";
  replyText?: string;
}

// ---- API ↔ admin shapes. The API uses the Prisma column names; decimals arrive as strings. ----

type ApiRow = Record<string, any>;

const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));

const listParams = (filters: Record<string, unknown> | void, map: Record<string, string> = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(map[key] ?? key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params;
};

const toListResponse = <T>(items: T[], meta: unknown) => {
  const { limit, totalPages: _tp, ...rest } = toPaginated(items, meta);
  return { ...rest, perPage: limit };
};

/** Coupon.type is stored as the DB DiscountType enum; the admin works in CouponType (the API converts on write). */
const DB_TO_COUPON_TYPE: Record<string, CouponType> = {
  PERCENTAGE: "PERCENT_CART" as CouponType,
  BOGO: "BUY_X_GET_Y" as CouponType,
};

export function fromApiCoupon(c: ApiRow): Coupon {
  return {
    id: c.id,
    code: c.code,
    description: c.description ?? undefined,
    type: DB_TO_COUPON_TYPE[c.type] ?? c.type,
    amount: Number(c.amount),
    minimumSpend: num(c.minSubtotal),
    maximumSpend: num(c.maxSubtotal),
    individualUseOnly: c.individualOnly,
    excludeSaleItems: c.excludeSales,
    productIds: c.productIds ?? undefined,
    excludeProductIds: c.excludeProductIds ?? undefined,
    categoryIds: c.categoryIds ?? undefined,
    allowedEmails: c.customerEmails ?? undefined,
    usageLimit: c.totalUsageLimit ?? undefined,
    usageLimitPerUser: c.perCustomerLimit ?? undefined,
    freeShipping: c.freeShipping,
    validFrom: c.startsAt ?? undefined,
    validUntil: c.expiresAt ?? undefined,
    usageCount: c.usageCount,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Admin coupon form → API body. Fields the API has no column for (BOGO qty, excluded categories, per-X-customers) are dropped. */
function toApiCoupon(c: Partial<Coupon>): ApiRow {
  const body: ApiRow = {
    code: c.code,
    description: c.description || undefined,
    type: c.type,
    amount: c.amount,
    freeShipping: c.freeShipping,
    minSubtotal: c.minimumSpend || undefined,
    maxSubtotal: c.maximumSpend || undefined,
    productIds: c.productIds?.length ? c.productIds.map(String) : undefined,
    excludeProductIds: c.excludeProductIds?.length ? c.excludeProductIds.map(String) : undefined,
    categoryIds: c.categoryIds?.length ? c.categoryIds.map(String) : undefined,
    excludeSales: c.excludeSaleItems,
    individualOnly: c.individualUseOnly,
    customerEmails: c.allowedEmails?.length ? c.allowedEmails : undefined,
    totalUsageLimit: c.usageLimit || undefined,
    perCustomerLimit: c.usageLimitPerUser || undefined,
    startsAt: c.validFrom || undefined,
    expiresAt: c.validUntil || undefined,
    isActive: c.isActive,
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

export function fromApiFlashSale(f: ApiRow): FlashSale {
  const items: ApiRow[] = f.items ?? [];
  const isPercent = f.discountPercent !== null && f.discountPercent !== undefined;
  return {
    id: f.id,
    title: f.name,
    bannerImage: f.bannerImageUrl ?? undefined,
    startDate: f.startsAt,
    endDate: f.endsAt,
    discountType: isPercent ? "percentage" : "fixed",
    discountValue: Number(isPercent ? f.discountPercent : f.discountFixed ?? 0),
    applyTo: "products",
    productIds: items.map((i) => i.productId),
    visibility: f.isActive,
    priority: f.position,
    productsIncludedCount: f._count?.items ?? items.length,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);

/** Admin flash-sale form → API body. The API prices sales per product, so "all" / "categories" can't be sent. */
function toApiFlashSale(f: Partial<FlashSale>): ApiRow {
  const body: ApiRow = {
    name: f.title,
    slug: f.title ? slugify(f.title) : undefined,
    startsAt: f.startDate,
    endsAt: f.endDate,
    discountPercent: f.discountType === "percentage" ? f.discountValue : undefined,
    discountFixed: f.discountType === "fixed" ? f.discountValue : undefined,
    bannerImageUrl: f.bannerImage || undefined,
    isActive: f.visibility,
    position: f.priority,
    items: f.productIds?.map((productId) => ({ productId: String(productId) })),
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

export function fromApiReview(r: ApiRow): Review {
  const name = [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(" ");
  return {
    id: r.id,
    reviewerName: name || "Anonymous",
    reviewerEmail: r.customer?.email,
    verified: r.verified,
    productId: r.productId,
    productName: r.product?.name ?? `Product #${r.productId}`,
    rating: r.rating,
    title: r.title ?? undefined,
    text: r.body ?? "",
    reply: r.replyBody ?? undefined,
    status: r.status,
    submittedAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const MODERATE_ACTIONS: Partial<Record<BulkUpdateReviewsDto["action"], string>> = {
  approve: "approve",
  spam: "spam-mark",
  trash: "bulk-delete",
  delete: "bulk-delete",
};

export const marketingApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getCoupons: builder.query<CouponListResponse, CouponListFilters | void>({
      query: (filters) => {
        const f = { ...(filters ?? {}) } as Record<string, unknown>;
        // "upcoming" has no API filter; usage/date filters are not supported server-side either.
        if (f.status === "upcoming") delete f.status;
        for (const k of ["usageMin", "usageMax", "usagePerCustomer", "dateFrom", "dateTo"]) delete f[k];
        return { url: `/admin/marketing/coupons?${listParams(f)}`, method: "GET" };
      },
      transformResponse: (items: ApiRow[], meta) => toListResponse(items.map(fromApiCoupon), meta),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "Coupon" as const, id })),
              { type: "Coupon", id: "LIST" },
            ]
          : [{ type: "Coupon", id: "LIST" }],
    }),
    getCoupon: builder.query<Coupon, string | number>({
      query: (id) => ({
        url: `/admin/marketing/coupons/${id}`,
        method: "GET",
      }),
      transformResponse: (c: ApiRow) => fromApiCoupon(c),
      providesTags: (_, __, id) => [{ type: "Coupon", id }],
    }),
    // No dedicated endpoint: search by code and check for an exact match.
    checkCouponUnique: builder.query<{ unique: boolean }, string>({
      queryFn: async (code, _api, _extra, baseQuery) => {
        const res = await baseQuery(`/admin/marketing/coupons?search=${encodeURIComponent(code)}&perPage=100`);
        if (res.error) return { error: res.error };
        const taken = (res.data as ApiRow[]).some((c) => String(c.code).toUpperCase() === code.trim().toUpperCase());
        return { data: { unique: !taken } };
      },
    }),
    // Orders only store the coupon code, and the API has no per-coupon usage endpoint yet.
    getCouponUsage: builder.query<CouponUsageOrder[], string | number>({
      queryFn: async () => ({ data: [] }),
    }),
    createCoupon: builder.mutation<Coupon, CreateCouponDto>({
      query: (body) => ({
        url: "/admin/marketing/coupons",
        method: "POST",
        body: toApiCoupon(body),
      }),
      transformResponse: (c: ApiRow) => fromApiCoupon(c),
      invalidatesTags: [{ type: "Coupon", id: "LIST" }],
    }),
    updateCoupon: builder.mutation<Coupon, { id: string | number; body: UpdateCouponDto }>({
      query: ({ id, body }) => ({
        url: `/admin/marketing/coupons/${id}`,
        method: "PATCH",
        body: toApiCoupon(body),
      }),
      transformResponse: (c: ApiRow) => fromApiCoupon(c),
      invalidatesTags: (_, __, { id }) => [
        { type: "Coupon", id },
        { type: "Coupon", id: "LIST" },
      ],
    }),
    deleteCoupon: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/marketing/coupons/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_, __, id) => [
        { type: "Coupon", id },
        { type: "Coupon", id: "LIST" },
      ],
    }),
    // No bulk endpoint: apply per coupon.
    bulkUpdateCoupons: builder.mutation<{ updated: number; failed: number }, BulkUpdateCouponsDto>({
      queryFn: async ({ ids, action }, _api, _extra, baseQuery) => {
        const results = await Promise.all(
          ids.map((id) =>
            action === "delete"
              ? baseQuery({ url: `/admin/marketing/coupons/${id}`, method: "DELETE" })
              : baseQuery({
                  url: `/admin/marketing/coupons/${id}`,
                  method: "PATCH",
                  body: { isActive: action === "enable" },
                }),
          ),
        );
        const failed = results.filter((r) => r.error).length;
        return { data: { updated: ids.length - failed, failed } };
      },
      invalidatesTags: [{ type: "Coupon", id: "LIST" }],
    }),
    exportCoupons: builder.mutation<Blob | { url: string }, ExportCouponsDto>({
      query: (body) => ({
        url: "/admin/marketing/coupons/export",
        method: "POST",
        body,
        responseHandler: async (response) => {
          if (body.format === "csv") {
            return await response.blob();
          }
          return await response.json();
        },
      }),
    }),
    getFlashSales: builder.query<FlashSaleListResponse, FlashSaleListFilters | void>({
      query: (filters) => {
        // The API only paginates; active/scheduled/expired are derived from dates on the page.
        const { status: _status, ...rest } = (filters ?? {}) as FlashSaleListFilters;
        const params = listParams(rest as Record<string, unknown>);
        return { url: `/admin/marketing/flash-sales?${params}`, method: "GET" };
      },
      transformResponse: (items: ApiRow[], meta) => toListResponse(items.map(fromApiFlashSale), meta),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "FlashSale" as const, id })),
              { type: "FlashSale", id: "LIST" },
            ]
          : [{ type: "FlashSale", id: "LIST" }],
    }),
    getFlashSale: builder.query<FlashSale, string | number>({
      query: (id) => ({
        url: `/admin/marketing/flash-sales/${id}`,
        method: "GET",
      }),
      transformResponse: (f: ApiRow) => fromApiFlashSale(f),
      providesTags: (_, __, id) => [{ type: "FlashSale", id }],
    }),
    createFlashSale: builder.mutation<FlashSale, CreateFlashSaleDto>({
      query: (body) => ({
        url: "/admin/marketing/flash-sales",
        method: "POST",
        body: toApiFlashSale(body),
      }),
      transformResponse: (f: ApiRow) => fromApiFlashSale(f),
      invalidatesTags: [{ type: "FlashSale", id: "LIST" }],
    }),
    updateFlashSale: builder.mutation<FlashSale, { id: string | number; body: UpdateFlashSaleDto }>({
      query: ({ id, body }) => ({
        url: `/admin/marketing/flash-sales/${id}`,
        method: "PATCH",
        body: toApiFlashSale(body),
      }),
      transformResponse: (f: ApiRow) => fromApiFlashSale(f),
      invalidatesTags: (_, __, { id }) => [
        { type: "FlashSale", id },
        { type: "FlashSale", id: "LIST" },
      ],
    }),
    // "Stop" = deactivate; the API has no separate stop action.
    stopFlashSale: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/marketing/flash-sales/${id}`,
        method: "PATCH",
        body: { isActive: false },
      }),
      invalidatesTags: (_, __, id) => [
        { type: "FlashSale", id },
        { type: "FlashSale", id: "LIST" },
      ],
    }),
    getReviews: builder.query<ReviewListResponse, ReviewListFilters | void>({
      query: (filters) => {
        const { rating, verifiedOnly: _v, dateFrom: _df, dateTo: _dt, status, ...rest } = (filters ?? {}) as ReviewListFilters;
        const params = listParams(rest as Record<string, unknown>);
        // API filters on one rating and on pending/approved/spam only.
        if (rating?.length === 1) params.set("rating", String(rating[0]));
        if (status && status !== "trashed") params.set("status", status);
        return { url: `/admin/marketing/reviews?${params}`, method: "GET" };
      },
      transformResponse: (items: ApiRow[], meta) => toListResponse(items.map(fromApiReview), meta),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "Review" as const, id })),
              { type: "Review", id: "LIST" },
            ]
          : [{ type: "Review", id: "LIST" }],
    }),
    getReview: builder.query<Review, string | number>({
      query: (id) => ({
        url: `/admin/marketing/reviews/${id}`,
        method: "GET",
      }),
      transformResponse: (r: ApiRow) => fromApiReview(r),
      providesTags: (_, __, id) => [{ type: "Review", id }],
    }),
    // Only approving (or spam/trash) is supported by the API; replies and edits are not stored yet.
    updateReview: builder.mutation<void, { id: string | number; body: UpdateReviewDto }>({
      queryFn: async ({ id, body }, _api, _extra, baseQuery) => {
        const action =
          body.approved === true || body.status === "approved"
            ? "approve"
            : body.status === "spam"
              ? "spam-mark"
              : body.status === "trashed"
                ? "bulk-delete"
                : null;
        if (!action) {
          return { error: { status: 400, data: "Replying to or editing reviews is not supported by the API yet." } };
        }
        const res = await baseQuery({ url: "/admin/marketing/reviews/moderate", method: "POST", body: { ids: [String(id)], action } });
        return res.error ? { error: res.error } : { data: undefined };
      },
      invalidatesTags: (_, __, { id }) => [
        { type: "Review", id },
        { type: "Review", id: "LIST" },
      ],
    }),
    bulkUpdateReviews: builder.mutation<void, BulkUpdateReviewsDto>({
      queryFn: async ({ ids, action }, _api, _extra, baseQuery) => {
        const apiAction = MODERATE_ACTIONS[action];
        if (!apiAction) return { error: { status: 400, data: `"${action}" is not supported by the API yet.` } };
        const res = await baseQuery({
          url: "/admin/marketing/reviews/moderate",
          method: "POST",
          body: { ids: ids.map(String), action: apiAction },
        });
        return res.error ? { error: res.error } : { data: undefined };
      },
      invalidatesTags: [{ type: "Review", id: "LIST" }],
    }),
    markSpamReview: builder.mutation<void, string | number>({
      query: (id) => ({
        url: "/admin/marketing/reviews/moderate",
        method: "POST",
        body: { ids: [String(id)], action: "spam-mark" },
      }),
      invalidatesTags: (_, __, id) => [
        { type: "Review", id },
        { type: "Review", id: "LIST" },
      ],
    }),
    deleteReview: builder.mutation<void, string | number>({
      query: (id) => ({
        url: "/admin/marketing/reviews/moderate",
        method: "POST",
        body: { ids: [String(id)], action: "bulk-delete" },
      }),
      invalidatesTags: (_, __, id) => [
        { type: "Review", id },
        { type: "Review", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCouponsQuery,
  useGetCouponQuery,
  useLazyGetCouponQuery,
  useLazyCheckCouponUniqueQuery,
  useGetCouponUsageQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
  useBulkUpdateCouponsMutation,
  useExportCouponsMutation,
  useGetFlashSalesQuery,
  useGetFlashSaleQuery,
  useCreateFlashSaleMutation,
  useUpdateFlashSaleMutation,
  useStopFlashSaleMutation,
  useGetReviewsQuery,
  useGetReviewQuery,
  useUpdateReviewMutation,
  useBulkUpdateReviewsMutation,
  useMarkSpamReviewMutation,
  useDeleteReviewMutation,
} = marketingApiSlice;
