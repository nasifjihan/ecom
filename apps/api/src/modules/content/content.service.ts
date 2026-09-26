/**
 * CONTENT: CMS pages, blog, FAQs, menus, theme settings and homepage sections.
 *
 * One service serves both sides: the store admin edits (ctx.storeId from the
 * admin session) and the public storefront reads (ctx.storeId from the Origin),
 * where only published content is returned.
 */
import { Prisma } from "@prisma/client"
import { slugify } from "@ecom/utils"
import { prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { DEFAULT_HOMEPAGE, defaultTheme, mergeTheme } from "./content.defaults"
import {
  HomepageSectionDto,
  SectionDto,
  type BlogCategoryDto,
  type CreatePageDto,
  type CreatePostDto,
  type FaqDto,
  type HomepageSection,
  type ListQueryDto,
  type MenuDto,
  type MenuItemsDto,
  type ThemeSettings,
  type UpdatePageDto,
  type UpdatePostDto,
} from "./content.dto"

const THEME_SLUG = "default"
const pageMeta = (page: number, perPage: number, total: number) => ({
  page,
  perPage,
  total,
  totalPages: Math.max(1, Math.ceil(total / perPage)),
})

/** Prisma's unique-violation code, raised when a slug is already taken in this store. */
const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"

export class ContentService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) {
      throw new BadRequestError(
        "Could not resolve which store this request belongs to",
        "TENANT_NOT_RESOLVED",
      )
    }
    return BigInt(this.ctx.storeId)
  }

  /** Runs a write and turns a duplicate slug into a 409 the admin form can show. */
  private async uniqueSlug<T>(what: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictError(`Another ${what} already uses this URL slug`, "DUPLICATE_SLUG")
      throw e
    }
  }

  // ------------------------------------------------------------------ pages

  async listPages(q: ListQueryDto) {
    const where: Prisma.CmsPageWhereInput = {
      storeId: this.storeId,
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: "insensitive" } },
              { slug: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.status ? { isPublished: q.status === "published" } : {}),
    }
    const [total, items] = await Promise.all([
      prisma.cmsPage.count({ where }),
      prisma.cmsPage.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          title: true,
          slug: true,
          isPublished: true,
          showInFooterMenu: true,
          sortOrder: true,
          template: true,
          updatedAt: true,
        },
      }),
    ])
    return { items, meta: pageMeta(q.page, q.perPage, total) }
  }

  async getPage(id: bigint) {
    const page = await prisma.cmsPage.findFirst({ where: { id, storeId: this.storeId } })
    if (!page) throw new NotFoundError("page")
    return page
  }

  /** Prisma needs DbNull (not null) to clear a Json column. */
  private pageData<T extends UpdatePageDto>(d: T) {
    const { sections, ...rest } = d
    return {
      ...rest,
      ...(sections === undefined
        ? {}
        : { sections: sections === null ? Prisma.DbNull : (sections as Prisma.InputJsonValue) }),
    }
  }

  createPage(d: CreatePageDto) {
    return this.uniqueSlug("page", () =>
      prisma.cmsPage.create({
        data: {
          ...this.pageData(d),
          title: d.title,
          slug: d.slug ?? slugify(d.title),
          storeId: this.storeId,
        },
      }),
    )
  }

  async updatePage(id: bigint, d: UpdatePageDto) {
    await this.getPage(id)
    return this.uniqueSlug("page", () =>
      prisma.cmsPage.update({ where: { id }, data: this.pageData(d) }),
    )
  }

  async deletePage(id: bigint) {
    await this.getPage(id)
    await prisma.cmsPage.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ------------------------------------------------------------------ blog

  listBlogCategories() {
    return prisma.blogCategory.findMany({
      where: { storeId: this.storeId },
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    })
  }

  private async blogCategory(id: bigint) {
    const c = await prisma.blogCategory.findFirst({ where: { id, storeId: this.storeId } })
    if (!c) throw new NotFoundError("blog category")
    return c
  }

  createBlogCategory(d: BlogCategoryDto) {
    return this.uniqueSlug("category", () =>
      prisma.blogCategory.create({
        data: { ...d, slug: d.slug ?? slugify(d.name), storeId: this.storeId },
      }),
    )
  }

  async updateBlogCategory(id: bigint, d: Partial<BlogCategoryDto>) {
    await this.blogCategory(id)
    return this.uniqueSlug("category", () => prisma.blogCategory.update({ where: { id }, data: d }))
  }

  async deleteBlogCategory(id: bigint) {
    await this.blogCategory(id)
    await prisma.blogCategory.delete({ where: { id } }) // posts keep existing, uncategorised (onDelete: SetNull)
    return { id, deleted: true }
  }

  private postRow = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    featuredImageUrl: true,
    status: true,
    publishedAt: true,
    updatedAt: true,
    tags: true,
    category: { select: { id: true, name: true, slug: true } },
    author: { select: { name: true } },
  } satisfies Prisma.BlogPostSelect

  async listPosts(q: ListQueryDto) {
    const where: Prisma.BlogPostWhereInput = {
      storeId: this.storeId,
      ...(q.search ? { title: { contains: q.search, mode: "insensitive" } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: { slug: q.category } } : {}),
    }
    const [total, items] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: this.postRow,
      }),
    ])
    return { items, meta: pageMeta(q.page, q.perPage, total) }
  }

  async getPost(id: bigint) {
    const post = await prisma.blogPost.findFirst({
      where: { id, storeId: this.storeId },
      include: { category: { select: { id: true, name: true, slug: true } } },
    })
    if (!post) throw new NotFoundError("post")
    return post
  }

  private async checkCategory(categoryId: bigint | null | undefined) {
    if (categoryId) await this.blogCategory(categoryId)
  }

  async createPost(d: CreatePostDto) {
    await this.checkCategory(d.categoryId)
    const { tags, ...rest } = d
    return this.uniqueSlug("post", () =>
      prisma.blogPost.create({
        data: {
          ...rest,
          tags: tags ?? [],
          slug: d.slug ?? slugify(d.title),
          storeId: this.storeId,
          authorId: this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null,
          publishedAt: d.status === "published" ? new Date() : null,
        },
      }),
    )
  }

  async updatePost(id: bigint, d: UpdatePostDto) {
    const current = await this.getPost(id)
    await this.checkCategory(d.categoryId)
    const firstPublish = d.status === "published" && !current.publishedAt
    return this.uniqueSlug("post", () =>
      prisma.blogPost.update({
        where: { id },
        data: { ...d, ...(firstPublish ? { publishedAt: new Date() } : {}) },
      }),
    )
  }

  async deletePost(id: bigint) {
    await this.getPost(id)
    await prisma.blogPost.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ------------------------------------------------------------------ FAQ

  listFaqs(publishedOnly = false) {
    return prisma.faq.findMany({
      where: { storeId: this.storeId, ...(publishedOnly ? { isPublished: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sortOrder: true,
        isPublished: true,
      },
    })
  }

  private async faq(id: bigint) {
    const f = await prisma.faq.findFirst({ where: { id, storeId: this.storeId } })
    if (!f) throw new NotFoundError("FAQ")
    return f
  }

  createFaq(d: FaqDto) {
    return prisma.faq.create({ data: { ...d, storeId: this.storeId } })
  }

  async updateFaq(id: bigint, d: Partial<FaqDto>) {
    await this.faq(id)
    return prisma.faq.update({ where: { id }, data: d })
  }

  async deleteFaq(id: bigint) {
    await this.faq(id)
    await prisma.faq.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ------------------------------------------------------------------ menus

  private static itemSelect = {
    id: true,
    title: true,
    url: true,
    openInNewTab: true,
    sortOrder: true,
    parentId: true,
  } as const

  /** Items come back as a two-level tree in display order. */
  private toTree(
    items: {
      id: bigint
      title: string
      url: string | null
      openInNewTab: boolean
      sortOrder: number
      parentId: bigint | null
    }[],
  ) {
    const byOrder = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
    const leaf = (i: (typeof items)[number]) => ({
      title: i.title,
      url: i.url ?? "/",
      openInNewTab: i.openInNewTab,
    })
    return byOrder
      .filter((i) => i.parentId === null)
      .map((root) => ({
        ...leaf(root),
        children: byOrder.filter((c) => c.parentId === root.id).map(leaf),
      }))
  }

  async listMenus() {
    const menus = await prisma.menu.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ location: "desc" }, { createdAt: "asc" }],
      include: { items: { select: ContentService.itemSelect } },
    })
    return menus.map(({ items, ...m }) => ({ ...m, items: this.toTree(items) }))
  }

  async getMenu(id: bigint) {
    const menu = await prisma.menu.findFirst({
      where: { id, storeId: this.storeId },
      include: { items: { select: ContentService.itemSelect } },
    })
    if (!menu) throw new NotFoundError("menu")
    const { items, ...m } = menu
    return { ...m, items: this.toTree(items) }
  }

  private async assertOneHeader(location: string, exceptId?: bigint) {
    if (location !== "header") return
    const other = await prisma.menu.findFirst({
      where: {
        storeId: this.storeId,
        location: "header",
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    })
    if (other) throw new ConflictError(`"${other.name}" is already the header menu`, "CONFLICT")
  }

  async createMenu(d: MenuDto) {
    await this.assertOneHeader(d.location)
    const menu = await prisma.menu.create({ data: { ...d, storeId: this.storeId } })
    return { ...menu, items: [] }
  }

  async updateMenu(id: bigint, d: Partial<MenuDto>) {
    await this.getMenu(id)
    if (d.location) await this.assertOneHeader(d.location, id)
    await prisma.menu.update({ where: { id }, data: d })
    return this.getMenu(id)
  }

  async deleteMenu(id: bigint) {
    await this.getMenu(id)
    await prisma.menu.delete({ where: { id } })
    return { id, deleted: true }
  }

  /** Replaces the whole item tree, which is how the admin editor saves. */
  async setMenuItems(id: bigint, d: MenuItemsDto) {
    await this.getMenu(id)
    await prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({ where: { menuId: id } })
      for (const [i, item] of d.items.entries()) {
        const root = await tx.menuItem.create({
          data: {
            menuId: id,
            type: "link",
            title: item.title,
            url: item.url,
            openInNewTab: item.openInNewTab,
            sortOrder: i,
          },
        })
        if (item.children.length) {
          await tx.menuItem.createMany({
            data: item.children.map((c, j) => ({
              menuId: id,
              parentId: root.id,
              type: "link",
              title: c.title,
              url: c.url,
              openInNewTab: c.openInNewTab,
              sortOrder: j,
            })),
          })
        }
      }
    })
    return this.getMenu(id)
  }

  // ------------------------------------------------------------------ theme

  private async themeDefaults() {
    const store = await prisma.store.findUnique({
      where: { id: this.storeId },
      include: { generalSettings: true },
    })
    if (!store) throw new NotFoundError("store")
    const g = store.generalSettings
    const address = [g?.addressLine1, g?.addressLine2, g?.city].filter(Boolean).join(", ")
    // emailFrom is a sender address (often no-reply), so the public contact email starts blank.
    return defaultTheme({
      name: store.name,
      tagline: g?.tagline,
      phone: g?.phone,
      email: "",
      address,
    })
  }

  async getTheme(): Promise<ThemeSettings> {
    const [base, saved] = await Promise.all([
      this.themeDefaults(),
      prisma.themeConfig.findUnique({
        where: { storeId_slug: { storeId: this.storeId, slug: THEME_SLUG } },
      }),
    ])
    return mergeTheme(base, saved?.config)
  }

  async saveTheme(theme: ThemeSettings) {
    await prisma.themeConfig.upsert({
      where: { storeId_slug: { storeId: this.storeId, slug: THEME_SLUG } },
      update: { config: theme },
      create: {
        storeId: this.storeId,
        slug: THEME_SLUG,
        name: "Default",
        isActive: true,
        config: theme,
      },
    })
    return this.getTheme()
  }

  // ------------------------------------------------------------------ homepage

  /** Saved sections in order; invalid rows (e.g. from an older shape) are skipped. Defaults until first save. */
  async getHomepage(): Promise<{ sections: HomepageSection[]; customised: boolean }> {
    const rows = await prisma.homepageSection.findMany({
      where: { storeId: this.storeId },
      orderBy: { sortOrder: "asc" },
    })
    if (!rows.length) return { sections: DEFAULT_HOMEPAGE, customised: false }
    const sections = rows
      .map((r) =>
        HomepageSectionDto.safeParse({ type: r.type, enabled: r.enabled, config: r.config }),
      )
      .flatMap((p) => (p.success ? [p.data] : []))
    return { sections, customised: true }
  }

  async saveHomepage(sections: HomepageSection[]) {
    await prisma.$transaction([
      prisma.homepageSection.deleteMany({ where: { storeId: this.storeId } }),
      prisma.homepageSection.createMany({
        data: sections.map((s, i) => ({
          storeId: this.storeId,
          type: s.type,
          enabled: s.enabled,
          sortOrder: i,
          config: s.config,
        })),
      }),
    ])
    return this.getHomepage()
  }

  async resetHomepage() {
    await prisma.homepageSection.deleteMany({ where: { storeId: this.storeId } })
    return this.getHomepage()
  }

  // ------------------------------------------------------------------ storefront (public)

  /** Everything the header and footer need, in one request. */
  async site() {
    const [theme, menus, footerPages] = await Promise.all([
      this.getTheme(),
      this.listMenus(),
      prisma.cmsPage.findMany({
        where: { storeId: this.storeId, isPublished: true, showInFooterMenu: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: { title: true, slug: true },
      }),
    ])
    const header = menus.find((m) => m.location === "header")
    return {
      theme,
      headerMenu: header?.items.length ? header.items : null,
      footerMenus: menus
        .filter((m) => m.location === "footer" && m.items.length)
        .map((m) => ({ title: m.name, links: m.items })),
      footerPages: footerPages.map((p) => ({ title: p.title, url: `/${p.slug}` })),
    }
  }

  async publicHomepage() {
    const { sections } = await this.getHomepage()
    return sections.filter((s) => s.enabled)
  }

  listPublishedPages() {
    return prisma.cmsPage.findMany({
      where: { storeId: this.storeId, isPublished: true },
      orderBy: { title: "asc" },
      select: { title: true, slug: true, updatedAt: true },
    })
  }

  async publicPage(slug: string) {
    const page = await prisma.cmsPage.findFirst({
      where: { storeId: this.storeId, slug, isPublished: true },
      select: {
        title: true,
        slug: true,
        content: true,
        template: true,
        sections: true,
        seoTitle: true,
        metaDesc: true,
        updatedAt: true,
      },
    })
    if (!page) throw new NotFoundError("page")
    return {
      ...page,
      template: page.template === "sections" ? "sections" : "text",
      sections: this.validSections(page.sections),
    }
  }

  /** Enabled sections that still match the current section shapes; anything else is skipped. */
  private validSections(raw: unknown): HomepageSection[] {
    if (!Array.isArray(raw)) return []
    return raw
      .map((r) => SectionDto.safeParse(r))
      .flatMap((p) => (p.success && p.data.enabled ? [p.data] : []))
  }

  async publicPosts(q: ListQueryDto) {
    const where: Prisma.BlogPostWhereInput = {
      storeId: this.storeId,
      status: "published",
      visibility: "public",
      ...(q.category ? { category: { slug: q.category } } : {}),
    }
    const [total, items] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: this.postRow,
      }),
    ])
    return { items, meta: pageMeta(q.page, q.perPage, total) }
  }

  publicBlogCategories() {
    return prisma.blogCategory.findMany({
      where: { storeId: this.storeId, isActive: true, posts: { some: { status: "published" } } },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    })
  }

  async publicPost(slug: string) {
    const post = await prisma.blogPost.findFirst({
      where: { storeId: this.storeId, slug, status: "published", visibility: "public" },
      select: { ...this.postRow, content: true, seoTitle: true, metaDesc: true },
    })
    if (!post) throw new NotFoundError("post")
    // Fire-and-forget view counter; a failed increment must not break the page.
    prisma.blogPost
      .update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined)
    return post
  }
}
