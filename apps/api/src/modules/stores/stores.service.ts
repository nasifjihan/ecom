import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
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
  StoreOwnerDto,
  CreateDomainDto,
  UpdateDomainDto,
  StoreListQueryDto as StoreListQueryDtoType,
} from "./stores.dto";
import { PlatformService } from "../platform/platform.service";
import { STORE_ROLE_PERMISSIONS, roleNameFromSlug } from "./store-roles";

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

      const ownerRole = await this.ensureDefaultRoles(tx, store.id);
      if (dto.owner) await this.createOwnerTx(tx, store.id, ownerRole.id, dto.owner);

      return store;
    });

    return this.storeRepo.findFull(this.ctx, newStore.id);
  }

  /** Creates any missing built-in roles (owner, product_manager, ...) for a store; returns the owner role. */
  async ensureDefaultRoles(tx: Prisma.TransactionClient, storeId: bigint) {
    for (const [slug, perms] of Object.entries(STORE_ROLE_PERMISSIONS)) {
      const existing = await tx.role.findUnique({ where: { storeId_slug: { storeId, slug } } });
      if (existing) continue;
      await tx.role.create({
        data: {
          storeId,
          slug,
          name: roleNameFromSlug(slug),
          isSystem: true,
          permissions: { create: perms.map((permission) => ({ permission })) },
        },
      });
    }
    return tx.role.findUniqueOrThrow({ where: { storeId_slug: { storeId, slug: "owner" } } });
  }

  private async createOwnerTx(tx: Prisma.TransactionClient, storeId: bigint, roleId: bigint, owner: StoreOwnerDto) {
    const dup = await tx.adminUser.findUnique({ where: { storeId_email: { storeId, email: owner.email } } });
    if (dup) throw new ConflictError(`${owner.email} is already an admin of this store`, "CONFLICT");
    return tx.adminUser.create({
      data: {
        storeId,
        roleId,
        name: owner.name,
        email: owner.email,
        phone: owner.phone || null,
        passwordHash: await bcrypt.hash(owner.password, 12),
        status: "active",
      },
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
    });
  }

  /** Adds an owner login to an existing store (seeding its default roles first if it has none). */
  async createOwner(storeId: bigint, owner: StoreOwnerDto) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundError("store", storeId);
    return prisma.$transaction(async (tx) => {
      const role = await this.ensureDefaultRoles(tx, storeId);
      return this.createOwnerTx(tx, storeId, role.id, owner);
    });
  }

  async updateStore(id: bigint | number, dto: UpdateStoreDto) {
    const { trialDays, ...data } = dto as UpdateStoreDto & { trialDays?: number };
    const patch: Record<string, unknown> = { ...data };
    if (trialDays !== undefined) patch.trialEndsAt = trialDays > 0 ? new Date(Date.now() + trialDays * 86_400_000) : null;
    if (dto.planId !== undefined) {
      const plan = await prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestError(`Plan ${dto.planId} does not exist`, "NOT_FOUND");
    }
    const store = await this.storeRepo.update(this.ctx, id, patch as any);
    // Keep the billing subscription on the same plan as the store.
    if (dto.planId !== undefined) {
      await prisma.billingSubscription.updateMany({ where: { storeId: BigInt(id) }, data: { planId: dto.planId } });
    }
    // Status changes decide whether the tenant resolves, so drop its cached lookups.
    if (dto.status !== undefined) await this.dropStoreCache(id);
    return store;
  }

  private async dropStoreCache(id: bigint | number) {
    await cacheDel(CACHE_KEYS.store(String(id)));
    const domains = await this.domainRepo.listForStore(id);
    for (const d of domains) await cacheDel(CACHE_KEYS.storeByDomain(d.hostname));
  }

  async suspendStore(id: bigint | number) {
    const store = await this.storeRepo.updateStatus(id, "suspended");
    await this.dropStoreCache(id);
    return store;
  }

  async activateStore(id: bigint | number) {
    const store = await this.storeRepo.updateStatus(id, "active");
    await this.dropStoreCache(id);
    return store;
  }

  async cancelStore(id: bigint | number) {
    return this.storeRepo.updateStatus(id, "cancelled");
  }

  /** Platform store list with owner, primary domain, order totals and MRR per row. */
  async listStores(pagination: StoreListQueryDtoType): Promise<Paginated<any>> {
    const where: Record<string, unknown> = {};
    if (pagination.search) {
      const q = pagination.search;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { domains: { some: { hostname: { contains: q, mode: "insensitive" } } } },
        { admins: { some: { email: { contains: q, mode: "insensitive" } } } },
      ];
    }
    if (pagination.status) where.status = pagination.status;
    if (pagination.planId) where.planId = pagination.planId;
    const { status: _s, planId: _p, ...page } = pagination;
    const result = await this.storeRepo.paginate(this.ctx, {
      ...page,
      where,
      include: { plan: true, domains: { select: { hostname: true, type: true, primary: true } } },
    });

    const ids = result.data.map((s: { id: bigint }) => s.id);
    const platform = new PlatformService(this.ctx);
    const [aggs, owners] = await Promise.all([platform.storeAggregates(ids), platform.ownerEmails(ids)]);
    result.data = result.data.map((s: any) => {
      const sf = s.domains.filter((d: any) => d.type === "storefront");
      const domain = (sf.find((d: any) => d.primary) ?? sf[0] ?? s.domains[0])?.hostname ?? null;
      const agg = aggs.get(String(s.id));
      return {
        ...s,
        primaryDomain: domain,
        owner: owners.get(String(s.id)) ?? null,
        orders: agg?.orders ?? 0,
        revenue: Math.round((agg?.revenue ?? 0) * 100) / 100,
        mrr: s.status === "active" && s.plan ? Number(s.plan.priceMonthly) : 0,
      };
    });
    return result;
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
