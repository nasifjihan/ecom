import { Router } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { marketingController } from "./marketing.controller";
import {
  CreateCouponDto,
  UpdateCouponDto,
  CouponSearchQueryDto,
  CouponIdParamDto,
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  FlashSaleIdParamDto,
  CreateReviewDto,
  ListReviewsQueryDto,
  ReviewModerateDto,
  ReviewIdParamDto,
} from "./marketing.dto";
import { PaginationSchema } from "@ecom/zod-schemas";

export const marketingCouponsRouter = Router();

marketingCouponsRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("coupons.*"),
  validate({ body: CreateCouponDto }),
  marketingController.createCoupon,
);

marketingCouponsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("coupons.*"),
  validate({ query: CouponSearchQueryDto }),
  marketingController.listCoupons,
);

marketingCouponsRouter.get(
  "/validate",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("coupons.*"),
  marketingController.validateCoupon,
);

marketingCouponsRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("coupons.*"),
  validate({ params: CouponIdParamDto }),
  marketingController.getCoupon,
);

marketingCouponsRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("coupons.*"),
  validate({ params: CouponIdParamDto, body: UpdateCouponDto }),
  marketingController.updateCoupon,
);

marketingCouponsRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("coupons.*"),
  validate({ params: CouponIdParamDto }),
  marketingController.deleteCoupon,
);

export const marketingFlashSalesRouter = Router();

marketingFlashSalesRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("flash_sales.*"),
  validate({ body: CreateFlashSaleDto }),
  marketingController.createFlashSale,
);

marketingFlashSalesRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("flash_sales.*"),
  validate({ query: PaginationSchema }),
  marketingController.listFlashSales,
);

marketingFlashSalesRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("flash_sales.*"),
  validate({ params: FlashSaleIdParamDto }),
  marketingController.getFlashSale,
);

marketingFlashSalesRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("flash_sales.*"),
  validate({ params: FlashSaleIdParamDto, body: UpdateFlashSaleDto }),
  marketingController.updateFlashSale,
);

marketingFlashSalesRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("flash_sales.*"),
  validate({ params: FlashSaleIdParamDto }),
  marketingController.deleteFlashSale,
);

export const marketingReviewsRouter = Router();

marketingReviewsRouter.post(
  "/me",
  authMiddleware("customer"),
  validate({ body: CreateReviewDto }),
  marketingController.createMyReview,
);

marketingReviewsRouter.get(
  "/me",
  authMiddleware("customer"),
  validate({ query: ListReviewsQueryDto }),
  marketingController.myReviews,
);

marketingReviewsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("reviews.*"),
  validate({ query: ListReviewsQueryDto }),
  marketingController.listReviews,
);

marketingReviewsRouter.post(
  "/moderate",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("reviews.*"),
  validate({ body: ReviewModerateDto }),
  marketingController.moderateReviews,
);

marketingReviewsRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("reviews.*"),
  validate({ params: ReviewIdParamDto }),
  marketingController.getReview,
);
