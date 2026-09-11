import type { RequestContext } from "../../core";
import { ShippingZoneRepository, ShippingMethodRepository, TaxRateRepository } from "./shipping.repository";
import type {
  CreateShippingZoneDto, UpdateShippingZoneDto,
  CreateShippingMethodDto, UpdateShippingMethodDto, BulkImportMethodsDto,
  CreateTaxRateDto, UpdateTaxRateDto,
  ShippingRatesQueryDto, TaxesForAddressDto,
} from "./shipping.dto";
import { BadRequestError } from "../../core";
import {
  generateCsv, generateXlsx, generatePdf,
  attachmentHeader, formatTimestampFilename,
} from "@ecom/export-utils";

export class ShippingService {
  private zones = new ShippingZoneRepository();
  private methods = new ShippingMethodRepository();
  private taxes = new TaxRateRepository();

  listZones(ctx: RequestContext, q: any) { return this.zones.list(ctx, q); }
  getZone(ctx: RequestContext, id: bigint) { return this.zones.get(ctx, id); }
  createZone(ctx: RequestContext, d: CreateShippingZoneDto) { return this.zones.create(ctx, d); }
  updateZone(ctx: RequestContext, id: bigint, d: UpdateShippingZoneDto) { return this.zones.update(ctx, id, d); }
  deleteZone(ctx: RequestContext, id: bigint) { return this.zones.delete(ctx, id); }

  listMethods(ctx: RequestContext, zoneId: bigint) { return this.methods.listByZone(ctx, zoneId); }
  createMethod(ctx: RequestContext, d: CreateShippingMethodDto) { return this.methods.create(ctx, d); }
  updateMethod(ctx: RequestContext, id: bigint, d: UpdateShippingMethodDto) { return this.methods.update(ctx, id, d); }
  deleteMethod(ctx: RequestContext, id: bigint) { return this.methods.delete(ctx, id); }
  bulkImport(ctx: RequestContext, d: BulkImportMethodsDto) { return this.methods.bulkImport(ctx, d); }

  listTaxes(ctx: RequestContext, q: any) { return this.taxes.list(ctx, q); }
  createTax(ctx: RequestContext, d: CreateTaxRateDto) { return this.taxes.create(ctx, d); }
  updateTax(ctx: RequestContext, id: bigint, d: UpdateTaxRateDto) { return this.taxes.update(ctx, id, d); }
  deleteTax(ctx: RequestContext, id: bigint) { return this.taxes.delete(ctx, id); }

  private roundUpHalfKg(kg: number): number {
    if (!kg || kg <= 0) return 0;
    return Math.ceil(kg * 2) / 2;
  }

  async computeShippingOptions(ctx: RequestContext, q: ShippingRatesQueryDto) {
    if (q.zoneId) {
      const zone = await this.zones.get(ctx, q.zoneId);
      const options = this.buildOptions((zone as any).methods || [], q);
      return this.optionsWrap(options);
    }
    if (!q.countryCode) throw new BadRequestError("Provide zoneId or countryCode", "SHIPPING_PARAM_MISSING");
    const address = { countryCode: q.countryCode, division: q.division, district: q.district, postcode: q.postcode };
    const zones = await this.zones.matchZonesForAddress(ctx, address);
    if (zones.length === 0 && q.countryCode !== "BD") {
      return { zonesMatched: 0, options: [], cheapest: null, fastest: null, reason: `No shipping zones configured for ${q.countryCode} — International delivery not available.` };
    }
    const allMethods = zones.flatMap((z: any) => z.methods || []);
    const options = this.buildOptions(allMethods, q);
    return this.optionsWrap(options);
  }

