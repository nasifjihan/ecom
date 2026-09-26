import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext, NotFoundError } from "../../core";
import { prisma } from "../../config";
import { StoresService } from "./stores.service";
import type {
  CreateStoreDto as CreateStoreDtoType,
  UpdateStoreDto as UpdateStoreDtoType,
  CreateDomainDto as CreateDomainDtoType,
  UpdateDomainDto as UpdateDomainDtoType,
  StoreListQueryDto as StoreListQueryDtoType,
  StoreDomainQueryDto as StoreDomainQueryDtoType,
} from "./stores.dto";

class StoresController extends BaseController {
  listStores = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const query = req.query as unknown as StoreListQueryDtoType;
    const result = await svc.listStores(query);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  createStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const dto = req.body as CreateStoreDtoType;
    const store = await svc.createStore(dto);
    envelope(res, { status: 201, data: store, message: "CREATED" });
  });

  getStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    const store = await svc.getStoreFull(req.ctx, id);
    envelope(res, { status: 200, data: store });
  });

  updateStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    const dto = req.body as UpdateStoreDtoType;
    const store = await svc.updateStore(id, dto);
    envelope(res, { status: 200, data: store });
  });

  deleteStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    await svc.suspendStore(id);
    envelope(res, { status: 200, message: "Deleted" });
  });

  suspendStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    const store = await svc.suspendStore(id);
    envelope(res, { status: 200, data: store });
  });

  activateStore = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    const store = await svc.activateStore(id);
    envelope(res, { status: 200, data: store });
  });

  listDomains = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const query = req.query as unknown as StoreDomainQueryDtoType;
    const domains = await svc.listDomains(query.storeId);
    envelope(res, { status: 200, data: domains });
  });

  createDomain = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const dto = req.body as CreateDomainDtoType;
    const domain = await svc.createDomain(dto);
    envelope(res, { status: 201, data: domain, message: "CREATED" });
  });

  getDomain = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const id = BigInt((req.params as any).id);
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: { store: true },
    });
    if (!domain) throw new NotFoundError("domain", id);
    envelope(res, { status: 200, data: domain });
  });

  updateDomain = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    const dto = req.body as UpdateDomainDtoType;
    const domain = await svc.updateDomain(id, dto);
    envelope(res, { status: 200, data: domain });
  });

  deleteDomain = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = BigInt((req.params as any).id);
    await svc.deleteDomain(id);
    envelope(res, { status: 200, message: "Deleted" });
  });

  getStoreMe = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = req.ctx.storeId!;
    const store = await svc.getStoreFull(req.ctx, id);
    envelope(res, { status: 200, data: store });
  });

  updateStoreMe = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const id = req.ctx.storeId!;
    const dto = req.body as UpdateStoreDtoType;
    const filtered: any = {};
    for (const key of Object.keys(dto)) {
      if (key !== "status" && key !== "planId" && key !== "trialDays") {
        filtered[key] = (dto as any)[key];
      }
    }
    const store = await svc.updateStore(id, filtered);
    envelope(res, { status: 200, data: store });
  });

  listPlans = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = new StoresService(req.ctx);
    const plans = await svc.listPlans();
    envelope(res, { status: 200, data: plans });
  });
}

export const storesController = new StoresController();
