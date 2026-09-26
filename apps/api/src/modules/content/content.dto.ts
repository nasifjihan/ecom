import { z } from "zod"

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
const text = (max: number) => z.string().trim().max(max)
const optText = (max: number) => text(max).optional().nullable()
/** Site-relative paths ("/faq") or absolute http(s) URLs. */
const link = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
    "Use a path like /faq or a full https:// link",
  )
const optLink = link.optional().nullable()

export const IdParamDto = z.object({ id: z.coerce.bigint().positive() })
export const SlugParamDto = z.object({ slug: z.string().trim().min(1).max(160) })

export const ListQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published"]).optional(),
  category: z.string().trim().max(120).optional(),
})
export type ListQueryDto = z.infer<typeof ListQueryDto>

/* ------------------------------ Pages ------------------------------ */

export const CreatePageDto = z.object({
  title: text(200).min(1),
  slug: slug.optional(),
  content: text(100_000).optional().nullable(),
  isPublished: z.boolean().default(true),
  showInFooterMenu: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  seoTitle: optText(200),
  metaDesc: optText(320),
  /** "text" pages show `content` (Markdown); "sections" pages are built from `sections`. */
  template: z.enum(["text", "sections"]).default("text"),
  sections: z
    .lazy(() => z.array(SectionDto).max(30))
    .optional()
    .nullable(),
})
export const UpdatePageDto = CreatePageDto.partial()
export type CreatePageDto = z.infer<typeof CreatePageDto>
export type UpdatePageDto = z.infer<typeof UpdatePageDto>

/* ------------------------------ Blog ------------------------------ */

export const BlogCategoryDto = z.object({
  name: text(120).min(1),
  slug: slug.optional(),
  description: optText(500),
  isActive: z.boolean().default(true),
})
export const UpdateBlogCategoryDto = BlogCategoryDto.partial()
export type BlogCategoryDto = z.infer<typeof BlogCategoryDto>

export const CreatePostDto = z.object({
  title: text(200).min(1),
  slug: slug.optional(),
  categoryId: z.coerce.bigint().positive().optional().nullable(),
  excerpt: optText(500),
  content: text(200_000).optional().nullable(),
  featuredImageUrl: optLink,
  tags: z.array(text(40).min(1)).max(20).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  seoTitle: optText(200),
  metaDesc: optText(320),
})
export const UpdatePostDto = CreatePostDto.partial()
export type CreatePostDto = z.infer<typeof CreatePostDto>
export type UpdatePostDto = z.infer<typeof UpdatePostDto>

/* ------------------------------ FAQ ------------------------------ */

export const FaqDto = z.object({
  question: text(500).min(3),
  answer: text(10_000).min(1),
  category: optText(80),
  sortOrder: z.coerce.number().int().default(0),
  isPublished: z.boolean().default(true),
})
export const UpdateFaqDto = FaqDto.partial()
export type FaqDto = z.infer<typeof FaqDto>

/* ------------------------------ Menus ------------------------------ */

export const MENU_LOCATIONS = ["header", "footer"] as const

export const MenuDto = z.object({
  name: text(80).min(1),
  location: z.enum(MENU_LOCATIONS),
})
export const UpdateMenuDto = MenuDto.partial()
export type MenuDto = z.infer<typeof MenuDto>

const MenuLeaf = z.object({
  title: text(80).min(1),
  url: link.refine((v) => v !== "", "Link is required"),
  openInNewTab: z.boolean().default(false),
})
export const MenuItemsDto = z.object({
  items: z.array(MenuLeaf.extend({ children: z.array(MenuLeaf).max(30).default([]) })).max(30),
})
export type MenuItemsDto = z.infer<typeof MenuItemsDto>

/* ------------------------------ Theme ------------------------------ */

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, "Use a colour like #7c3aed")

export const ThemeDto = z.object({
  brand: z.object({ storeName: text(80).min(1), tagline: text(160), logoUrl: optLink }),
  colors: z.object({ primary: hex }),
  announcement: z.object({ enabled: z.boolean(), text: text(200), link: optLink }),
  footer: z.object({
    about: text(500),
    address: text(200),
    phone: text(40),
    email: text(120),
    showNewsletter: z.boolean(),
  }),
  social: z.object({ facebook: link, instagram: link, youtube: link, twitter: link }),
})
export type ThemeSettings = z.infer<typeof ThemeDto>

/* ------------------------------ Homepage ------------------------------ */

const Heading = { heading: text(120), subheading: text(240) }
const Count = z.coerce.number().int().min(2).max(24)

export const HeroSlideDto = z.object({
  badge: text(60),
  title: text(160).min(1),
  subtitle: text(300),
  ctaText: text(40),
  ctaHref: link,
  imageUrl: optLink,
  gradient: z.enum(["violet", "sunset", "midnight", "emerald", "rose", "ocean"]),
  alignment: z.enum(["left", "center", "right"]),
})

export const FEATURE_ICONS = ["truck", "shield", "card", "bag", "gift", "phone"] as const

export const HomepageSectionDto = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    enabled: z.boolean(),
    config: z.object({ slides: z.array(HeroSlideDto).min(1).max(8) }),
  }),
  z.object({
    type: z.literal("features"),
    enabled: z.boolean(),
    config: z.object({
      items: z
        .array(z.object({ icon: z.enum(FEATURE_ICONS), title: text(60).min(1), desc: text(160) }))
        .min(1)
        .max(8),
    }),
  }),
  z.object({
    type: z.literal("categories"),
    enabled: z.boolean(),
    config: z.object({ ...Heading, limit: Count }),
  }),
  z.object({
    type: z.literal("featured_products"),
    enabled: z.boolean(),
    config: z.object({ ...Heading, limit: Count }),
  }),
  z.object({
    type: z.literal("promo_banner"),
    enabled: z.boolean(),
    config: z.object({
      badge: text(60),
      title: text(160).min(1),
      text: text(300),
      ctaText: text(40),
      ctaHref: link,
    }),
  }),
  z.object({
    type: z.literal("new_arrivals"),
    enabled: z.boolean(),
    config: z.object({ ...Heading, limit: Count }),
  }),
  z.object({
    type: z.literal("rich_text"),
    enabled: z.boolean(),
    config: z.object({ content: text(50_000) }),
  }),
  z.object({
    type: z.literal("image"),
    enabled: z.boolean(),
    config: z.object({
      imageUrl: link.refine((v) => v !== "", "Choose an image"),
      alt: text(200),
      caption: text(300),
      link: optLink,
      width: z.enum(["contained", "full"]),
    }),
  }),
  z.object({
    type: z.literal("image_text"),
    enabled: z.boolean(),
    config: z.object({
      imageUrl: optLink,
      heading: text(160),
      text: text(5_000),
      ctaText: text(40),
      ctaHref: link,
      imagePosition: z.enum(["left", "right"]),
    }),
  }),
  z.object({
    type: z.literal("faq"),
    enabled: z.boolean(),
    config: z.object({ heading: text(120), limit: z.coerce.number().int().min(1).max(50) }),
  }),
])
/** Sections carry an optional client id so the editors can track them while reordering. */
export const SectionDto = z.intersection(
  HomepageSectionDto,
  z.object({ id: z.string().max(40).optional() }),
)
export type HomepageSection = z.infer<typeof HomepageSectionDto>
export type HomepageSectionType = HomepageSection["type"]

export const HomepageDto = z.object({ sections: z.array(SectionDto).max(30) })
