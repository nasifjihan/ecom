import type { Prisma } from "@prisma/client";
import { prisma } from "../../config";
import type { RequestContext } from "../../core";
import { BadRequestError, NotFoundError, ConflictError } from "../../core";
import { parseRules, zoneSpecificity, type AddressForMatch } from "./shipping.rules";
import type {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  BulkImportMethodsDto,
} from "./shipping.dto";

const ZONE_INCLUDE = {
  locations: { select: { location: { select: { id: true, code: true, type: true, nameEn: true, nameBn: true } } } },
  _count: { select: { methods: true } },
} as const;

/** API shape: `locations` flattened from the join rows. */
const shapeZone = (z: any) => z && {
  ...z,
  locations: (z.locations ?? []).map((l: any) => l.location),
  locationIds: (z.locations ?? []).map((l: any) => String(l.location.id)),
};

export class ShippingZoneRepository {
  get model() { return prisma.shippingZone; }

  private storeOf(ctx: RequestContext): bigint {
    if (ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    return BigInt(ctx.storeId as any);
  }

  async list(ctx: RequestContext, query: { search?: string; enabled?: string | boolean; page?: number; perPage?: number }) {
    const where: Prisma.ShippingZoneWhereInput = { storeId: this.storeOf(ctx) };
    if (query.enabled !== undefined) where.enabled = String(query.enabled) === "true";
    if (query.search) where.name = { contains: query.search, mode: "insensitive" };
    const perPage = Number(query.perPage ?? 20);
    const page = Number(query.page ?? 1);
    const [rows, total] = await Promise.all([
      this.model.findMany({
        where, include: ZONE_INCLUDE,
        skip: (page - 1) * perPage, take: perPage, orderBy: { id: "asc" },
      }),
      this.model.count({ where }),
    ]);
    return { rows: rows.map(shapeZone), total, page, perPage };
  }

  async get(ctx: RequestContext, id: bigint) {
    const row = await this.model.findFirst({
      where: { storeId: this.storeOf(ctx), id },
      include: { ...ZONE_INCLUDE, methods: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
    });
    if (!row) throw new NotFoundError("Shipping zone", String(id));
    return shapeZone(row);
  }

  private async checkLocations(ids: bigint[]) {
    if (!ids.length) return;
    const found = await prisma.location.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids.map(String)).size) throw new BadRequestError("One or more areas don't exist", "LOCATION_NOT_FOUND");
  }

  async create(ctx: RequestContext, dto: CreateShippingZoneDto) {
    const storeId = this.storeOf(ctx);
    await this.checkLocations(dto.locationIds);
    const zone = await prisma.$transaction(async (t) => {
      const z = await t.shippingZone.create({
        data: { storeId, name: dto.name, enabled: dto.enabled, countries: dto.countries, states: [], postcodes: dto.postcodes },
      });
      if (dto.locationIds.length) {
        await t.shippingZoneLocation.createMany({
          data: dto.locationIds.map((locationId) => ({ zoneId: z.id, locationId })),
          skipDuplicates: true,
        });
      }
      return z;
    });
    return this.get(ctx, zone.id);
  }

  async update(ctx: RequestContext, id: bigint, dto: UpdateShippingZoneDto) {
    await this.get(ctx, id);
    if (dto.locationIds) await this.checkLocations(dto.locationIds);
    await prisma.$transaction(async (t) => {
      const patch: Prisma.ShippingZoneUpdateInput = {};
      if (dto.name !== undefined) patch.name = dto.name;
      if (dto.enabled !== undefined) patch.enabled = dto.enabled;
      if (dto.countries !== undefined) patch.countries = dto.countries;
      if (dto.postcodes !== undefined) patch.postcodes = dto.postcodes;
      if (dto.locationIds !== undefined) {
        // Locations replace the free-text names zones used before.
        patch.states = [];
        await t.shippingZoneLocation.deleteMany({ where: { zoneId: id } });
        await t.shippingZoneLocation.createMany({
          data: dto.locationIds.map((locationId) => ({ zoneId: id, locationId })),
          skipDuplicates: true,
        });
      }
      await t.shippingZone.update({ where: { id }, data: patch });
    });
    return this.get(ctx, id);
  }

  async delete(ctx: RequestContext, id: bigint) {
    await this.get(ctx, id);
    return this.model.delete({ where: { id } });
  }

