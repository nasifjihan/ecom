import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext, NotFoundError } from "../../core";
import { MarketingService } from "./marketing.service";
import type {
  CreateCouponDto as CreateCouponDtoType,
  UpdateCouponDto as UpdateCouponDtoType,
  CouponSearchQueryDto as CouponSearchQueryDtoType,
  CouponIdParamDto as CouponIdParamDtoType,
  CreateFlashSaleDto as CreateFlashSaleDtoType,
  UpdateFlashSaleDto as UpdateFlashSaleDtoType,
  FlashSaleIdParamDto as FlashSaleIdParamDtoType,
  CreateReviewDto as CreateReviewDtoType,
  ListReviewsQueryDto as ListReviewsQueryDtoType,
  ReviewModerateDto as ReviewModerateDtoType,
  ReviewIdParamDto as ReviewIdParamDtoType,
} from "./marketing.dto";

type PaginationFilters = { page: number; perPage: number; sortBy?: string; sortOrder?: "asc" | "desc"; search?: string };

class MarketingController extends BaseController {
  private getService(ctx: RequestContext): MarketingService {
    return new MarketingService(ctx);
  }

  createCoupon = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateCouponDtoType;
    const result = await svc.createCoupon(dto);
    envelope(res, { status: 201, data: result, message: "Coupon created" });
  });

  listCoupons = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as CouponSearchQueryDtoType;
    const result = await svc.listCoupons(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  getCoupon = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CouponIdParamDtoType;
    const result = await svc.getCoupon(params.id);
    envelope(res, { status: 200, data: result });
  });

  updateCoupon = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CouponIdParamDtoType;
    const dto = req.body as UpdateCouponDtoType;
    const result = await svc.updateCoupon(params.id, dto);
    envelope(res, { status: 200, data: result, message: "Coupon updated" });
  });

  deleteCoupon = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CouponIdParamDtoType;
    await svc.deleteCoupon(params.id);
    envelope(res, { status: 200, message: "Coupon deleted" });
  });

  validateCoupon = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const code = String(req.query.code || "");
    if (!code) throw new NotFoundError("Coupon code not provided");
    const result = await svc.validateCoupon(code, req.body ?? {});
    envelope(res, { status: 200, data: result });
  });

  createFlashSale = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateFlashSaleDtoType;
    const result = await svc.createFlashSale(dto);
    envelope(res, { status: 201, data: result, message: "Flash sale created" });
  });

  listFlashSales = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as PaginationFilters;
    const result = await svc.listFlashSales({
      page: Number(filters.page ?? 1),
      perPage: Number(filters.perPage ?? 20),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search,
    });
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  getFlashSale = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as FlashSaleIdParamDtoType;
    const result = await svc.getFlashSale(params.id);
    envelope(res, { status: 200, data: result });
  });

  updateFlashSale = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as FlashSaleIdParamDtoType;
    const dto = req.body as UpdateFlashSaleDtoType;
    const result = await svc.updateFlashSale(params.id, dto);
    envelope(res, { status: 200, data: result, message: "Flash sale updated" });
  });

  deleteFlashSale = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as FlashSaleIdParamDtoType;
    await svc.deleteFlashSale(params.id);
    envelope(res, { status: 200, message: "Flash sale deleted" });
  });

  createReview = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateReviewDtoType;
    const result = await svc.createReview(dto);
    envelope(res, { status: 201, data: result, message: "Review submitted" });
  });

  listReviews = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as ListReviewsQueryDtoType;
    const result = await svc.listReviews(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  getReview = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ReviewIdParamDtoType;
    const result = await svc.getReview(params.id);
    envelope(res, { status: 200, data: result });
  });

  moderateReviews = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as ReviewModerateDtoType;
    const result = await svc.moderateReviews(dto);
    envelope(res, { status: 200, data: result, message: `Moderation ${result.action} applied to ${result.count} reviews` });
  });

  myReviews = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as ListReviewsQueryDtoType;
    const result = await svc.listMyReviews(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  createMyReview = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateReviewDtoType;
    const result = await svc.createReview(dto);
    envelope(res, { status: 201, data: result, message: "Review submitted" });
  });
}

export const marketingController = new MarketingController();
