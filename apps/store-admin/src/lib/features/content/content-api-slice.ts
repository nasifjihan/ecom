"use client";

/** Store content: pages, blog, FAQs, menus, theme and homepage (API: /admin/content/*). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export interface CmsPageRow {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  showInFooterMenu: boolean;
  sortOrder: number;
  template: "text" | "sections" | null;
  updatedAt: string;
}
export type PageTemplate = "text" | "sections";
export interface CmsPage extends CmsPageRow {
  content: string | null;
  seoTitle: string | null;
  metaDesc: string | null;
  /** Blocks for pages whose template is "sections" (older rows have a null template, meaning text). */
  sections: HomepageSection[] | null;
}
export type CmsPageInput = Partial<Omit<CmsPage, "id" | "updatedAt">>;

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  _count?: { posts: number };
}

export type PostStatus = "draft" | "published" | "scheduled";
export interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  status: PostStatus;
  publishedAt: string | null;
  /** Set while it waits to go live. */
  scheduledAt?: string | null;
  updatedAt: string;
  tags: string[] | null;
  featured: boolean;
  viewCount?: number;
  category: { id: string; name: string; slug: string } | null;
  author: { name: string } | null;
}
export interface BlogPost extends Omit<BlogPostRow, "author"> {
  categoryId: string | null;
  content: string | null;
  seoTitle: string | null;
  metaDesc: string | null;
  /** "Shop this" products, in order. */
  products: { id: string; name: string }[];
}
export interface BlogPostInput {
  title?: string;
  slug?: string;
  categoryId?: string | null;
  excerpt?: string | null;
  content?: string | null;
  featuredImageUrl?: string | null;
  tags?: string[];
  status?: PostStatus;
  scheduledAt?: string | null;
  featured?: boolean;
  productIds?: string[];
  seoTitle?: string | null;
  metaDesc?: string | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
}
export type FaqInput = Omit<Faq, "id">;

export type MenuLocation = "header" | "footer";
export interface MenuLink {
  title: string;
  /** The link's text in Bangla; empty shows `title` to Bangla shoppers too. */
  titleBn?: string;
  url: string;
  openInNewTab: boolean;
}
export interface MenuItem extends MenuLink {
  children: MenuLink[];
}
export interface Menu {
  id: string;
  name: string;
  location: MenuLocation;
  /** The storefront it belongs to; null: the default one (also used by storefronts without their own). */
  storefrontId: string | null;
  items: MenuItem[];
}

export interface ThemeSettings {
  brand: { storeName: string; tagline: string; logoUrl: string | null; faviconUrl?: string | null };
  /** previewKey: made by the API when maintenance is first turned on. */
  maintenance: { enabled: boolean; message: string; previewKey?: string };
  colors: { primary: string; secondary: string };
  announcement: { enabled: boolean; text: string; link: string | null };
  footer: { about: string; address: string; phone: string; email: string; showNewsletter: boolean };
  social: { facebook: string; instagram: string; youtube: string; twitter: string };
  display: { showRating: boolean; showSoldCount: boolean; showLowStock: boolean; lowStockThreshold: number; sizeGuideUrl: string };
  /** Facebook Pixel, Google Analytics 4 and the Search Console code; empty loads nothing. */
  tracking: { googleAnalyticsId: string; facebookPixelId: string; googleVerification: string };
  /** blockAll: hide from search engines; extra: lines added to robots.txt. */
  robots: { blockAll: boolean; extra: string };
}

/** Ready-made colour schemes: the main colour (buttons, links) and a second one (badges, highlights). */
export const COLOR_PRESETS = [
  { name: "Violet & amber", primary: "#7c3aed", secondary: "#f59e0b" },
  { name: "Royal blue & orange", primary: "#2563eb", secondary: "#f97316" },
  { name: "Teal & coral", primary: "#0f766e", secondary: "#fb7185" },
  { name: "Emerald & gold", primary: "#047857", secondary: "#eab308" },
  { name: "Crimson & navy", primary: "#be123c", secondary: "#1e3a8a" },
  { name: "Rose & plum", primary: "#e11d48", secondary: "#7e22ce" },
  { name: "Ocean & sand", primary: "#0369a1", secondary: "#d6b98c" },
  { name: "Charcoal & lime", primary: "#1f2937", secondary: "#84cc16" },
  { name: "Mustard & black", primary: "#ca8a04", secondary: "#111827" },
  { name: "Maroon & cream", primary: "#7f1d1d", secondary: "#f5e6c8" },
] as const;

