import type { Request, Response } from "express";
import { ctrl, envelope, type RequestContext } from "../../core";
import { StorefrontService } from "./storefront.service";
import type { CartPricesDto, StorefrontProductsQueryDto } from "./storefront.dto";
import { StorefrontEngagement } from "./engagement";

type Req = Request & { ctx: RequestContext };
const svc = (req: Req) => new StorefrontService(req.ctx);

export const storefrontController = {
  listProducts: ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as StorefrontProductsQueryDto;
    const data = await svc(req).listProducts(q);
    // Search terms are counted on the first page, so paging through results counts once.
    if (q.search && q.page === 1) await new StorefrontEngagement(req.ctx).recordSearch(q.search, data.total);
    envelope(res, { data });
  }),

  getProductBySlug: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).getProductBySlug(String(req.params.slug)) });
  }),

  categoriesTree: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).categoriesTree() });
  }),

  brands: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).brands() });
  }),

  cartPrices: ctrl(async (req: Req, res: Response) => {
    const body = req.body as CartPricesDto;
    envelope(res, { data: await svc(req).cartPrices(body.items, body.couponCode, body.email) });
  }),

  availableCoupons: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).availableCoupons() });
  }),

  applyCoupon: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).applyCoupon(req.body) });
  }),

  placeOrder: ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).placeOrder(req.body) });
  }),

  paymentMethods: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).paymentMethods() });
  }),

  getOrderByKey: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).getOrderByKey(String(req.params.orderKey)) });
  }),

  listMyOrders: ctrl(async (req: Req, res: Response) => {
    const { items, meta } = await svc(req).listMyOrders(req.query as never);
    envelope(res, { data: items, meta });
  }),

  getMyOrder: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).getMyOrder(String(req.params.orderRef)) });
  }),

  cancelMyOrder: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).cancelMyOrder(String(req.params.orderRef)), message: "Order cancelled" });
  }),
};
