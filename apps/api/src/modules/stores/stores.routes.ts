import { Router } from "express";
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