export const HERO_GRADIENTS = ["violet", "sunset", "midnight", "emerald", "rose", "ocean"] as const;
export const FEATURE_ICONS = ["truck", "shield", "card", "bag", "gift", "phone"] as const;
export interface HeroSlide {
  badge: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  imageUrl: string | null;
  gradient: (typeof HERO_GRADIENTS)[number];
  alignment: "left" | "center" | "right";
}
export interface GalleryImage {
  url: string;
  alt: string;
  link: string | null;
}
export interface TextColumn {
  imageUrl: string | null;
  heading: string;
  text: string;
}
export const RAIL_SORTS = ["popular", "newest", "price_asc", "price_desc", "rating", "discount"] as const;
export interface ProductRailConfig extends HeadingConfig {
  source: "products" | "category" | "tag" | "sale";
  /** Names are only for showing what was picked; the storefront loads the live products. */
  products: { id: string; name: string }[];
  categoryId: string | null;
  tag: string;
  sort: (typeof RAIL_SORTS)[number];
}

export interface HeadingConfig {
  heading: string;
  subheading: string;
  limit: number;
}
export interface ImageConfig {
  imageUrl: string;
  alt: string;
  caption: string;
  link: string | null;
  width: "contained" | "full";
}
export interface ImageTextConfig {
  imageUrl: string | null;
  heading: string;
  text: string;
  ctaText: string;
  ctaHref: string;
  imagePosition: "left" | "right";
}
/** A block on the homepage or a built page. `id` is only used by the editor to track blocks while dragging. */
export type HomepageSection = { id?: string; enabled: boolean } & (
  /** Own slides, or a saved slider (`sliderId`, then `slides` is empty and filled in on the storefront). */
  | { type: "hero"; config: { slides: HeroSlide[]; sliderId?: string } }
  | { type: "features"; config: { items: { icon: (typeof FEATURE_ICONS)[number]; title: string; desc: string }[] } }
  | { type: "categories"; config: HeadingConfig }
  | { type: "featured_products"; config: HeadingConfig }
  | { type: "promo_banner"; config: { badge: string; title: string; text: string; ctaText: string; ctaHref: string } }
  | { type: "new_arrivals"; config: HeadingConfig }
  | { type: "rich_text"; config: { content: string } }
  | { type: "image"; config: ImageConfig }
  | { type: "image_text"; config: ImageTextConfig }
  | { type: "faq"; config: { heading: string; limit: number } }
  | { type: "video"; config: { heading: string; url: string; caption: string } }
  | { type: "gallery"; config: { heading: string; columns: 2 | 3 | 4; images: GalleryImage[] } }
  | { type: "columns"; config: { heading: string; columns: TextColumn[] } }
  | { type: "button"; config: { text: string; href: string; style: "solid" | "outline"; align: "left" | "center" | "right" } }
  | { type: "quote"; config: { text: string; author: string; role: string } }
  | { type: "product_rail"; config: ProductRailConfig }
  | { type: "category_tiles"; config: { heading: string; categoryIds: string[] } }
);
export type HomepageSectionType = HomepageSection["type"];

export interface ListArgs {
  page?: number;
  perPage?: number;
  search?: string;
  status?: PostStatus;
}

/** `?storefrontId=` for a storefront other than the default one. */
const sfParams = (storefrontId?: string) => (storefrontId ? { storefrontId } : undefined);