  /** Every enabled zone that matches the address, with how specifically it matches. */
  async matchZonesForAddress(ctx: RequestContext, address: AddressForMatch) {
    const rows = await this.model.findMany({
      where: { storeId: this.storeOf(ctx), enabled: true },
      include: {
        locations: { select: { locationId: true } },
        methods: { where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
      orderBy: { id: "asc" },
    });
    const out: (typeof rows[number] & { specificity: number })[] = [];
    for (const z of rows) {
      const specificity = zoneSpecificity({ ...z, locationIds: z.locations.map((l) => l.locationId) }, address);
      if (specificity !== null) out.push({ ...z, specificity });
    }
    return out;
  }
}

export class ShippingMethodRepository {
  get model() { return prisma.shippingMethod as any; }
  private scopeStore(ctx: RequestContext, extra: Record<string, any> = {}) {
    const where: any = { ...extra };
    if (ctx.storeId !== undefined) {
      where.zone = { storeId: BigInt(ctx.storeId as any) };
    }
    return where;
  }

  async listByZone(ctx: RequestContext, zoneId: bigint) {
    return this.model.findMany({
      where: this.scopeStore(ctx, { zoneId }),
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  async get(ctx: RequestContext, id: bigint) {
    const row = await this.model.findFirst({ where: this.scopeStore(ctx, { id }) });
    if (!row) throw new NotFoundError("Shipping method", String(id));
    return row;
  }

  async create(ctx: RequestContext, dto: CreateShippingMethodDto) {
    const exists = await this.model.findFirst({ where: { zoneId: dto.zoneId, code: dto.code } });
    if (exists) throw new ConflictError("Duplicate shipping code in zone", "DUPLICATE_SHIPPING_CODE_ZONE");
    await new ShippingZoneRepository().get(ctx, dto.zoneId);
    const rules = { perKgExtra: dto.perKgExtra, minimumCost: dto.minimumCost, weightTiers: dto.weightTiers, minSubtotal: dto.minSubtotal };
    return this.model.create({
      data: {
        zoneId: dto.zoneId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        enabled: dto.enabled,
        sortOrder: dto.sortOrder,
        baseCost: dto.baseCost,
        perItemCost: dto.perItemCost,
        costRules: JSON.stringify(rules),
        freeFromSubtotal: dto.freeFromSubtotal ?? null,
        deliveryEstimateMinDays: dto.deliveryEstimateMinDays ?? null,
        deliveryEstimateMaxDays: dto.deliveryEstimateMaxDays ?? null,
        taxClassId: dto.taxClassId ?? null,
      },
    });
  }

  async update(ctx: RequestContext, id: bigint, dto: UpdateShippingMethodDto) {
    const prev = await this.get(ctx, id);
    const RULE_KEYS = ["perKgExtra", "minimumCost", "weightTiers", "minSubtotal"] as const;
    const patch: any = {};
    for (const k of Object.keys(dto)) {
      const val = (dto as any)[k];
      if (val !== undefined && !(RULE_KEYS as readonly string[]).includes(k)) patch[k] = val;
    }
    if (RULE_KEYS.some((k) => (dto as any)[k] !== undefined)) {
      const rules: any = { ...parseRules(prev.costRules) };
      for (const k of RULE_KEYS) if ((dto as any)[k] !== undefined) rules[k] = (dto as any)[k];
      patch.costRules = JSON.stringify(rules);
    }
    return this.model.update({ where: { id }, data: patch });
  }

  async delete(ctx: RequestContext, id: bigint) {
    await this.get(ctx, id);
    return this.model.delete({ where: { id } });
  }

  async bulkImport(ctx: RequestContext, dto: BulkImportMethodsDto) {
    let created = 0, updated = 0, skipped = 0;
    for (const row of dto.rows) {
      const existing = await this.model.findFirst({ where: { zoneId: dto.zoneId, code: row.code } });
      if (existing && !dto.overwrite) { skipped++; continue; }
      if (existing && dto.overwrite) {
        await this.update(ctx, existing.id, row as any);
        updated++;
      } else {
        await this.create(ctx, { zoneId: dto.zoneId, ...row } as any);
        created++;
      }
    }
    return { created, updated, skipped, total: dto.rows.length };
  }

  async exportRows(ctx: RequestContext, zoneId?: bigint) {
    const where: any = this.scopeStore(ctx);
    if (zoneId) where.zoneId = zoneId;
    return this.model.findMany({
      where,
      include: { zone: { select: { name: true, id: true, storeId: true } } },
      orderBy: [{ zoneId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
  }
}

export class TaxRateRepository {
  get model() { return prisma.taxRate as any; }
  private scope(ctx: RequestContext, extra: Record<string, any> = {}) {
    const where: any = { ...extra };
    return where;
  }

  async list(ctx: RequestContext, q: { page?: number; perPage?: number; taxClassId?: bigint; countryCode?: string }) {
    const where: any = this.scope(ctx);
    if (q.taxClassId) where.taxClassId = q.taxClassId;
    if (q.countryCode) where.countryCode = q.countryCode;
    const perPage = Number(q.perPage ?? 20);
    const page = Number(q.page ?? 1);
    const skip = (page - 1) * perPage;
    const [rows, total] = await Promise.all([
      this.model.findMany({
        where, include: { taxClass: { select: { name: true, storeId: true } } },
        skip, take: perPage, orderBy: { priority: "asc" },
      }),
      this.model.count({ where }),
    ]);
    const filtered = ctx.storeId === undefined ? rows : rows.filter((r: any) => r.taxClass?.storeId === undefined || r.taxClass.storeId === ctx.storeId);
    return { rows: filtered, total: filtered.length, page, perPage };
  }

  async get(ctx: RequestContext, id: bigint) {
    const row = await this.model.findUnique({ where: { id }, include: { taxClass: { select: { storeId: true, name: true } } } });
    if (!row) throw new NotFoundError("Tax rate", String(id));
    if (ctx.storeId !== undefined && row.taxClass?.storeId !== undefined && row.taxClass.storeId !== ctx.storeId) {
      throw new NotFoundError("Tax rate", String(id));
    }
    return row;
  }

  async create(_ctx: RequestContext, dto: any) {
    return this.model.create({ data: dto });
  }

  async update(ctx: RequestContext, id: bigint, dto: any) {
    await this.get(ctx, id);
    return this.model.update({ where: { id }, data: dto });
  }

  async delete(ctx: RequestContext, id: bigint) {
    await this.get(ctx, id);
    return this.model.delete({ where: { id } });
  }

  async resolveForAddress(ctx: RequestContext, address: { countryCode: string; state?: string; city?: string; postcode?: string; taxClassId?: bigint; subtotal: number; shippingTotal: number }) {
    const where: any = this.scope(ctx);
    if (address.taxClassId) where.taxClassId = address.taxClassId;
    const rows: any[] = await this.model.findMany({
      where, orderBy: { priority: "asc" }, include: { taxClass: { select: { storeId: true } } },
    });
    const filtered = ctx.storeId !== undefined ? rows.filter((r) => r.taxClass?.storeId === undefined || r.taxClass.storeId === ctx.storeId) : rows;
    const matched = filtered.filter((r) => {
      if (r.countryCode !== address.countryCode && r.countryCode !== "*") return false;
      if (r.state && address.state && String(r.state).toLowerCase() !== String(address.state).toLowerCase()) return false;
      if (r.city && address.city && String(r.city).toLowerCase() !== String(address.city).toLowerCase()) return false;
      if (r.postcode && address.postcode && String(r.postcode) !== String(address.postcode)) return false;
      return true;
    });
    const breakdown: { name: string; ratePct: number; base: number; amount: number; compound: boolean }[] = [];
    let runningBase = Number(address.subtotal || 0);
    let totalTax = 0;
    const sorted = matched.slice().sort((a, b) => {
      const ac = a.compound ? 1 : 0; const bc = b.compound ? 1 : 0; return ac - bc;
    });
    for (const r of sorted) {
      const ratePct = Number(r.rate || 0);
      const base = Math.round((runningBase + (r.compound ? totalTax + Number(address.shippingTotal || 0) : 0)) * 100) / 100;
      const amount = Math.round(base * ratePct) / 100;
      breakdown.push({ name: r.name, ratePct, base, amount, compound: !!r.compound });
      totalTax += amount;
    }
    const firstSimple = matched.find((r) => !r.compound);
    const shipTax = firstSimple ? Math.round(Number(address.shippingTotal || 0) * Number(firstSimple.rate || 0)) / 100 : 0;
    totalTax = Math.round((totalTax + shipTax) * 100) / 100;
    if (breakdown.length === 0 && address.countryCode === "BD") {
      const subtotal = Number(address.subtotal || 0);
      const ship = Number(address.shippingTotal || 0);
      breakdown.push({ name: "VAT 15% (default)", ratePct: 15, base: Math.round(subtotal * 100) / 100, amount: Math.round(subtotal * 15) / 100, compound: false });
      if (ship > 0) breakdown.push({ name: "VAT 15% (shipping)", ratePct: 15, base: Math.round(ship * 100) / 100, amount: Math.round(ship * 15) / 100, compound: false });
      totalTax = breakdown.reduce((s, b) => s + b.amount, 0);
    }
    const maxRate = breakdown.reduce((m, b) => Math.max(m, b.ratePct), 0);
    return {
      effectiveTaxRatePct: Number(maxRate.toFixed(2)),
      primaryName: breakdown[0]?.name ?? "No tax",
      totalTax: Math.round(totalTax * 100) / 100,
      breakdown,
    };
  }
}

export {};
