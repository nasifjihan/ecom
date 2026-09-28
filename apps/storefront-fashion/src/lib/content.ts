/**
 * Store content from the API (/storefront/content/*): theme, menus, pages, blog, FAQs
 * and homepage sections. Server-side only; pages re-fetch at most once a minute.
 */
import { cookieLocale, serverApi, storeOrigin, withLang } from "@/lib/server-api";
import type { SlotPromotion } from "@/lib/promotions";
import { DATE_LOCALES, translatorFor, type Locale, type Translator } from "@ecom/storefront-base";

export interface ThemeSettings {
  brand: { storeName: string; tagline: string; logoUrl: string | null };
  colors: { primary: string };
  announcement: { enabled: boolean; text: string; link: string | null };
  footer: { about: string; address: string; phone: string; email: string; showNewsletter: boolean };
  social: { facebook: string; instagram: string; youtube: string; twitter: string };
}

export interface MenuLink {
  title: string;
  url: string;
  openInNewTab: boolean;
  children?: MenuLink[];
}

export interface SiteContent {
  theme: ThemeSettings;
  /** Languages the storefront offers and the one it opens in. */
  languages?: { enabled: Locale[]; default: Locale };
  headerMenu: MenuLink[] | null;
  footerMenus: { title: string; links: MenuLink[] }[];
  footerPages: { title: string; url: string }[];
}

export interface CmsPage {
  title: string;
  slug: string;
  content: string | null;
  /** "sections" pages are built from blocks in the admin; "text" pages show `content`. */
  template: "text" | "sections";
  sections: HomepageSection[];
  seoTitle: string | null;
  metaDesc: string | null;
  updatedAt: string;
}

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  tags: string[] | null;
  category: { name: string; slug: string } | null;
  author: { name: string } | null;
}
export interface BlogPost extends BlogPostSummary {
  content: string | null;
  seoTitle: string | null;
  metaDesc: string | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

/** A block on the homepage or on a page built from blocks. */
export type HomepageSection = { id?: string; enabled: boolean } & (
  | { type: "hero"; config: { slides: HeroSlideConfig[] } }
  | { type: "features"; config: { items: { icon: string; title: string; desc: string }[] } }
  | { type: "categories"; config: HeadingConfig }
  | { type: "featured_products"; config: HeadingConfig }
  | { type: "new_arrivals"; config: HeadingConfig }
  | { type: "promo_banner"; config: { badge: string; title: string; text: string; ctaText: string; ctaHref: string } }
  | { type: "rich_text"; config: { content: string } }
  | { type: "image"; config: { imageUrl: string; alt: string; caption: string; link: string | null; width: "contained" | "full" } }
  | {
      type: "image_text";
      config: { imageUrl: string | null; heading: string; text: string; ctaText: string; ctaHref: string; imagePosition: "left" | "right" };
    }
  | { type: "faq"; config: { heading: string; limit: number } }
);

export interface HeadingConfig {
  heading: string;
  subheading: string;
  limit: number;
}

export interface HeroSlideConfig {
  badge: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  imageUrl: string | null;
  gradient: string;
  alignment: "left" | "center" | "right";
}

const REVALIDATE = 60;

export const getSite = () => serverApi<SiteContent>("/storefront/content/site", REVALIDATE);
export const getHomepage = () => serverApi<HomepageSection[]>("/storefront/content/homepage", REVALIDATE);
export const getCmsPage = (slug: string) => serverApi<CmsPage>(`/storefront/content/pages/${encodeURIComponent(slug)}`, REVALIDATE);
export const getCmsPages = () => serverApi<{ slug: string; title: string; updatedAt: string }[]>("/storefront/content/pages", REVALIDATE);
export const getFaqs = () => serverApi<Faq[]>("/storefront/content/faqs", REVALIDATE);
export const getBlogCategories = () => serverApi<{ name: string; slug: string }[]>("/storefront/content/blog/categories", REVALIDATE);
export const getBlogPost = (slug: string) => serverApi<BlogPost>(`/storefront/content/blog/${encodeURIComponent(slug)}`, REVALIDATE);

/** The blog list keeps its pagination meta, which serverApi drops, so it fetches directly. */
export async function getBlogPosts(page = 1, category?: string, perPage = 9) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage), ...(category ? { category } : {}) });
  return serverApiWithMeta<BlogPostSummary[]>(`/storefront/content/blog?${params}`);
}

const API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function serverApiWithMeta<T>(path: string): Promise<{ data: T; meta: { page: number; totalPages: number; total: number } } | null> {
  const url = `${API_BASE}${await withLang(path)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", Origin: await storeOrigin() },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? { data: body.data as T, meta: body.meta } : null;
  } catch {
    return null;
  }
}

/** "#7c3aed" -> "262 83% 58%", the format the Tailwind colour variables use. */
export function hexToHslVar(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const formatDate = (iso: string | null | undefined, locale: Locale = "en") =>
  iso ? new Date(iso).toLocaleDateString(DATE_LOCALES[locale], { day: "numeric", month: "long", year: "numeric" }) : "";

/** Live promotions for a display slot (Marketing > Promotions in the admin). */
export async function getSlotPromotions(slot: SlotPromotion["slots"][number]) {
  return (await serverApi<SlotPromotion[]>(`/storefront/promotions?slot=${encodeURIComponent(slot)}`)) ?? [];
}

/** The page's language: the shopper's choice when the shop offers it, else the shop's default. */
export async function pageLocale(): Promise<Locale> {
  const [chosen, site] = await Promise.all([cookieLocale(), getSite()]);
  const offered = site?.languages?.enabled ?? ["en"];
  if (chosen && offered.includes(chosen)) return chosen;
  return site?.languages?.default ?? "en";
}

/** `t()` for server components, in the page's language. */
export async function serverT(): Promise<Translator> {
  return translatorFor(await pageLocale());
}