/** A storefront's home page; `inherited`: it has none of its own and shows the default storefront's. */
export interface HomepageState {
  sections: HomepageSection[];
  customised: boolean;
  inherited?: boolean;
}

const listParams = (a: ListArgs = {}) =>
  Object.fromEntries(Object.entries({ page: 1, perPage: 20, ...a }).filter(([, v]) => v !== undefined && v !== ""));

export const contentApi = api.injectEndpoints({
  endpoints: (b) => ({
    // pages
    getCmsPages: b.query<Paginated<CmsPageRow>, ListArgs | void>({
      query: (a) => ({ url: "/admin/content/pages", params: listParams(a ?? {}) }),
      transformResponse: (items: CmsPageRow[], meta) => toPaginated(items, meta),
      providesTags: ["Page"],
    }),
    getCmsPage: b.query<CmsPage, string>({
      query: (id) => `/admin/content/pages/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Page", id }],
    }),
    createCmsPage: b.mutation<CmsPage, CmsPageInput>({
      query: (body) => ({ url: "/admin/content/pages", method: "POST", body }),
      invalidatesTags: ["Page"],
    }),
    updateCmsPage: b.mutation<CmsPage, { id: string } & CmsPageInput>({
      query: ({ id, ...body }) => ({ url: `/admin/content/pages/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Page"],
    }),
    deleteCmsPage: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/content/pages/${id}`, method: "DELETE" }),
      invalidatesTags: ["Page"],
    }),

    // blog
    getBlogCategories: b.query<BlogCategory[], void>({
      query: () => "/admin/content/blog/categories",
      providesTags: [{ type: "Blog", id: "CATEGORIES" }],
    }),
    createBlogCategory: b.mutation<BlogCategory, Partial<BlogCategory>>({
      query: (body) => ({ url: "/admin/content/blog/categories", method: "POST", body }),
      invalidatesTags: ["Blog"],
    }),
    updateBlogCategory: b.mutation<BlogCategory, { id: string } & Partial<BlogCategory>>({
      query: ({ id, _count: _c, ...body }) => ({ url: `/admin/content/blog/categories/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Blog"],
    }),
    deleteBlogCategory: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/content/blog/categories/${id}`, method: "DELETE" }),
      invalidatesTags: ["Blog"],
    }),
    getBlogPosts: b.query<Paginated<BlogPostRow>, ListArgs | void>({
      query: (a) => ({ url: "/admin/content/blog/posts", params: listParams(a ?? {}) }),
      transformResponse: (items: BlogPostRow[], meta) => toPaginated(items, meta),
      providesTags: ["Blog"],
    }),
    getBlogPost: b.query<BlogPost, string>({
      query: (id) => `/admin/content/blog/posts/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Blog", id }],
    }),
    createBlogPost: b.mutation<BlogPost, BlogPostInput>({
      query: (body) => ({ url: "/admin/content/blog/posts", method: "POST", body }),
      invalidatesTags: ["Blog"],
    }),
    updateBlogPost: b.mutation<BlogPost, { id: string } & BlogPostInput>({
      query: ({ id, ...body }) => ({ url: `/admin/content/blog/posts/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Blog"],
    }),
    deleteBlogPost: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/content/blog/posts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Blog"],
    }),

    // FAQs
    getFaqs: b.query<Faq[], void>({ query: () => "/admin/content/faqs", providesTags: ["Faq"] }),
    createFaq: b.mutation<Faq, FaqInput>({
      query: (body) => ({ url: "/admin/content/faqs", method: "POST", body }),
      invalidatesTags: ["Faq"],
    }),
    updateFaq: b.mutation<Faq, { id: string } & Partial<FaqInput>>({
      query: ({ id, ...body }) => ({ url: `/admin/content/faqs/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Faq"],
    }),
    deleteFaq: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/content/faqs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Faq"],
    }),

    // menus
    getMenus: b.query<Menu[], void>({ query: () => "/admin/content/menus", providesTags: ["Menu"] }),
    createMenu: b.mutation<Menu, { name: string; location: MenuLocation; storefrontId?: string | null }>({
      query: (body) => ({ url: "/admin/content/menus", method: "POST", body }),
      invalidatesTags: ["Menu"],
    }),
    updateMenu: b.mutation<Menu, { id: string; name?: string; location?: MenuLocation; storefrontId?: string | null }>({
      query: ({ id, ...body }) => ({ url: `/admin/content/menus/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Menu"],
    }),
    saveMenuItems: b.mutation<Menu, { id: string; items: MenuItem[] }>({
      query: ({ id, items }) => ({ url: `/admin/content/menus/${id}/items`, method: "PUT", body: { items } }),
      invalidatesTags: ["Menu"],
    }),
    deleteMenu: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/content/menus/${id}`, method: "DELETE" }),
      invalidatesTags: ["Menu"],
    }),

    // theme + homepage
    // `storefrontId` undefined: the default storefront (whose look and home page the others fall back to).
    getTheme: b.query<ThemeSettings, string | undefined>({
      query: (storefrontId) => ({ url: "/admin/content/theme", params: sfParams(storefrontId) }),
      providesTags: ["Theme"],
    }),
    saveTheme: b.mutation<ThemeSettings, { theme: ThemeSettings; storefrontId?: string }>({
      query: ({ theme, storefrontId }) => ({ url: "/admin/content/theme", method: "PUT", body: theme, params: sfParams(storefrontId) }),
      invalidatesTags: ["Theme", { type: "Store", id: "STOREFRONTS" }],
    }),
    resetTheme: b.mutation<ThemeSettings, string>({
      query: (storefrontId) => ({ url: "/admin/content/theme", method: "DELETE", params: { storefrontId } }),
      invalidatesTags: ["Theme", { type: "Store", id: "STOREFRONTS" }],
    }),
    getHomepage: b.query<HomepageState, string | undefined>({
      query: (storefrontId) => ({ url: "/admin/content/homepage", params: sfParams(storefrontId) }),
      providesTags: ["Homepage"],
    }),
    saveHomepage: b.mutation<HomepageState, { sections: HomepageSection[]; storefrontId?: string }>({
      query: ({ sections, storefrontId }) => ({ url: "/admin/content/homepage", method: "PUT", body: { sections }, params: sfParams(storefrontId) }),
      invalidatesTags: ["Homepage", { type: "Store", id: "STOREFRONTS" }],
    }),
    resetHomepage: b.mutation<HomepageState, string | undefined>({
      query: (storefrontId) => ({ url: "/admin/content/homepage", method: "DELETE", params: sfParams(storefrontId) }),
      invalidatesTags: ["Homepage", { type: "Store", id: "STOREFRONTS" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useResetThemeMutation,
  useGetCmsPagesQuery,
  useGetCmsPageQuery,
  useCreateCmsPageMutation,
  useUpdateCmsPageMutation,
  useDeleteCmsPageMutation,
  useGetBlogCategoriesQuery,
  useCreateBlogCategoryMutation,
  useUpdateBlogCategoryMutation,
  useDeleteBlogCategoryMutation,
  useGetBlogPostsQuery,
  useGetBlogPostQuery,
  useCreateBlogPostMutation,
  useUpdateBlogPostMutation,
  useDeleteBlogPostMutation,
  useGetFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  useGetMenusQuery,
  useCreateMenuMutation,
  useUpdateMenuMutation,
  useSaveMenuItemsMutation,
  useDeleteMenuMutation,
  useGetThemeQuery,
  useSaveThemeMutation,
  useGetHomepageQuery,
  useSaveHomepageMutation,
  useResetHomepageMutation,
} = contentApi;

/** Error text from a failed mutation, for toasts and inline form errors. */
export function errorText(err: unknown, fallback = "Something went wrong."): string {
  const e = err as { data?: { message?: string; errors?: Record<string, string[]> } };
  const field = e?.data?.errors && Object.entries(e.data.errors)[0];
  if (field) return `${field[0]}: ${field[1][0]}`;
  return e?.data?.message || fallback;
}
