"use client";

import { api, toPaginated } from "@ecom/api-client";
import { ProductStatus, ExportFormat } from "@ecom/shared-types";

export interface ProductVariant {
  id?: string | number;
  attributeValues?: Record<string, unknown>;
  sku?: string | null;
  barcode?: string | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  /** What one unit cost the shop (purchases set it to the average). */
  costPrice?: number | null;
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
  /** Lower-case search and filter words. */
  tags?: string[];
  /** Rows of the product page's specifications table. */
  specifications?: { group?: string | null; label: string; value: string }[] | null;
  storeId?: string | number;
  type?: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  /** Other languages: `{ bn: { name, shortDescription, description } }`. */
  translations?: { bn?: Record<string, string | null> } | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  /** What one unit cost the shop (purchases set it to the average). */
  costPrice?: number | null;
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
  /** Other languages: `{ bn: { name, description } }`. */
  translations?: { bn?: Record<string, string | null> } | null;
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
  /** Other languages: `{ bn: { name, description } }`. */
  translations?: { bn?: Record<string, string | null> } | null;
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

// ---- API → admin shapes. Prisma decimals arrive as strings, relations as join rows. ----

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

type ApiRow = Record<string, unknown>;

function fromApiVariant(v: ApiRow): ProductVariant {
  return {
    ...(v as ProductVariant),
    regularPrice: num(v.regularPrice),
    salePrice: num(v.salePrice),
    costPrice: num(v.costPrice),
    weight: num(v.weight),
    length: num(v.length),
    width: num(v.width),
    height: num(v.height),
  };
}

export function fromApiProduct(p: ApiRow): Product {
  const images = (p.images as { imageUrl: string }[] | undefined) ?? [];
  const cats = (p.categories as { categoryId: string; category?: { id: string; name: string; slug: string } }[] | undefined) ?? [];
  return {
    ...(p as unknown as Product),
    // The DB stores lowercase ("published"); the admin UI uses the ProductStatus enum ("PUBLISHED").
    status: String(p.status ?? "draft").toUpperCase(),
    regularPrice: num(p.regularPrice),
    salePrice: num(p.salePrice),
    costPrice: num(p.costPrice),
    weight: num(p.weight),
    length: num(p.length),
    width: num(p.width),
    height: num(p.height),
    supplierCost: num(p.supplierCost),
    imageUrls: images.map((i) => i.imageUrl),
    thumbnailUrl: images[0]?.imageUrl ?? null,
    categoryIds: cats.map((c) => c.categoryId),
    categories: cats.filter((c) => c.category).map((c) => ({ id: c.category!.id, name: c.category!.name, slug: c.category!.slug })),
    variants: ((p.variants as ApiRow[] | undefined) ?? []).map(fromApiVariant),
  };
}

/** Outgoing product bodies: status back to the lowercase value the API and storefront query on. */
/** Also turns form BigInts (z.coerce.bigint ids) into strings, which JSON.stringify would otherwise throw on. */
const toApiProductBody = (body: Partial<Product>) =>
  JSON.parse(
    JSON.stringify(body.status ? { ...body, status: body.status.toLowerCase() } : body, (_k, v: unknown) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );

const fromApiMedia = (m: ApiRow): MediaItem => ({
  ...(m as unknown as MediaItem),
  thumbnailUrl: (m.thumbUrl as string | null) ?? null,
  size: Number(m.sizeBytes ?? 0),
});

const toPage = <T>(items: T[], meta: unknown): PaginatedResponse<T> => {
  const { limit, ...rest } = toPaginated(items, meta);
  return { ...rest, perPage: limit };
};

/** Flattens the category tree depth-first, adding depth, parent and a rolled-up product count. */
function flattenCategories(nodes: ApiRow[], depth = 0, parent: { id: string; name: string } | null = null): Category[] {
  return nodes.flatMap((n) => {
    const children = (n.children as ApiRow[] | undefined) ?? [];
    const self: Category = {
      ...(n as unknown as Category),
      depth,
      parent,
      children: undefined,
      productCount: (n._count as { products?: number } | undefined)?.products ?? (n.productCount as number | undefined),
    };
    return [self, ...flattenCategories(children, depth + 1, { id: String(n.id), name: String(n.name) })];
  });
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
        if (params.status) searchParams.set("status", params.status.toLowerCase());
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
      transformResponse: (items: ApiRow[], meta) => toPage(items.map(fromApiProduct), meta),
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
      transformResponse: (p: ApiRow) => fromApiProduct(p),
      providesTags: (_result, _error, id) => [{ type: "Product", id }],
    }),

    createProduct: builder.mutation<Product, Partial<Product>>({
      query: (body) => ({
        url: "/admin/products",
        method: "POST",
        body: toApiProductBody(body),
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    updateProduct: builder.mutation<Product, { id: string | number; body: Partial<Product> }>({
      query: ({ id, body }) => ({
        url: `/admin/products/${id}`,
        method: "PATCH",
        body: toApiProductBody(body),
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

    // The API exposes the tree only; the flat list is derived from it.
    getCategories: builder.query<Category[], void>({
      query: () => ({
        url: "/admin/categories/tree",
        method: "GET",
      }),
      transformResponse: (tree: ApiRow[]) => flattenCategories(tree),
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
      transformResponse: (items: ApiRow[], meta) =>
        toPage(
          items.map((b) => ({ ...(b as unknown as Brand), productCount: (b._count as { products?: number } | undefined)?.products })),
          meta,
        ),
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
        url: "/admin/media/upload",
        method: "POST",
        body: formData,
        formData: true,
      }),
      transformResponse: (m: ApiRow) => fromApiMedia(m),
      invalidatesTags: [{ type: "Media", id: "LIST" }],
    }),

    listMedia: builder.query<PaginatedResponse<MediaItem>, MediaQueryParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.page !== undefined) searchParams.set("page", params.page.toString());
        if (params.perPage !== undefined) searchParams.set("perPage", params.perPage.toString());
        if (params.search) searchParams.set("search", params.search);
        return {
          url: `/admin/media?${searchParams.toString()}`,
          method: "GET",
        };
      },
      transformResponse: (items: ApiRow[], meta) => toPage(items.map(fromApiMedia), meta),
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
        url: `/admin/media/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Media", id },
        { type: "Media", id: "LIST" },
      ],
    }),

    updateMediaAltText: builder.mutation<MediaItem, { id: string | number; altText: string }>({
      query: ({ id, altText }) => ({
        url: `/admin/media/${id}`,
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
