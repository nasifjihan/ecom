import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { inventoryController } from "./inventory.controller";
import {
  StockAdjustmentDto,
  StockTransferDto,
  MovementQueryDto,
  LowStockReportDto,
  VariantIdParamDto,
  StockAdjustLineDto,
  StockListQueryDto,
} from "./inventory.dto";

function multerFallback(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

const IdParamDto = VariantIdParamDto.extend({ id: undefined as any });

export const adminInventoryRouter = Router();

adminInventoryRouter.post(
  "/adjust",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ body: StockAdjustmentDto }),
  inventoryController.adjustStock,
);

adminInventoryRouter.post(
  "/transfer",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ body: StockTransferDto }),
  inventoryController.transferStock,
);

adminInventoryRouter.get(
  "/stock",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ query: StockListQueryDto }),
  inventoryController.stockList,
);

adminInventoryRouter.get(
  "/movements",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ query: MovementQueryDto }),
  inventoryController.movementReport,
);

adminInventoryRouter.get(
  "/low-stock",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ query: LowStockReportDto }),
  inventoryController.lowStockReport,
);

adminInventoryRouter.get(
  "/stock-value",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  inventoryController.stockValueReport,
);

adminInventoryRouter.post(
  "/import",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  multerFallback,
  inventoryController.importStockCount,
);

adminInventoryRouter.get(
  "/variants/:variantId",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ params: VariantIdParamDto }),
  inventoryController.variantInventoryById,
);

adminInventoryRouter.post(
  "/variants/:variantId/adjust",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  validate({ params: VariantIdParamDto, body: StockAdjustLineDto.partial() as any }),
  inventoryController.adjustVariant,
);

adminInventoryRouter.get(
  "/movements/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("inventory.*"),
  inventoryController.getMovement,
);
