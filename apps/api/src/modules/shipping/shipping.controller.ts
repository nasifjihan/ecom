import type { Request, Response } from "express";
import { Router } from "express";
import { ctrl, envelope, BaseController, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { ShippingService } from "./shipping.service";
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  ShippingZoneSearchQueryDto,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  BulkImportMethodsDto,
  ShippingRatesQueryDto,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  TaxRateSearchDto,
  TaxesForAddressDto,
  ExportShippingDto,
} from "./shipping.dto";

export class ShippingController extends BaseController {
  private svc(ctx: RequestContext) { return new ShippingService(); }

  listZones = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).listZones(req.ctx, req.query as any);
    envelope(res, { status: 200, data });
  });

  getZone = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).getZone(req.ctx, BigInt(req.params.id ?? "0"));
    envelope(res, { status: 200, data });
  });

  createZone = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).createZone(req.ctx, req.body as any);
    envelope(res, { status: 201, data });
  });

  updateZone = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).updateZone(req.ctx, BigInt(req.params.id ?? "0"), req.body as any);
    envelope(res, { status: 200, data });
  });

  deleteZone = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).deleteZone(req.ctx, BigInt(req.params.id ?? "0"));
    envelope(res, { status: 200, data: { deleted: true, id: (data as any).id } });
  });

  listMethods = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const zoneId = BigInt(req.params.zoneId ?? "0");
    const data = await this.svc(req.ctx).listMethods(req.ctx, zoneId);
    envelope(res, { status: 200, data });
  });

  createMethod = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).createMethod(req.ctx, req.body as any);
    envelope(res, { status: 201, data });
  });

  updateMethod = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).updateMethod(req.ctx, BigInt(req.params.id ?? "0"), req.body as any);
    envelope(res, { status: 200, data });
  });

  deleteMethod = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).deleteMethod(req.ctx, BigInt(req.params.id ?? "0"));
    envelope(res, { status: 200, data: { deleted: true, id: (data as any).id } });
  });

  bulkImport = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).bulkImport(req.ctx, req.body as any);
    envelope(res, { status: 200, data });
  });

  publicRates = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).computeShippingOptions(req.ctx, req.query as any);
    envelope(res, { status: 200, data });
  });

  listTaxes = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).listTaxes(req.ctx, req.query as any);
    envelope(res, { status: 200, data });
  });

  createTax = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).createTax(req.ctx, req.body as any);
    envelope(res, { status: 201, data });
  });

  updateTax = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).updateTax(req.ctx, BigInt(req.params.id ?? "0"), req.body as any);
    envelope(res, { status: 200, data });
  });

  deleteTax = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).deleteTax(req.ctx, BigInt(req.params.id ?? "0"));
    envelope(res, { status: 200, data: { deleted: true, id: (data as any).id } });
  });

  resolveTaxes = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const data = await this.svc(req.ctx).resolveTaxes(req.ctx, req.query as any);
    envelope(res, { status: 200, data });
  });

  exportShipping = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const q = req.query as any;
    const zid: bigint | undefined = q.zoneId ? BigInt(q.zoneId) : undefined;
    const fmt: "csv" | "xlsx" | "pdf" = (q.format === "xlsx" || q.format === "pdf") ? q.format : "csv";
    const result = await this.svc(req.ctx).exportShipping(req.ctx, zid, fmt);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", result.contentDisposition);
    res.status(200).send(Buffer.from(result.buffer as any));
  });
}

export const shippingController = new ShippingController();

export const adminShippingRouter = Router();

adminShippingRouter.get(
  "/zones",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.view"),
  validate({ query: ShippingZoneSearchQueryDto }),
  shippingController.listZones,
);
adminShippingRouter.post(
  "/zones",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  validate({ body: CreateShippingZoneDto }),
  shippingController.createZone,
);
adminShippingRouter.get(
  "/zones/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.view"),
  shippingController.getZone,
);
adminShippingRouter.put(
  "/zones/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  validate({ body: UpdateShippingZoneDto }),
  shippingController.updateZone,
);
adminShippingRouter.delete(
  "/zones/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  shippingController.deleteZone,
);

adminShippingRouter.get(
  "/zones/:zoneId/methods",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.view"),
  shippingController.listMethods,
);
adminShippingRouter.post(
  "/methods",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  validate({ body: CreateShippingMethodDto }),
  shippingController.createMethod,
);
adminShippingRouter.put(
  "/methods/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  validate({ body: UpdateShippingMethodDto }),
  shippingController.updateMethod,
);
adminShippingRouter.delete(
  "/methods/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  shippingController.deleteMethod,
);
adminShippingRouter.post(
  "/methods/import",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.manage"),
  validate({ body: BulkImportMethodsDto }),
  shippingController.bulkImport,
);

adminShippingRouter.get(
  "/tax-rates",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("settings.taxes"),
  validate({ query: TaxRateSearchDto }),
  shippingController.listTaxes,
);
adminShippingRouter.post(
  "/tax-rates",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("settings.taxes"),
  validate({ body: CreateTaxRateDto }),
  shippingController.createTax,
);
adminShippingRouter.put(
  "/tax-rates/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("settings.taxes"),
  validate({ body: UpdateTaxRateDto }),
  shippingController.updateTax,
);
adminShippingRouter.delete(
  "/tax-rates/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("settings.taxes"),
  shippingController.deleteTax,
);

adminShippingRouter.get(
  "/export",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.view"),
  validate({ query: ExportShippingDto }),
  shippingController.exportShipping,
);

export const storefrontShippingRouter = Router();

storefrontShippingRouter.get(
  "/rates",
  validate({ query: ShippingRatesQueryDto }),
  shippingController.publicRates,
);
storefrontShippingRouter.get(
  "/taxes",
  validate({ query: TaxesForAddressDto }),
  shippingController.resolveTaxes,
);
