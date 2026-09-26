import { Router, type Request, type Response } from "express";
import { prisma } from "../../config";
import { ctrl, envelope, paginate, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { storesController } from "./stores.controller";
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateDomainDto,
  UpdateDomainDto,
  PaginationDto,
  StoreIdParamDto,
  DomainIdParamDto,
  StoreDomainQueryDto,
} from "./stores.dto";

export const superStoresRouter = Router();

superStoresRouter
  .route("/")
  .get(
    authMiddleware("super"),
    rbacMiddleware("settings.read"),
    validate({ query: PaginationDto }),
    storesController.listStores,
  )
  .post(
    authMiddleware("super"),
    rbacMiddleware("settings.create"),
    validate({ body: CreateStoreDto }),
    storesController.createStore,
  );

superStoresRouter
  .route("/:id")
  .get(
    authMiddleware("super"),
    rbacMiddleware("settings.read"),
    validate({ params: StoreIdParamDto }),
    storesController.getStore,
  )
  .patch(
    authMiddleware("super"),
    rbacMiddleware("settings.update"),
    validate({ params: StoreIdParamDto, body: UpdateStoreDto }),
    storesController.updateStore,
  )
  .delete(
    authMiddleware("super"),
    rbacMiddleware("settings.delete"),
    validate({ params: StoreIdParamDto }),
    storesController.deleteStore,
  );

superStoresRouter.post(
  "/:id/suspend",
  authMiddleware("super"),
  rbacMiddleware("settings.update"),
  validate({ params: StoreIdParamDto }),
  storesController.suspendStore,
);

superStoresRouter.post(
  "/:id/activate",
  authMiddleware("super"),
  rbacMiddleware("settings.update"),
  validate({ params: StoreIdParamDto }),
  storesController.activateStore,
);

export const superDomainsRouter = Router();

superDomainsRouter
  .route("/")
  .get(
    authMiddleware("super"),
    rbacMiddleware("settings.read"),
    validate({ query: StoreDomainQueryDto }),
    storesController.listDomains,
  )
  .post(
    authMiddleware("super"),
    rbacMiddleware("settings.create"),
    validate({ body: CreateDomainDto }),
    storesController.createDomain,
  );

superDomainsRouter
  .route("/:id")
  .get(
    authMiddleware("super"),
    rbacMiddleware("settings.read"),
    validate({ params: DomainIdParamDto }),
    storesController.getDomain,
  )
  .patch(
    authMiddleware("super"),
    rbacMiddleware("settings.update"),
    validate({ params: DomainIdParamDto, body: UpdateDomainDto }),
    storesController.updateDomain,
  )
  .delete(
    authMiddleware("super"),
    rbacMiddleware("settings.delete"),
    validate({ params: DomainIdParamDto }),
    storesController.deleteDomain,
  );

export const storeSelfRouter = Router();

storeSelfRouter
  .route("/me")
  .get(
    authMiddleware("admin"),
    rbacMiddleware(["store.read", "store.settings.read"]),
    storesController.getStoreMe,
  )
  .patch(
    authMiddleware("admin"),
    rbacMiddleware(["store.settings.update", "store.owner"]),
    validate({ body: UpdateStoreDto }),
    storesController.updateStoreMe,
  );

export const superPlansRouter = Router();

superPlansRouter.get(
  "/",
  authMiddleware("super"),
  storesController.listPlans,
);

/** Platform billing subscriptions (one per store), newest first. Read-only until Stripe billing lands. */
export const superSubscriptionsRouter = Router();

superSubscriptionsRouter.get(
  "/",
  authMiddleware("super"),
  rbacMiddleware("settings.read"),
  validate({ query: PaginationDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const q = req.query as unknown as { page: number; perPage: number; search?: string };
    const where = q.search ? { store: { name: { contains: q.search, mode: "insensitive" as const } } } : {};
    const [rows, total] = await Promise.all([
      prisma.billingSubscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { store: { select: { id: true, name: true, status: true } }, plan: true },
      }),
      prisma.billingSubscription.count({ where }),
    ]);
    const page = paginate({ items: rows, total, page: q.page, perPage: q.perPage });
    envelope(res, { status: 200, data: page.data, meta: page.meta });
  }),
);
