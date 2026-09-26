import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext } from "../../core";
import { InventoryService } from "./inventory.service";
import type {
  StockAdjustmentDto as StockAdjustmentDtoType,
  StockTransferDto as StockTransferDtoType,
  MovementQueryDto as MovementQueryDtoType,
  LowStockReportDto as LowStockReportDtoType,
  VariantIdParamDto as VariantIdParamDtoType,
  StockAdjustLineDto as StockAdjustLineDtoType,
} from "./inventory.dto";

const IdParamDto = { id: BigInt(0) };
type IdParamDtoType = { id: bigint };

class InventoryController extends BaseController {
  private getService(ctx: RequestContext): InventoryService {
    return new InventoryService(ctx);
  }

  adjustStock = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as StockAdjustmentDtoType;
    const result = await svc.adjustStock(dto);
    envelope(res, { status: 201, data: result, message: "Stock adjusted successfully" });
  });

  transferStock = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as StockTransferDtoType;
    const result = await svc.transferStock(dto);
    envelope(res, { status: 201, data: result, message: "Stock transferred successfully" });
  });

  stockList = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const q = req.query as unknown as { search?: string; lowStock?: boolean; outOfStock?: boolean; page: number; perPage: number };
    envelope(res, { status: 200, data: await svc.stockList(q) });
  });

  movementReport = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as MovementQueryDtoType;
    const result = await svc.movementReport(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  lowStockReport = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.query as unknown as LowStockReportDtoType;
    const result = await svc.lowStockReport(dto);
    envelope(res, { status: 200, data: result });
  });

  stockValueReport = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const result = await svc.stockValueReport();
    envelope(res, { status: 200, data: result });
  });

  importStockCount = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const multerFile = (req as any).file;
    const file = multerFile
      ? {
          buffer: multerFile.buffer as Uint8Array,
          originalName: multerFile.originalname as string,
          mimeType: multerFile.mimetype as string,
        }
      : undefined;
    const result = await svc.importStockCount(file);
    envelope(res, { status: 200, data: result, message: "Stock count import complete" });
  });

  variantInventoryById = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as VariantIdParamDtoType;
    const result = await svc.variantInventoryById(params.variantId);
    envelope(res, { status: 200, data: result });
  });

  adjustVariant = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as VariantIdParamDtoType;
    const body = req.body as StockAdjustLineDtoType;
    const result = await svc.adjustVariant(params.variantId, body);
    envelope(res, { status: 201, data: result, message: "Variant stock adjusted" });
  });

  getMovement = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as IdParamDtoType;
    const result = await svc.getMovement(params.id);
    envelope(res, { status: 200, data: result });
  });
}

export const inventoryController = new InventoryController();
