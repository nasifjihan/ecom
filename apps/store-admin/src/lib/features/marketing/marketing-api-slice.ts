"use client";

import { api } from "@ecom/api-client";
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

declare module "@reduxjs/toolkit/query/react" {
  interface TagTypes {
    Coupon: Coupon;
    FlashSale: FlashSale;
    Review: Review;
  }
}

export const marketingApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getCoupons: builder.query<CouponListResponse, CouponListFilters | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.set(key, String(value));
            }
          });
        }
        return {
          url: `/admin/marketing/coupons?${params.toString()}`,
          method: "GET",
        };
      },
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
      providesTags: (_, __, id) => [{ type: "Coupon", id }],
    }),
    checkCouponUnique: builder.query<{ unique: boolean }, string>({
      query: (code) => ({
        url: `/admin/marketing/coupons/check-unique?code=${encodeURIComponent(code)}`,
        method: "GET",
      }),
    }),
    getCouponUsage: builder.query<CouponUsageOrder[], string | number>({
      query: (id) => ({
        url: `/admin/marketing/coupons/${id}/usage`,
        method: "GET",
      }),
    }),
    createCoupon: builder.mutation<Coupon, CreateCouponDto>({
      query: (body) => ({
        url: "/admin/marketing/coupons",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Coupon", id: "LIST" }],
    }),
    updateCoupon: builder.mutation<Coupon, { id: string | number; body: UpdateCouponDto }>({
      query: ({ id, body }) => ({
        url: `/admin/marketing/coupons/${id}`,
        method: "PATCH",
        body,
      }),
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
    bulkUpdateCoupons: builder.mutation<void, BulkUpdateCouponsDto>({
      query: (body) => ({
        url: "/admin/marketing/coupons/bulk",
        method: "POST",
        body,
      }),
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
        const params = new URLSearchParams();
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.set(key, String(value));
            }
          });
        }
        return {
          url: `/admin/marketing/flash-sales?${params.toString()}`,
          method: "GET",
        };
      },
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
      providesTags: (_, __, id) => [{ type: "FlashSale", id }],
    }),
    createFlashSale: builder.mutation<FlashSale, CreateFlashSaleDto>({
      query: (body) => ({
        url: "/admin/marketing/flash-sales",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "FlashSale", id: "LIST" }],
    }),
    updateFlashSale: builder.mutation<FlashSale, { id: string | number; body: UpdateFlashSaleDto }>({
      query: ({ id, body }) => ({
        url: `/admin/marketing/flash-sales/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "FlashSale", id },
        { type: "FlashSale", id: "LIST" },
      ],
    }),
    stopFlashSale: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/marketing/flash-sales/${id}/stop`,
        method: "POST",
      }),
      invalidatesTags: (_, __, id) => [
        { type: "FlashSale", id },
        { type: "FlashSale", id: "LIST" },
      ],
    }),
    getReviews: builder.query<ReviewListResponse, ReviewListFilters | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              if (Array.isArray(value)) {
                params.set(key, value.join(","));
              } else {
                params.set(key, String(value));
              }
            }
          });
        }
        return {
          url: `/admin/marketing/reviews?${params.toString()}`,
          method: "GET",
        };
      },
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
      providesTags: (_, __, id) => [{ type: "Review", id }],
    }),
    updateReview: builder.mutation<
      Review,
      { id: string | number; body: UpdateReviewDto }
    >({
      query: ({ id, body }) => ({
        url: `/admin/marketing/reviews/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "Review", id },
        { type: "Review", id: "LIST" },
      ],
    }),
    bulkUpdateReviews: builder.mutation<void, BulkUpdateReviewsDto>({
      query: (body) => ({
        url: "/admin/marketing/reviews/bulk",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Review", id: "LIST" }],
    }),
    markSpamReview: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/marketing/reviews/${id}/spam`,
        method: "POST",
      }),
      invalidatesTags: (_, __, id) => [
        { type: "Review", id },
        { type: "Review", id: "LIST" },
      ],
    }),
    deleteReview: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/marketing/reviews/${id}`,
        method: "DELETE",
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
