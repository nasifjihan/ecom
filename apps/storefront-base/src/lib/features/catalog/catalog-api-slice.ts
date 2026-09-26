import { api } from "@ecom/api-client";

export type ProductSummary = {
  id: string;
  slug: string;
  title: string;
  image: string;
  images?: string[];
  price: number;
  compareAtPrice?: number | null;
  rating: number;
  reviewCount: number;
  isOnSale: boolean;
  discountPercent?: number;
  categoryId?: string;
  category?: { id: string; slug: string; name: string };
  brandId?: string;
  stockStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK";
  sku?: string;
  description?: string;
  shortDescription?: string;
  attributes?: { name: string; value: string }[];
  variants?: ProductVariantOption[];
  tags?: string[];
  weightKG?: number;
  /** True when the product has size/colour variants and needs a choice before add-to-cart. */
  hasVariants?: boolean;
  isNew?: boolean;
  isOutOfStock?: boolean;
  brand?: { id: string; slug: string; name: string };
};

export type ProductVariantOption = {
  id: string;
  attributes: Record<string, string>;
  color?: string;
  size?: string;
  label: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string;
  sku?: string;
  inStock: boolean;
  stockQty: number | null;
};

export type ProductReview = {
  id: string;
  name: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  date: string;
};

/** GET /storefront/products/:slug — summary plus everything the product page renders. */
export type ProductDetail = ProductSummary & {
  images: string[];
  variants: ProductVariantOption[];
  specifications: { name: string; value: string }[];
  reviews: ProductReview[];
  breadcrumbs: { id: string; slug: string; name: string }[];
  stockQty: number | null;
  seo?: { title?: string; description?: string; ogImage?: string };
};

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  image?: string;
  parentId?: string | null;
  productCount?: number;
  children?: CategoryNode[];
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  logo?: string;
  productCount?: number;
};

export type ProductsQueryArgs = {
  page?: number;
  perPage?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating";
  /** One id or a comma-separated list; descendants of each category are included. */
  categoryId?: string;
  categorySlug?: string;
  /** One id or a comma-separated list. */
  brandId?: string;
  featured?: boolean;
  excludeId?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  search?: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const STOREFRONT_CATALOG_TAG_TYPES = ["Product", "Category", "Brand"] as const;

export const catalogApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<Paginated<ProductSummary>, ProductsQueryArgs>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.page) params.set("page", String(args.page));
        if (args.perPage) params.set("perPage", String(args.perPage));
        if (args.sort) params.set("sort", args.sort);
        if (args.categoryId) params.set("categoryId", args.categoryId);
        if (args.categorySlug) params.set("categorySlug", args.categorySlug);
        if (args.featured !== undefined) params.set("featured", String(args.featured));
        if (args.excludeId) params.set("excludeId", args.excludeId);
        if (args.brandId) params.set("brandId", args.brandId);
        if (args.minPrice) params.set("minPrice", String(args.minPrice));
        if (args.maxPrice) params.set("maxPrice", String(args.maxPrice));
        if (args.rating) params.set("rating", String(args.rating));
        if (args.search) params.set("search", args.search);
        const qs = params.toString();
        return {
          url: qs ? `/storefront/products?${qs}` : `/storefront/products`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((p) => ({ type: "Product" as const, id: p.id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),

    getProductBySlug: builder.query<ProductDetail, string>({
      query: (slug) => ({
        url: `/storefront/products/${slug}`,
        method: "GET",
      }),
      providesTags: (_res, _err, slug) => [{ type: "Product" as const, id: slug }],
    }),

    getCategoriesTree: builder.query<CategoryNode[], void>({
      query: () => ({
        url: `/storefront/categories/tree`,
        method: "GET",
      }),
      providesTags: [{ type: "Category" as const, id: "TREE" }],
    }),

    getBrands: builder.query<Brand[], void>({
      query: () => ({
        url: `/storefront/brands`,
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((b) => ({ type: "Brand" as const, id: b.id })),
              { type: "Brand" as const, id: "LIST" },
            ]
          : [{ type: "Brand" as const, id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

type TagType = (typeof STOREFRONT_CATALOG_TAG_TYPES)[number];
export const catalogTagTypes: readonly TagType[] = STOREFRONT_CATALOG_TAG_TYPES;

export const {
  useGetProductsQuery,
  useGetProductBySlugQuery,
  useGetCategoriesTreeQuery,
  useGetBrandsQuery,
} = catalogApi;
