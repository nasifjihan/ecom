import type { Request, Response } from "express";
import { ctrl, envelope, type RequestContext } from "../../core";
import { StorefrontService } from "./storefront.service";

type Req = Request & { ctx: RequestContext };
const svc = (req: Req) => new StorefrontService(req.ctx);

export const storefrontController = {
  listProducts: ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).listProducts(req.query as any) });
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
