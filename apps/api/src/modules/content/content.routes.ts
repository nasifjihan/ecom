/**
 * CONTENT ROUTES
 *   /api/admin/content/*       store admin: pages, blog, FAQs, menus, theme, homepage
 *   /api/storefront/content/*  public, published content only (store from the request Origin)
 */
import { Router, type Request, type Response } from "express"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { ContentService } from "./content.service"
import {
  BlogCategoryDto,
  CreatePageDto,
  CreatePostDto,
  FaqDto,
  HomepageDto,
  IdParamDto,
  ListQueryDto,
  MenuDto,
  MenuItemsDto,
  SlugParamDto,
  ThemeDto,
  UpdateBlogCategoryDto,
  UpdateFaqDto,
  UpdateMenuDto,
  UpdatePageDto,
  UpdatePostDto,
  type HomepageSection,
  type ThemeSettings,
} from "./content.dto"

type Req = Request & { ctx: RequestContext }
type Handler = (svc: ContentService, req: Req) => Promise<unknown>

const svc = (req: Req) => new ContentService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const slug = (req: Req) => (req.params as { slug: string }).slug
const q = (req: Req) => req.query as unknown as ListQueryDto
/** The body after validate() has parsed it with the route's DTO. */
const body = <T>(req: Req) => req.body as T

/** Wraps a service call; a result with `items` + `meta` is sent as a paginated envelope. */
const send = (run: Handler, status = 200) =>
  ctrl(async (req: Req, res: Response) => {
    const out = (await run(svc(req), req)) as { items?: unknown; meta?: unknown }
    if (out && typeof out === "object" && "items" in out && "meta" in out) {
      envelope(res, { status, data: out.items, meta: out.meta })
    } else {
      envelope(res, { status, data: out })
    }
  })

// ============================================================ admin

export const adminContentRouter = Router()
adminContentRouter.use(authMiddleware("adminOrSuper"))

const can = (perm: string) => rbacMiddleware(perm)

// ---- pages
adminContentRouter.get(
  "/pages",
  can("pages.read"),
  validate({ query: ListQueryDto }),
  send((s, r) => s.listPages(q(r))),
)
adminContentRouter.post(
  "/pages",
  can("pages.create"),
  validate({ body: CreatePageDto }),
  send((s, r) => s.createPage(body<CreatePageDto>(r)), 201),
)
adminContentRouter.get(
  "/pages/:id",
  can("pages.read"),
  validate({ params: IdParamDto }),
  send((s, r) => s.getPage(id(r))),
)
adminContentRouter.patch(
  "/pages/:id",
  can("pages.update"),
  validate({ params: IdParamDto, body: UpdatePageDto }),
  send((s, r) => s.updatePage(id(r), body<UpdatePageDto>(r))),
)
adminContentRouter.delete(
  "/pages/:id",
  can("pages.delete"),
  validate({ params: IdParamDto }),
  send((s, r) => s.deletePage(id(r))),
)

// ---- blog
adminContentRouter.get(
  "/blog/categories",
  can("blog.read"),
  send((s) => s.listBlogCategories()),
)
adminContentRouter.post(
  "/blog/categories",
  can("blog.create"),
  validate({ body: BlogCategoryDto }),
  send((s, r) => s.createBlogCategory(body<BlogCategoryDto>(r)), 201),
)
adminContentRouter.patch(
  "/blog/categories/:id",
  can("blog.update"),
  validate({ params: IdParamDto, body: UpdateBlogCategoryDto }),
  send((s, r) => s.updateBlogCategory(id(r), body<Partial<BlogCategoryDto>>(r))),
)
adminContentRouter.delete(
  "/blog/categories/:id",
  can("blog.delete"),
  validate({ params: IdParamDto }),
  send((s, r) => s.deleteBlogCategory(id(r))),
)
adminContentRouter.get(
  "/blog/posts",
  can("blog.read"),
  validate({ query: ListQueryDto }),
  send((s, r) => s.listPosts(q(r))),
)
adminContentRouter.post(
  "/blog/posts",
  can("blog.create"),
  validate({ body: CreatePostDto }),
  send((s, r) => s.createPost(body<CreatePostDto>(r)), 201),
)
adminContentRouter.get(
  "/blog/posts/:id",
  can("blog.read"),
  validate({ params: IdParamDto }),
  send((s, r) => s.getPost(id(r))),
)
adminContentRouter.patch(
  "/blog/posts/:id",
  can("blog.update"),
  validate({ params: IdParamDto, body: UpdatePostDto }),
  send((s, r) => s.updatePost(id(r), body<UpdatePostDto>(r))),
)
adminContentRouter.delete(
  "/blog/posts/:id",
  can("blog.delete"),
  validate({ params: IdParamDto }),
  send((s, r) => s.deletePost(id(r))),
)

