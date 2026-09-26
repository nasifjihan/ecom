import { prisma, cacheDel, CACHE_KEYS } from "../../config";
import {
  BaseService,
  ConflictError,
  BadRequestError,
  NotFoundError,
  type RequestContext,
  type Paginated,
} from "../../core";
import { StoreRepository, DomainRepository, PlanRepository } from "./stores.repository";
import type {
  CreateStoreDto,
  UpdateStoreDto,
  CreateDomainDto,
  UpdateDomainDto,
  PaginationDto as PaginationDtoType,
} from "./stores.dto";

export class StoresService extends BaseService {
  private storeRepo: StoreRepository;
  private domainRepo: DomainRepository;
  private planRepo: PlanRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.storeRepo = new StoreRepository();
    this.domainRepo = new DomainRepository();
    this.planRepo = new PlanRepository();
  }

  async createStore(dto: CreateStoreDto) {
    const existing = await this.storeRepo.findBySlug(this.ctx, dto.slug);
    if (existing) {
      throw new ConflictError(`Slug "${dto.slug}" is already taken`, "DUPLICATE_SLUG");
    }

    if (dto.planId !== undefined) {
      const plan = await prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestError(`Plan ${dto.planId} does not exist`, "NOT_FOUND");
    }

    let trialEndsAt: Date | undefined = undefined;
    if (dto.trialDays !== undefined && dto.trialDays > 0) {
      trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + dto.trialDays);
    }

    const newStore = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          planId: dto.planId,
          status: dto.status,
          trialEndsAt,
        },
      });

      await tx.storeGeneralSetting.create({
        data: {
          storeId: store.id,
          tagline: "",
          logoUrl: "",
          faviconUrl: "",
          emailFrom: "",
          emailFromName: "",
          phone: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          postalCode: "",
          countryCode: "",
          maintenanceMode: false,
          maintenanceMsg: "",
        },
      });

      await tx.storeBrandSetting.create({
        data: {
          storeId: store.id,
        },
      });

      await tx.storeLayoutSetting.create({
        data: {
          storeId: store.id,
        },
      });

      await tx.storeEmailSetting.create({
        data: {
          storeId: store.id,
          host: null,
          port: null,
          encryption: null,
          username: null,
          password: null,
          fromAddress: "",
          fromName: "",
          templateHeader: "",
          templateFooter: "",
          accentColor: "",
          logoUrl: "",
        },
      });

      await tx.storeSeoSetting.create({
        data: {
          storeId: store.id,
          homeSeoTitle: "",
          homeMetaDescription: "",
          ogImageUrl: "",
          robotsTxt: "",
          googleAnalyticsId: "",
          googleTagManagerId: "",
          facebookPixelId: "",
        },
      });

      await tx.storeSecuritySetting.create({
        data: {
          storeId: store.id,
          adminIpWhitelist: [],
          recaptchaSiteKey: "",
          recaptchaSecret: "",
        },
      });

      await tx.storeLocalizationSetting.create({
        data: {
          storeId: store.id,
          allowedCurrencies: [],
          allowedLanguages: [],
        },
      });

      return store;
    });

    return this.storeRepo.findFull(this.ctx, newStore.id);
  }

  async updateStore(id: bigint | number, dto: UpdateStoreDto) {
    return this.storeRepo.update(this.ctx, id, dto as any);
  }

  async suspendStore(id: bigint | number) {
    const store = await this.storeRepo.updateStatus(id, "suspended");
    await cacheDel(CACHE_KEYS.store(String(id)));
    const domains = await this.domainRepo.listForStore(id);
    for (const d of domains) {
      await cacheDel(CACHE_KEYS.storeByDomain(d.hostname));
    }
    return store;
  }

  async activateStore(id: bigint | number) {
    return this.storeRepo.updateStatus(id, "active");
  }

  async cancelStore(id: bigint | number) {
    return this.storeRepo.updateStatus(id, "cancelled");
  }

  async listStores(pagination: PaginationDtoType): Promise<Paginated<any>> {
    const where: Record<string, unknown> = {};
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: "insensitive" } },
        { slug: { contains: pagination.search, mode: "insensitive" } },
      ];
    }
    return this.storeRepo.paginate(this.ctx, {
      ...pagination,
      where,
      // Enough for the super-admin stores table: primary domain, owner, country, subscription, volumes.
      include: {
        plan: true,
        billingSub: { include: { plan: true } },
        domains: { select: { hostname: true, primary: true, type: true } },
        generalSettings: { select: { countryCode: true } },
        admins: { where: { role: { slug: "owner" } }, select: { email: true, name: true }, take: 1 },
        _count: { select: { orders: true, products: true, customers: true } },
      },
    });
  }

  async getStoreFull(ctx: RequestContext, id: bigint | number) {
    return this.storeRepo.findFull(ctx, id);
  }

  async createDomain(dto: CreateDomainDto) {
    const existing = await this.domainRepo.findByHostname(dto.hostname);
    if (existing) {
      throw new ConflictError(`Hostname "${dto.hostname}" is already in use`, "CONFLICT");
    }

    const domain = await prisma.domain.create({
      data: {
        storeId: dto.storeId,
        hostname: dto.hostname,
        type: dto.type,
        primary: dto.primary,
        sslEnabled: dto.sslEnabled,
      },
    });

    if (dto.primary) {
      await this.domainRepo.setPrimary(dto.storeId, domain.id);
    }

    await cacheDel(CACHE_KEYS.storeByDomain(dto.hostname));
    return prisma.domain.findUnique({ where: { id: domain.id }, include: { store: true } });
  }

  async updateDomain(id: bigint | number, dto: UpdateDomainDto) {
    const existing = await prisma.domain.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new NotFoundError("domain", id);

    if (dto.hostname && dto.hostname !== existing.hostname) {
      const dup = await this.domainRepo.findByHostname(dto.hostname);
      if (dup) {
        throw new ConflictError(`Hostname "${dto.hostname}" is already in use`, "CONFLICT");
      }
      await cacheDel(CACHE_KEYS.storeByDomain(existing.hostname));
    }

    const updated = await prisma.domain.update({
      where: { id: BigInt(id) },
      data: dto,
    });

    if (dto.primary && dto.primary === true) {
      await this.domainRepo.setPrimary(updated.storeId, updated.id);
    }

    if (dto.hostname) {
      await cacheDel(CACHE_KEYS.storeByDomain(dto.hostname));
    }

    return prisma.domain.findUnique({ where: { id: updated.id }, include: { store: true } });
  }

  async deleteDomain(id: bigint | number) {
    const existing = await prisma.domain.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new NotFoundError("domain", id);
    await cacheDel(CACHE_KEYS.storeByDomain(existing.hostname));
    await prisma.domain.delete({ where: { id: BigInt(id) } });
    return { success: true as const, id };
  }

  async listDomains(storeId?: bigint | number) {
    if (storeId !== undefined) {
      return this.domainRepo.listForStore(storeId);
    }
    return prisma.domain.findMany({
      include: { store: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPlans() {
    return this.planRepo.list(this.ctx);
  }
}
