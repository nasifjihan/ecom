import { prisma } from "../../config";
import type { RequestContext } from "../../core";
import { NotFoundError, ConflictError } from "../../core";
import type {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  BulkImportMethodsDto,
} from "./shipping.dto";

export class ShippingZoneRepository {
  get model() { return prisma.shippingZone as any; }

  private scope(storeId: bigint | undefined, extra: Record<string, any> = {}) {
    const where: any = { ...extra };
    if (storeId !== undefined) where.storeId = BigInt(storeId as any);
    return where;
  }

  async list(ctx: RequestContext, query: { search?: string; enabled?: boolean; page?: number; perPage?: number }) {
    const where: any = this.scope(ctx.storeId);
    if (query.enabled !== undefined) where.enabled = query.enabled;
    if (query.search) where.name = { contains: query.search, mode: "insensitive" };
    const perPage = Number(query.perPage ?? 20);
    const page = Number(query.page ?? 1);
    const skip = (page - 1) * perPage;
    const [rows, total] = await Promise.all([
      this.model.findMany({
        where, include: { _count: { select: { methods: true } } },
        skip, take: perPage, orderBy: { createdAt: "desc" },
      }),
      this.model.count({ where }),
    ]);
    return { rows, total, page, perPage };
  }

  async get(ctx: RequestContext, id: bigint) {
    const row = await this.model.findFirst({
      where: { ...this.scope(ctx.storeId), id }, include: { methods: true },
    });
    if (!row) throw new NotFoundError("Shipping zone", String(id));
    return row;
  }

  async create(ctx: RequestContext, dto: CreateShippingZoneDto) {
    return this.model.create({
      data: {
        storeId: ctx.storeId !== undefined ? BigInt(ctx.storeId as any) : (dto as any).storeId,
        name: dto.name,
        enabled: dto.enabled,
        zoneType: (dto as any).zoneType ?? "suburban",
        countries: dto.regions.map((r) => r.countryCode),
        states: dto.regions.flatMap((r) => [...(r.divisions || []), ...(r.districts || [])]),
        postcodes: dto.regions.flatMap((r) => r.postcodeRanges || []),
      },
    });
  }

  async update(ctx: RequestContext, id: bigint, dto: UpdateShippingZoneDto) {
    await this.get(ctx, id);
    const patch: any = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if ((dto as any).zoneType !== undefined) patch.zoneType = (dto as any).zoneType;
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    if (dto.regions !== undefined) {
      patch.countries = dto.regions.map((r) => r.countryCode);
      patch.states = dto.regions.flatMap((r) => [...(r.divisions || []), ...(r.districts || [])]);
      patch.postcodes = dto.regions.flatMap((r) => r.postcodeRanges || []);
    }
    return this.model.update({ where: { id }, data: patch, include: { methods: true } });
  }

  async delete(ctx: RequestContext, id: bigint) {
    await this.get(ctx, id);
    return this.model.delete({ where: { id } });
  }

  async matchZonesForAddress(ctx: RequestContext, address: { countryCode: string; division?: string; district?: string; postcode?: string }) {
    const rows: any[] = await this.model.findMany({
      // ShippingZone has no `enabled` column (only ShippingMethod does).
      where: this.scope(ctx.storeId),
      include: { methods: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { id: "asc" },
    });
    return rows.filter((z) => {
      const countries: string[] = Array.isArray(z.countries) ? z.countries : [];
      if (!countries.includes(address.countryCode) && !countries.includes("*")) return false;
      const states: string[] = Array.isArray(z.states) ? z.states : [];
      if (states.length > 0) {
        const hits = [address.division, address.district].filter(Boolean) as string[];
        const lower = states.map((s) => String(s).toLowerCase());
        if (hits.length && !hits.some((h) => lower.includes(String(h).toLowerCase()))) return false;
      }
      const pcs: string[] = Array.isArray(z.postcodes) ? z.postcodes : [];
      if (pcs.length > 0 && address.postcode) {
        const pc = String(address.postcode);
        const ok = pcs.some((p) => {
          if (p === "*") return true;
          if (p === pc) return true;
          if (p.includes("-")) {
            const parts = p.split("-");
            const a = parseInt(parts[0] ?? "", 10);
            const b = parseInt(parts[1] ?? "", 10);
            const n = parseInt(pc, 10);
            if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(n)) return n >= a && n <= b;
          }
          return false;
        });
        if (!ok) return false;
      }
      return true;
    });
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
    const rules: any = { perKgExtra: dto.perKgExtra, minimumCost: dto.minimumCost };
    return this.model.create({
      data: {
        zoneId: dto.zoneId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        provider: dto.provider,
        methodType: dto.methodType,
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
    const patch: any = {};
    for (const k of Object.keys(dto)) {
      const val = (dto as any)[k];
      if (val !== undefined) patch[k] = val;
    }
    if (dto.perKgExtra !== undefined || dto.minimumCost !== undefined) {
      const existing = typeof prev.costRules === "string" ? JSON.parse(prev.costRules || "{}") : prev.costRules || {};
      const rules: any = { ...existing };
      if (dto.perKgExtra !== undefined) rules.perKgExtra = dto.perKgExtra;
      if (dto.minimumCost !== undefined) rules.minimumCost = dto.minimumCost;
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