// ---- FAQs
adminContentRouter.get(
  "/faqs",
  can("faqs.read"),
  send((s) => s.listFaqs()),
)
adminContentRouter.post(
  "/faqs",
  can("faqs.create"),
  validate({ body: FaqDto }),
  send((s, r) => s.createFaq(body<FaqDto>(r)), 201),
)
adminContentRouter.patch(
  "/faqs/:id",
  can("faqs.update"),
  validate({ params: IdParamDto, body: UpdateFaqDto }),
  send((s, r) => s.updateFaq(id(r), body<Partial<FaqDto>>(r))),
)
adminContentRouter.delete(
  "/faqs/:id",
  can("faqs.delete"),
  validate({ params: IdParamDto }),
  send((s, r) => s.deleteFaq(id(r))),
)

// ---- menus
adminContentRouter.get(
  "/menus",
  can("menus.read"),
  send((s) => s.listMenus()),
)
adminContentRouter.post(
  "/menus",
  can("menus.create"),
  validate({ body: MenuDto }),
  send((s, r) => s.createMenu(body<MenuDto>(r)), 201),
)
adminContentRouter.get(
  "/menus/:id",
  can("menus.read"),
  validate({ params: IdParamDto }),
  send((s, r) => s.getMenu(id(r))),
)
adminContentRouter.patch(
  "/menus/:id",
  can("menus.update"),
  validate({ params: IdParamDto, body: UpdateMenuDto }),
  send((s, r) => s.updateMenu(id(r), body<Partial<MenuDto>>(r))),
)
adminContentRouter.put(
  "/menus/:id/items",
  can("menus.update"),
  validate({ params: IdParamDto, body: MenuItemsDto }),
  send((s, r) => s.setMenuItems(id(r), body<MenuItemsDto>(r))),
)
adminContentRouter.delete(
  "/menus/:id",
  can("menus.delete"),
  validate({ params: IdParamDto }),
  send((s, r) => s.deleteMenu(id(r))),
)

// ---- theme + homepage
adminContentRouter.get(
  "/theme",
  can("themes.read"),
  send((s) => s.getTheme()),
)
adminContentRouter.put(
  "/theme",
  can("themes.update"),
  validate({ body: ThemeDto }),
  send((s, r) => s.saveTheme(body<ThemeSettings>(r))),
)
adminContentRouter.get(
  "/homepage",
  can("homepage_sections.read"),
  send((s) => s.getHomepage()),
)
adminContentRouter.put(
  "/homepage",
  can("homepage_sections.update"),
  validate({ body: HomepageDto }),
  send((s, r) => s.saveHomepage(body<{ sections: HomepageSection[] }>(r).sections)),
)
adminContentRouter.delete(
  "/homepage",
  can("homepage_sections.update"),
  send((s) => s.resetHomepage()),
)

// ============================================================ storefront

export const storefrontContentRouter = Router()

storefrontContentRouter.get(
  "/site",
  send((s) => s.site()),
)
storefrontContentRouter.get(
  "/homepage",
  send((s) => s.publicHomepage()),
)
storefrontContentRouter.get(
  "/pages",
  send((s) => s.listPublishedPages()),
)
storefrontContentRouter.get(
  "/pages/:slug",
  validate({ params: SlugParamDto }),
  send((s, r) => s.publicPage(slug(r))),
)
storefrontContentRouter.get(
  "/faqs",
  send((s) => s.listFaqs(true)),
)
storefrontContentRouter.get(
  "/blog",
  validate({ query: ListQueryDto }),
  send((s, r) => s.publicPosts(q(r))),
)
storefrontContentRouter.get(
  "/blog/categories",
  send((s) => s.publicBlogCategories()),
)
storefrontContentRouter.get(
  "/blog/:slug",
  validate({ params: SlugParamDto }),
  send((s, r) => s.publicPost(slug(r))),
)
