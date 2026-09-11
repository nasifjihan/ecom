import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext } from "../../core";
import { DashboardService } from "./dashboard.service";
import type {
  DashboardRangeQueryDto as DashboardRangeQueryDtoType,
  StoreDashboardExportDto as StoreDashboardExportDtoType,
} from "./dashboard.dto";
import { Router } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { z } from "zod";
import { DashboardRangeQueryDto, StoreDashboardExportDto } from "./dashboard.dto";

const BaseRangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).superRefine((v, ctx) => {
  if (v.from !== undefined && v.to !== undefined && v.from > v.to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "from must be before to", path: ["from"] });
  }
});

class DashboardController extends BaseController {
  private getService(ctx: RequestContext): DashboardService {
    return new DashboardService(ctx);
  }

  superStats = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const q = req.query as any;
    const range = q.from && q.to ? ({ from: new Date(String(q.from)), to: new Date(String(q.to)) } as DashboardRangeQueryDtoType) : undefined;
    const result = await svc.getSuperStats(range);
    envelope(res, { status: 200, data: result });
  });

  storeStats = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const q = req.query as any;
    const range = q.from && q.to ? ({ from: new Date(String(q.from)), to: new Date(String(q.to)) } as DashboardRangeQueryDtoType) : undefined;
    const result = await svc.getStoreStats(range);
    envelope(res, { status: 200, data: result });
  });

  exportStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.query as unknown as StoreDashboardExportDtoType;
    const result = await svc.exportStoreDashboard(dto);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", result.contentDisposition);
    res.status(200).send(Buffer.from(result.buffer));
  });

  superSummary = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const result = await svc.getSuperStats();
    envelope(res, { status: 200, data: result });
  });

  storeSummary = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const result = await svc.getStoreStats();
    envelope(res, { status: 200, data: result });
  });
}

export const dashboardController = new DashboardController();

export const superDashboardRouter = Router();

superDashboardRouter.get(
  "/stats",
  authMiddleware("super"),
  rbacMiddleware("super.*"),
  validate({ query: BaseRangeQuery }),
  dashboardController.superStats,
);

superDashboardRouter.get(
  "/summary",
  authMiddleware("super"),
  rbacMiddleware("super.*"),
  dashboardController.superSummary,
);

export const storeDashboardRouter = Router();

storeDashboardRouter.get(
  "/stats",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("dashboard.*"),
  validate({ query: BaseRangeQuery }),
  dashboardController.storeStats,
);

storeDashboardRouter.get(
  "/summary",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("dashboard.*"),
  dashboardController.storeSummary,
);

storeDashboardRouter.get(
  "/export",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("dashboard.*"),
  validate({ query: StoreDashboardExportDto }),
  dashboardController.exportStore,
);
