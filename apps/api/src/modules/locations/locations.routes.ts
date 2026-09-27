/**
 * LOCATION ROUTES
 *   GET /api/storefront/locations              areas the store delivers to (flat; parents first)
 *   GET /api/admin/locations                   every area with its delivery switch and zones
 *   PUT /api/admin/locations/:id/delivery      { enabled } — switch delivery to an area on or off
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { adminLocations, publicLocations, setLocationDelivery } from "./locations.service";

type Req = Request & { ctx: RequestContext };

const storeOf = (req: Req) => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
  return req.ctx.storeId;
};

const IdParam = z.object({ id: z.coerce.bigint().positive() });
const DeliveryBody = z.object({ enabled: z.boolean() });

export const storefrontLocationsRouter = Router();

storefrontLocationsRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    const data = await publicLocations(storeOf(req));
    res.setHeader("Cache-Control", "public, max-age=300");
    envelope(res, { status: 200, data });
  }),
);

export const adminLocationsRouter = Router();
adminLocationsRouter.use(authMiddleware("adminOrSuper"));

adminLocationsRouter.get(
  "/",
  rbacMiddleware("shipping.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await adminLocations(storeOf(req)) });
  }),
);

adminLocationsRouter.put(
  "/:id/delivery",
  rbacMiddleware("shipping.manage"),
  validate({ params: IdParam, body: DeliveryBody }),
  ctrl(async (req: Req, res: Response) => {
    const { id } = req.params as unknown as z.infer<typeof IdParam>;
    const { enabled } = req.body as z.infer<typeof DeliveryBody>;
    envelope(res, { status: 200, data: await setLocationDelivery(storeOf(req), BigInt(id), enabled) });
  }),
);