  private buildOptions(methods: any[], q: ShippingRatesQueryDto) {
    const subtotal = Number(q.subtotal || 0);
    const weightKG = Number(q.weightKG || 0);
    const qty = Number(q.qty || 0);
    const weightChargable = this.roundUpHalfKg(weightKG);
    return methods.map((m: any) => {
      const rules = m.costRules ? (typeof m.costRules === "string" ? JSON.parse(m.costRules) : m.costRules) : {};
      const perKgExtra = Number(rules.perKgExtra ?? 0);
      const minCost = Number(rules.minimumCost ?? 0);
      const base = Number(m.baseCost || 0);
      const perItem = Number(m.perItemCost || 0) * qty;
      const weightExtra = weightChargable > 0.5 ? Math.max(0, weightChargable - 0.5) * perKgExtra : 0;
      let finalRate = base + perItem + weightExtra;
      let savingsBDT = 0;
      const freeAbove = Number(m.freeFromSubtotal ?? 0);
      let freeReason: string | null = null;
      if (freeAbove > 0 && subtotal >= freeAbove && m.enabled !== false) {
        savingsBDT = Math.round(finalRate * 100) / 100;
        finalRate = 0;
        freeReason = `Order subtotal ${subtotal.toFixed(2)} >= ${freeAbove.toFixed(2)} → ${m.name} FREE`;
      } else {
        finalRate = Math.max(finalRate, minCost);
      }
      finalRate = Math.round(finalRate * 100) / 100;
      return {
        id: m.id, zoneId: m.zoneId,
        provider: m.provider, code: m.code, methodType: m.methodType, name: m.name,
        description: m.description ?? null,
        baseRate: Number(m.baseCost || 0), weightChargableKG: weightChargable, perKgExtra,
        finalRateBDT: finalRate, savingsBDT, freeReason,
        transit: { minDays: m.deliveryEstimateMinDays ?? null, maxDays: m.deliveryEstimateMaxDays ?? null },
      };
    }).sort((a, b) => a.finalRateBDT - b.finalRateBDT);
  }

  private optionsWrap(options: any[]) {
    const cheapest = options[0] ?? null;
    const fastest = [...options].sort((a, b) => {
      const da = (a.transit.minDays ?? 9999); const db = (b.transit.minDays ?? 9999); return da - db;
    })[0] ?? null;
    return { zonesMatched: options.length, options, cheapest, fastest, reason: options.length ? null : "No shipping options available for this address." };
  }

  resolveTaxes(ctx: RequestContext, d: TaxesForAddressDto) { return this.taxes.resolveForAddress(ctx, d); }

  async exportShipping(ctx: RequestContext, zoneId: bigint | undefined, format: "csv" | "xlsx" | "pdf" = "csv") {
    const columns = [
      { key: "id", label: "ID", format: "number" as const },
      { key: "zone", label: "Zone", format: "text" as const, formatValue: (_: any, row: any) => row.zone?.name ?? String(row.zoneId) },
      { key: "provider", label: "Carrier" },
      { key: "code", label: "Code" },
      { key: "name", label: "Method Name" },
      { key: "enabled", label: "Enabled", formatValue: (v: any) => v ? "Yes" : "No" },
      { key: "baseCost", label: "Base ৳", format: "currency_bdt" as const },
      { key: "perItemCost", label: "Per Item ৳", format: "currency_bdt" as const },
      { key: "freeFromSubtotal", label: "Free Above ৳", format: "currency_bdt" as const },
      { key: "sortOrder", label: "Sort" },
      { key: "deliveryEstimateMinDays", label: "Min Days", format: "number" as const },
      { key: "deliveryEstimateMaxDays", label: "Max Days", format: "number" as const },
      { key: "updatedAt", label: "Updated At", format: "datetime" as const },
    ];
    const rows: any[] = await this.methods.exportRows(ctx, zoneId);
    const base = zoneId ? `shipping_zone_${zoneId.toString()}_methods` : "shipping_methods";
    const filename = formatTimestampFilename(base, format);
    let buffer: Buffer;
    if (format === "csv") buffer = generateCsv(rows, columns, { includeBom: true });
    else if (format === "xlsx") buffer = await generateXlsx([{ name: "Shipping Methods", columns, rows, title: "Shipping Methods Export" }]);
    else buffer = await generatePdf({ title: "Shipping Methods", subtitle: zoneId ? `Zone ID #${zoneId.toString()}` : "All Zones", columns, rows, footerText: "Shipping Export — Ecom Platform" });
    const headers = attachmentHeader(filename);
    return { buffer, contentType: headers["Content-Type"], contentDisposition: headers["Content-Disposition"] };
  }
}
