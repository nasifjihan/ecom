/**
 * HOMEPAGE SECTION REGISTRY
 * The dnd-kit page builder renders a list of { type, props } JSON sections.
 * This maps section "type" string → React component.
 * Each new section we add to the page builder: 1) build the component under sections/, 2) add entry here.
 */
import type { ComponentType } from "react";

export type SectionComponentProps<T = unknown> = {
  data: T;
  storeId: bigint;
  storeName: string;
};

export type SectionDef<T = unknown> = {
  type: string;
  label: string;
  description: string;
  defaultProps: T;
  Component: ComponentType<SectionComponentProps<T>>;
};

const PLACEHOLDER = () => null;

export const SECTION_REGISTRY: Record<string, SectionDef> = {
  hero: {
    type: "hero",
    label: "Hero / Slideshow",
    description: "Full-width banner with text, CTA, and image or Swiper carousel",
    defaultProps: { slides: [], height: 600, autoPlay: true },
    Component: PLACEHOLDER,
  },
  announcement: {
    type: "announcement",
    label: "Announcement Bar",
    description: "Top text banner (free shipping, coupon, countdown)",
    defaultProps: { text: "🎉 Free shipping over ৳2000 inside Dhaka", link: "/promotions" },
    Component: PLACEHOLDER,
  },
  categories_carousel: {
    type: "categories_carousel",
    label: "Categories Carousel",
    description: "Circular/rectangular category tiles carousel",
    defaultProps: { categoryIds: [] as bigint[], layout: "circles" },
    Component: PLACEHOLDER,
  },
  featured_products: {
    type: "featured_products",
    label: "Featured Products Grid",
    description: "Section heading + product cards grid (tag based or manual)",
    defaultProps: { heading: "Featured Products", tag: "featured", productIds: [] as bigint[], cols: 5 },
    Component: PLACEHOLDER,
  },
  flash_sale: {
    type: "flash_sale",
    label: "Flash Sale (countdown)",
    description: "Time-limited sale banner with countdown",
    defaultProps: { endsAt: "", heading: "Flash Sale" },
    Component: PLACEHOLDER,
  },
  cms_brands: {
    type: "cms_brands",
    label: "Brands Logo Strip",
    description: "Horizontal logo carousel of supported brands",
    defaultProps: { title: "Shop by Brand" },
    Component: PLACEHOLDER,
  },
  promo_banners: {
    type: "promo_banners",
    label: "Promotional Banners 2/3-col",
    description: "Multi-column promo banners linking to category pages",
    defaultProps: { columns: 3 },
    Component: PLACEHOLDER,
  },
  testimonials: {
    type: "testimonials",
    label: "Testimonials",
    description: "Customer review cards carousel",
    defaultProps: {},
    Component: PLACEHOLDER,
  },
  blog_preview: {
    type: "blog_preview",
    label: "Latest Blog Posts",
    description: "3 or 4 column latest blog cards",
    defaultProps: { limit: 4 },
    Component: PLACEHOLDER,
  },
  newsletter: {
    type: "newsletter",
    label: "Newsletter Subscription",
    description: "Capture emails with discount incentive",
    defaultProps: { title: "Get 10% OFF", subheading: "Subscribe to our newsletter" },
    Component: PLACEHOLDER,
  },
  features: {
    type: "features",
    label: "Why Choose Us (features)",
    description: "4 icons: free shipping, return, support, secure pay",
    defaultProps: {},
    Component: PLACEHOLDER,
  },
  rich_text: {
    type: "rich_text",
    label: "Custom Rich Text / HTML",
    description: "Arbitrary rich content block",
    defaultProps: { html: "" },
    Component: PLACEHOLDER,
  },
};
