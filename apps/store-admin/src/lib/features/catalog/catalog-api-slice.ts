"use client";

import { api } from "@ecom/api-client";
import { ProductStatus, ExportFormat } from "@ecom/shared-types";

export interface ProductVariant {
  id?: string | number;
  attributeValues?: Record<string, unknown>;
  sku?: string | null;
  barcode?: string | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  salePriceStartAt?: string | null;
  salePriceEndAt?: string | null;
  manageStock?: boolean;
  stockQty?: number | null;
  allowBackorder?: boolean;
  lowStockThreshold?: number | null;
  imageUrl?: string | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  status?: string;
}

export interface Product {
  id: string | number;
  storeId?: string | number;
  type?: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  salePriceStartAt?: string | null;
  salePriceEndAt?: string | null;
  manageStock?: boolean;
  stockQty?: number | null;
  reservedStock?: number;
  allowBackorder?: boolean;
  lowStockThreshold?: number | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  brandId?: string | number | null;
  taxClassId?: string | number | null;
  categoryIds?: (string | number)[];
  variants?: ProductVariant[];
  imageUrls?: string[];
  isDigital?: boolean;
  digitalFileId?: string | number | null;
  downloadLimit?: number | null;
  downloadExpiryDays?: number | null;
  virtual?: boolean;
  individuallySold?: boolean;
  requireShipping?: boolean;
  status: string;
  featured?: boolean;
  allowReviews?: boolean;
  seoTitle?: string | null;
  metaDesc?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  supplierId?: string | number | null;
  supplierCost?: number | null;
  supplierSku?: string | null;
  fulfillmentType?: string;
  createdAt: string;
  updatedAt: string;
  categories?: { id: string | number; name: string; slug: string }[];
  brand?: { id: string | number; name: string; slug: string } | null;
  thumbnailUrl?: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ProductQueryParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string | number;
  brandId?: string | number;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface Category {
  id: string | number;
  storeId?: string | number;
  parentId?: string | number | null;
  name: string;
  slug: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  displayMode?: string;
  sortOrder?: number;
  isActive?: boolean;
  menuIncluded?: boolean;
  megaMenuConfig?: Record<string, unknown> | null;
  seoTitle?: string | null;
  metaDesc?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  productCount?: number;
  parent?: { id: string | number; name: string } | null;
  children?: Category[];
  depth?: number;
}

export interface Brand {
  id: string | number;
  storeId?: string | number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  seoTitle?: string | null;
  metaDesc?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  productCount?: number;
}

export interface AttributeTerm {
  id?: string | number;
  attributeId?: string | number;
  name: string;
  slug?: string;
  value?: string | null;
  sortOrder?: number;
  swatchUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductAttribute {
  id: string | number;
  storeId?: string | number;
  name: string;
  slug: string;
  type: string;
  sortOrder?: number;
  isFilterable?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  terms?: AttributeTerm[];
}

export interface MediaItem {
  id: string | number;
  storeId?: string | number;
  filename: string;
  originalName?: string;
  mimeType: string;
  url: string;
  thumbnailUrl?: string | null;
  size?: number;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  uploadedBy?: string | number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaQueryParams {
  page?: number;
  perPage?: number;
  search?: string;
  mimeType?: string;
}

export interface BulkUpdateProductsDto {
  ids: (string | number)[];
  patch: {
    status?: string;
    featured?: boolean;
  };
}

export interface BulkDeleteProductsDto {
  ids: (string | number)[];
}

export const catalogApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<PaginatedResponse<Product>, ProductQueryParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.page !== undefined) searchParams.set("page", params.page.toString());
        if (params.perPage !== undefined) searchParams.set("perPage", params.perPage.toString());
        if (params.search) searchParams.set("search", params.search);
        if (params.categoryId !== undefined) searchParams.set("categoryId", String(params.categoryId));
        if (params.brandId !== undefined) searchParams.set("brandId", String(params.brandId));
        if (params.status) searchParams.set("status", params.status);
        if (params.minPrice !== undefined) searchParams.set("minPrice", params.minPrice.toString());
        if (params.maxPrice !== undefined) searchParams.set("maxPrice", params.maxPrice.toString());
        if (params.inStock !== undefined) searchParams.set("inStock", String(params.inStock));
        if (params.featured !== undefined) searchParams.set("featured", String(params.featured));
        if (params.sortBy) searchParams.set("sortBy", params.sortBy);
        if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
        return {
          url: `/admin/products?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "Product", id } as const)),
              { type: "Product", id: "LIST" },
            ]
          : [{ type: "Product", id: "LIST" }],
    }),

    getProduct: builder.query<Product, string | number>({
      query: (id) => ({
        url: `/admin/products/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Product", id }],
    }),

