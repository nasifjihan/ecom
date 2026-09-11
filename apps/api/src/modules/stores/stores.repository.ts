import { prisma } from "../../config";
import { BaseRepository, NotFoundError, type RequestContext } from "../../core";

export class StoreRepository extends BaseRepository<"store"> {
  constructor() {
    super("store");
  }

  async findBySlug(ctx: RequestContext, slug: string) {
    return this.findBy(ctx, { slug });
  }

  async findFull(ctx: RequestContext, id: bigint | number) {
    const store = await (this.q as any).findFirst({
      where: { id: BigInt(id) },
      include: {
        billingSub: true,
        domains: true,
        generalSettings: true,
        brandSettings: true,
        layoutSettings: true,
        emailSettings: true,
        seoSettings: true,
        securitySettings: true,
        localizationSettings: true,
      },
    });
    if (!store) throw new NotFoundError("store", id);
    return store;
  }

  async updateStatus(id: bigint | number, status: string) {
    return prisma.store.update({
      where: { id: BigInt(id) },
      data: { status },
    });
  }
}

export class DomainRepository extends BaseRepository<"domain"> {
  constructor() {
    super("domain");
  }

  async findByHostname(hostname: string) {
    return prisma.domain.findFirst({
      where: { hostname },
      include: { store: true },
    });
  }

  async listForStore(storeId: bigint | number) {
    return prisma.domain.findMany({
      where: { storeId: BigInt(storeId) },
      orderBy: { createdAt: "desc" },
    });
  }

  async setPrimary(storeId: bigint | number, domainId: bigint | number) {
    return prisma.$transaction([
      prisma.domain.updateMany({
        where: { storeId: BigInt(storeId) },
        data: { primary: false },
      }),
      prisma.domain.update({
        where: { id: BigInt(domainId) },
        data: { primary: true },
      }),
    ]);
  }
}

export class PlanRepository extends BaseRepository<"plan"> {
  constructor() {
    super("plan");
  }

  override async list(ctx: RequestContext) {
    void ctx;
    return prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
    });
  }

  async findByType(type: string) {
    return prisma.plan.findFirst({
      where: { type: type as any },
    });
  }
}
