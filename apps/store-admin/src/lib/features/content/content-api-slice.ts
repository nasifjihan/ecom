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

export type PostStatus = "draft" | "published";
export interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
  tags: string[] | null;
  category: { id: string; name: string; slug: string } | null;
  author: { name: string } | null;
}
export interface BlogPost extends Omit<BlogPostRow, "author"> {
  categoryId: string | null;
  content: string | null;
  seoTitle: string | null;
  metaDesc: string | null;
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
  items: MenuItem[];
}

export interface ThemeSettings {
  brand: { storeName: string; tagline: string; logoUrl: string | null };
  colors: { primary: string };
  announcement: { enabled: boolean; text: string; link: string | null };
  footer: { about: string; address: string; phone: string; email: string; showNewsletter: boolean };
  social: { facebook: string; instagram: string; youtube: string; twitter: string };
}

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
  | { type: "hero"; config: { slides: HeroSlide[] } }
  | { type: "features"; config: { items: { icon: (typeof FEATURE_ICONS)[number]; title: string; desc: string }[] } }
  | { type: "categories"; config: HeadingConfig }
  | { type: "featured_products"; config: HeadingConfig }
  | { type: "promo_banner"; config: { badge: string; title: string; text: string; ctaText: string; ctaHref: string } }
  | { type: "new_arrivals"; config: HeadingConfig }
  | { type: "rich_text"; config: { content: string } }
  | { type: "image"; config: ImageConfig }
  | { type: "image_text"; config: ImageTextConfig }
  | { type: "faq"; config: { heading: string; limit: number } }
);
export type HomepageSectionType = HomepageSection["type"];

export interface ListArgs {
  page?: number;
  perPage?: number;
  search?: string;
  status?: PostStatus;
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
    createMenu: b.mutation<Menu, { name: string; location: MenuLocation }>({
      query: (body) => ({ url: "/admin/content/menus", method: "POST", body }),
      invalidatesTags: ["Menu"],
    }),
    updateMenu: b.mutation<Menu, { id: string; name?: string; location?: MenuLocation }>({
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
    getTheme: b.query<ThemeSettings, void>({ query: () => "/admin/content/theme", providesTags: ["Theme"] }),
    saveTheme: b.mutation<ThemeSettings, ThemeSettings>({
      query: (body) => ({ url: "/admin/content/theme", method: "PUT", body }),
      invalidatesTags: ["Theme"],
    }),
    getHomepage: b.query<{ sections: HomepageSection[]; customised: boolean }, void>({
      query: () => "/admin/content/homepage",
      providesTags: ["Homepage"],
    }),
    saveHomepage: b.mutation<{ sections: HomepageSection[]; customised: boolean }, HomepageSection[]>({
      query: (sections) => ({ url: "/admin/content/homepage", method: "PUT", body: { sections } }),
      invalidatesTags: ["Homepage"],
    }),
    resetHomepage: b.mutation<{ sections: HomepageSection[]; customised: boolean }, void>({
      query: () => ({ url: "/admin/content/homepage", method: "DELETE" }),
      invalidatesTags: ["Homepage"],
    }),
  }),
  overrideExisting: false,
});

export const {
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
