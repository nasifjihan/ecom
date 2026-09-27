/**
 * What a store shows before its owner customises anything. The storefront always
 * gets a complete theme and homepage: saved values are merged over these.
 */
import type { HomepageSection, ThemeSettings } from "./content.dto"

export function defaultTheme(store: {
  name: string
  tagline?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}): ThemeSettings {
  return {
    brand: { storeName: store.name, tagline: store.tagline ?? "", logoUrl: null },
    colors: { primary: "#7c3aed" },
    announcement: {
      enabled: false,
      text: "Free delivery on orders above ৳1000",
      link: "/products",
    },
    footer: {
      about: store.tagline?.trim()
        ? store.tagline
        : `Shop the latest collection at ${store.name}. Cash on delivery across Bangladesh.`,
      address: store.address ?? "",
      phone: store.phone ?? "",
      email: store.email ?? "",
      showNewsletter: true,
    },
    social: { facebook: "", instagram: "", youtube: "", twitter: "" },
  }
}

export const DEFAULT_HOMEPAGE: HomepageSection[] = [
  {
    type: "hero",
    enabled: true,
    config: {
      slides: [
        {
          badge: "New Season",
          title: "Fresh styles for every day",
          subtitle:
            "Discover the new collection for men, women and kids, with delivery across Bangladesh.",
          ctaText: "Shop Now",
          ctaHref: "/products",
          imageUrl: null,
          gradient: "violet",
          alignment: "left",
        },
        {
          badge: "Just In",
          title: "New arrivals every week",
          subtitle: "Be the first to shop the latest drops.",
          ctaText: "See what's new",
          ctaHref: "/products?sort=newest",
          imageUrl: null,
          gradient: "midnight",
          alignment: "center",
        },
      ],
    },
  },
  {
    type: "features",
    enabled: true,
    config: {
      items: [
        { icon: "truck", title: "Fast Delivery", desc: "Delivery to all 64 districts" },
        { icon: "shield", title: "Easy Returns", desc: "7-day return policy" },
        { icon: "card", title: "Secure Payment", desc: "Cash on delivery, bKash, Nagad and cards" },
        { icon: "bag", title: "Authentic Products", desc: "Quality checked before dispatch" },
      ],
    },
  },
  {
    type: "categories",
    enabled: true,
    config: { heading: "Shop by Category", subheading: "Find exactly what you need", limit: 8 },
  },
  {
    type: "featured_products",
    enabled: true,
    config: {
      heading: "Featured Products",
      subheading: "Handpicked bestsellers our customers love",
      limit: 8,
    },
  },
  {
    type: "promo_banner",
    enabled: true,
    config: {
      badge: "Limited Time",
      title: "Free delivery on orders above ৳1000",
      text: "Nationwide delivery across Bangladesh.",
      ctaText: "Shop Now",
      ctaHref: "/products",
    },
  },
  {
    type: "new_arrivals",
    enabled: true,
    config: { heading: "New Arrivals", subheading: "Fresh styles, just landed", limit: 8 },
  },
]

/** Shallow-merge each group so a theme saved before a new field existed still gets that field. */
export function mergeTheme(base: ThemeSettings, saved: unknown): ThemeSettings {
  if (!saved || typeof saved !== "object") return base
  const s = saved as Partial<Record<keyof ThemeSettings, object>>
  return {
    brand: { ...base.brand, ...(s.brand ?? {}) },
    colors: { ...base.colors, ...(s.colors ?? {}) },
    announcement: { ...base.announcement, ...(s.announcement ?? {}) },
    footer: { ...base.footer, ...(s.footer ?? {}) },
    social: { ...base.social, ...(s.social ?? {}) },
  }
}
