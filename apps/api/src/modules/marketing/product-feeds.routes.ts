/**
 * Product feeds for Facebook and Google catalogues. The storefront serves them as XML at
 * /feeds/facebook.xml and /feeds/google.xml from GET /api/storefront/feed; Marketing > Product feeds
 * (GET /api/admin/marketing/product-feeds) shows each storefront's addresses and what's left out.
 */
import { Router, type Request, type Response } from "express"
import { prisma } from "../../config"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware } from "../../middleware"
import { storeUrls } from "../content/store-details"
import { StorefrontService } from "../storefront/storefront.service"
import { defaultStorefrontId } from "../storefronts/storefronts.context"

type Req = Request & { ctx: RequestContext }

export const storefrontFeedRouter = Router()
storefrontFeedRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    const feed = await new StorefrontService(req.ctx).productFeed()
    res.setHeader("Cache-Control", "public, max-age=3600")
    envelope(res, { data: { items: feed.items } })
  }),
)

export const adminProductFeedsRouter = Router()
adminProductFeedsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("promotions.view"),
  ctrl(async (req: Req, res: Response) => {
    if (req.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    const storeId = BigInt(req.ctx.storeId)
    const [storefronts, urls, defId] = await Promise.all([
      prisma.storefront.findMany({ where: { storeId, isActive: true }, orderBy: { sortOrder: "asc" }, include: { domains: { orderBy: { primary: "desc" }, take: 1 } } }),
      storeUrls(storeId),
      defaultStorefrontId(storeId),
    ])
    // What's left out, as the default storefront sees it (others differ only by their product range).
    const feed = await new StorefrontService({ ...req.ctx, admin: undefined, storefrontId: defId }).productFeed()
    envelope(res, {
      data: {
        storefronts: storefronts.map((s) => {
          const base = s.domains[0] ? `https://${s.domains[0].hostname}` : s.id === defId ? urls.storefront : null
          return { id: String(s.id), name: s.name, facebook: base ? `${base}/feeds/facebook.xml` : null, google: base ? `${base}/feeds/google.xml` : null }
        }),
        items: feed.items.length,
        excluded: feed.excluded,
      },
    })
  }),
)