    createProduct: builder.mutation<Product, Partial<Product>>({
      query: (body) => ({
        url: "/admin/products",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    updateProduct: builder.mutation<Product, { id: string | number; body: Partial<Product> }>({
      query: ({ id, body }) => ({
        url: `/admin/products/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    deleteProduct: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    bulkDeleteProducts: builder.mutation<void, BulkDeleteProductsDto>({
      query: (body) => ({
        url: "/admin/products/bulk-archive",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    bulkUpdateProducts: builder.mutation<void, BulkUpdateProductsDto>({
      query: ({ ids, patch }) => {
        const endpoint = patch.status === ProductStatus.DRAFT ? "/admin/products/bulk-unpublish" : "/admin/products/bulk-archive";
        return {
          url: endpoint,
          method: "POST",
          body: { ids },
        };
      },
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    getCategories: builder.query<Category[], void>({
      query: () => ({
        url: "/admin/categories",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Category", id } as const)),
              { type: "Category", id: "LIST" },
            ]
          : [{ type: "Category", id: "LIST" }],
    }),

    getCategoryTree: builder.query<Category[], void>({
      query: () => ({
        url: "/admin/categories/tree",
        method: "GET",
      }),
      providesTags: [{ type: "Category", id: "LIST" }],
    }),

    createCategory: builder.mutation<Category, Partial<Category>>({
      query: (body) => ({
        url: "/admin/categories",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    updateCategory: builder.mutation<Category, { id: string | number; body: Partial<Category> }>({
      query: ({ id, body }) => ({
        url: `/admin/categories/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
      ],
    }),

    deleteCategory: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
      ],
    }),

    getBrands: builder.query<PaginatedResponse<Brand>, ProductQueryParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.page !== undefined) searchParams.set("page", params.page.toString());
        if (params.perPage !== undefined) searchParams.set("perPage", params.perPage.toString());
        if (params.search) searchParams.set("search", params.search);
        if (params.sortBy) searchParams.set("sortBy", params.sortBy);
        if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
        return {
          url: `/admin/brands?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "Brand", id } as const)),
              { type: "Brand", id: "LIST" },
            ]
          : [{ type: "Brand", id: "LIST" }],
    }),

    createBrand: builder.mutation<Brand, Partial<Brand>>({
      query: (body) => ({
        url: "/admin/brands",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Brand", id: "LIST" }],
    }),

    updateBrand: builder.mutation<Brand, { id: string | number; body: Partial<Brand> }>({
      query: ({ id, body }) => ({
        url: `/admin/brands/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Brand", id },
        { type: "Brand", id: "LIST" },
      ],
    }),

    deleteBrand: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/brands/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Brand", id },
        { type: "Brand", id: "LIST" },
      ],
    }),

    getAttributeList: builder.query<ProductAttribute[], void>({
      query: () => ({
        url: "/admin/attributes",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Category", id } as const)),
              { type: "Category", id: "LIST" },
            ]
          : [{ type: "Category", id: "LIST" }],
    }),

    getAttribute: builder.query<ProductAttribute, string | number>({
      query: (id) => ({
        url: `/admin/attributes/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Category", id }],
    }),

    createAttribute: builder.mutation<ProductAttribute, Partial<ProductAttribute>>({
      query: (body) => ({
        url: "/admin/attributes",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    createTerm: builder.mutation<AttributeTerm, { attributeId: string | number; body: AttributeTerm }>({
      query: ({ attributeId, body }) => ({
        url: `/admin/attributes/${attributeId}/terms`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    deleteTerm: builder.mutation<void, string | number>({
      query: (termId) => ({
        url: `/admin/attributes/terms/${termId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    updateAttribute: builder.mutation<ProductAttribute, { id: string | number; body: Partial<ProductAttribute> }>({
      query: ({ id, body }) => ({
        url: `/admin/attributes/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
      ],
    }),

    deleteAttribute: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/attributes/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
      ],
    }),

    uploadMedia: builder.mutation<MediaItem, FormData>({
      query: (formData) => ({
        url: "/admin/products/upload",
        method: "POST",
        body: formData,
        formData: true,
      }),
      invalidatesTags: [{ type: "Media", id: "LIST" }],
    }),

    listMedia: builder.query<PaginatedResponse<MediaItem>, MediaQueryParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.page !== undefined) searchParams.set("page", params.page.toString());
        if (params.perPage !== undefined) searchParams.set("perPage", params.perPage.toString());
        if (params.search) searchParams.set("search", params.search);
        return {
          url: `/admin/products/upload?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "Media", id } as const)),
              { type: "Media", id: "LIST" },
            ]
          : [{ type: "Media", id: "LIST" }],
    }),

    deleteMedia: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/products/upload/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Media", id },
        { type: "Media", id: "LIST" },
      ],
    }),

    updateMediaAltText: builder.mutation<MediaItem, { id: string | number; altText: string }>({
      query: ({ id, altText }) => ({
        url: `/admin/products/upload/${id}`,
        method: "PATCH",
        body: { altText },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Media", id },
        { type: "Media", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useBulkDeleteProductsMutation,
  useBulkUpdateProductsMutation,
  useGetCategoriesQuery,
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
  useGetAttributeListQuery,
  useGetAttributeQuery,
  useCreateAttributeMutation,
  useCreateTermMutation,
  useDeleteTermMutation,
  useUpdateAttributeMutation,
  useDeleteAttributeMutation,
  useUploadMediaMutation,
  useListMediaQuery,
  useDeleteMediaMutation,
  useUpdateMediaAltTextMutation,
} = catalogApiSlice;
