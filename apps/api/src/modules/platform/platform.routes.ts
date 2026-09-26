import { Router, type Request, type Response } from "express";
import { authMiddleware, validate } from "../../middleware";
import { envelope, ctrl, type RequestContext } from "../../core";
import { PlatformService } from "./platform.service";
import { StoresService } from "../stores/stores.service";
import { StoreOwnerDto } from "../stores/stores.dto";
import {
  CreatePlanDto,
  UpdatePlanDto,
  IdParamDto,
  SubscriptionListQueryDto,
  UpdateSubscriptionDto,
  ReportsQueryDto,
  AuditLogQueryDto,
} from "./platform.dto";

type Req = Request & { ctx: RequestContext };
const svc = (req: Req) => new PlatformService(req.ctx);
const id = (req: Req) => BigInt((req.params as { id: string }).id);

/** Mounted at /api/super — every route needs a platform (super) session. */
export const superPlatformRouter = Router();
superPlatformRouter.use(authMiddleware("super"));

superPlatformRouter.get(
  "/overview",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).dashboard() });
  }),
);

superPlatformRouter.get(
  "/stores/:id/overview",
  validate({ params: IdParamDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).storeOverview(id(req)) });
  }),
);

superPlatformRouter.get(
  "/plans",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).listPlans() });
  }),
);
superPlatformRouter.post(
  "/plans",
  validate({ body: CreatePlanDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, message: "CREATED", data: await svc(req).createPlan(req.body) });
  }),
);
superPlatformRouter.patch(
  "/plans/:id",
  validate({ params: IdParamDto, body: UpdatePlanDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).updatePlan(id(req), req.body) });
  }),
);
superPlatformRouter.delete(
  "/plans/:id",
  validate({ params: IdParamDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).deletePlan(id(req)) });
  }),
);

superPlatformRouter.get(
  "/subscriptions",
  validate({ query: SubscriptionListQueryDto }),
  ctrl(async (req: Req, res: Response) => {
    const { items, summary } = await svc(req).listSubscriptions(req.query as never);
    envelope(res, { data: items, meta: summary });
  }),
);
superPlatformRouter.put(
  "/stores/:id/subscription",
  validate({ params: IdParamDto, body: UpdateSubscriptionDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).upsertSubscription(id(req), req.body) });
  }),
);

superPlatformRouter.get(
  "/reports",
  validate({ query: ReportsQueryDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).reports(req.query as never) });
  }),
);

superPlatformRouter.get(
  "/audit-logs",
  validate({ query: AuditLogQueryDto }),
  ctrl(async (req: Req, res: Response) => {
    const { items, meta } = await svc(req).auditLogs(req.query as never);
    envelope(res, { data: items, meta });
  }),
);

superPlatformRouter.post(
  "/stores/:id/owner",
  validate({ params: IdParamDto, body: StoreOwnerDto }),
  ctrl(async (req: Req, res: Response) => {
    const owner = await new StoresService(req.ctx).createOwner(id(req), req.body);
    envelope(res, { status: 201, message: "CREATED", data: owner });
  }),
);

superPlatformRouter.post(
  "/stores/:id/impersonate",
  validate({ params: IdParamDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).impersonateOwner(id(req)) });
  }),
);
