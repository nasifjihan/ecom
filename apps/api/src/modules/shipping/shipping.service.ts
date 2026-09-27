import type { RequestContext } from "../../core";
import { ShippingZoneRepository, ShippingMethodRepository, TaxRateRepository } from "./shipping.repository";
import type {
  CreateShippingZoneDto, UpdateShippingZoneDto,
  CreateShippingMethodDto, UpdateShippingMethodDto, BulkImportMethodsDto,
  CreateTaxRateDto, UpdateTaxRateDto,
  ShippingRatesQueryDto, TaxesForAddressDto,
} from "./shipping.dto";
import { BadRequestError } from "../../core";
import { locationDepth, offInChain, resolveAddressLocation, storeLocationsOff } from "../locations/locations.service";
import { methodCost, parseRules, pickZone } from "./shipping.rules";
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

  async computeShippingOptions(ctx: RequestContext, q: ShippingRatesQueryDto) {
    const cart = { subtotal: Number(q.subtotal || 0), weightKG: Number(q.weightKG || 0), qty: Number(q.qty || 0) };
    if (q.zoneId) {
      const zone = await this.zones.get(ctx, q.zoneId);
      return this.optionsWrap(this.buildOptions((zone as any).methods || [], cart), null);
    }
    if (!q.countryCode) throw new BadRequestError("Provide zoneId or countryCode", "SHIPPING_PARAM_MISSING");

    // Bangladesh addresses resolve to division -> district -> upazila (by id, else by name).
    const place = q.countryCode === "BD"
      ? await resolveAddressLocation({ locationId: q.locationId, division: q.division, district: q.district, upazila: q.upazila })
      : null;
    if (place?.chain.length && ctx.storeId !== undefined) {
      const off = offInChain(place.chain, await storeLocationsOff(BigInt(ctx.storeId as any)));
      if (off) {
        return { ...this.optionsWrap([], null), reason: `Sorry, we don't deliver to ${off.nameEn} yet.` };
      }
    }
    const zones = await this.zones.matchZonesForAddress(ctx, {
      countryCode: q.countryCode,
      chain: (place?.chain ?? []).map((l) => ({ id: l.id, nameEn: l.nameEn, depth: locationDepth(l) })),
      division: q.division,
      district: q.district,
      postcode: q.postcode,
    });
    if (zones.length === 0 && q.countryCode !== "BD") {
      return { zonesMatched: 0, zone: null, options: [], cheapest: null, fastest: null, reason: `No shipping zones configured for ${q.countryCode} — International delivery not available.` };
    }
    // Most specific zone wins; ties go to the zone with the cheaper option.
    const scored = zones.map((z) => {
      const options = this.buildOptions(z.methods, cart);
      return { zone: z, options, specificity: z.specificity, cheapest: options[0]?.finalRateBDT ?? Infinity };
    });
    const best = pickZone(scored);
    return this.optionsWrap(best?.options ?? [], best ? { id: String(best.zone.id), name: best.zone.name } : null);
  }

  private buildOptions(methods: any[], cart: { subtotal: number; weightKG: number; qty: number }) {
    const out = [];
    for (const m of methods) {
      const price = methodCost(m, cart);
      if (!price.available) continue;
      const rules = parseRules(m.costRules);
      out.push({
        id: m.id, zoneId: m.zoneId,
        code: m.code, name: m.name,
        description: m.description ?? null,
        baseRate: Number(m.baseCost || 0), weightChargableKG: price.weightKg, perKgExtra: Number(rules.perKgExtra ?? 0),
        finalRateBDT: price.cost,
        savingsBDT: price.free ? price.beforeFree : 0,
        freeReason: price.free ? `Free delivery on orders from ${Number(m.freeFromSubtotal).toFixed(2)}` : null,
        transit: { minDays: m.deliveryEstimateMinDays ?? null, maxDays: m.deliveryEstimateMaxDays ?? null },
      });
    }
    return out.sort((a, b) => a.finalRateBDT - b.finalRateBDT);
  }

  private optionsWrap(options: any[], zone: { id: string; name: string } | null) {
    const cheapest = options[0] ?? null;
    const fastest = [...options].sort((a, b) => {
      const da = (a.transit.minDays ?? 9999); const db = (b.transit.minDays ?? 9999); return da - db;
    })[0] ?? null;
    return { zonesMatched: options.length, zone, options, cheapest, fastest, reason: options.length ? null : "No shipping options available for this address." };
  }

  resolveTaxes(ctx: RequestContext, d: TaxesForAddressDto) { return this.taxes.resolveForAddress(ctx, d); }

  async exportShipping(ctx: RequestContext, zoneId: bigint | undefined, format: "csv" | "xlsx" | "pdf" = "csv") {
    const columns = [
      { key: "id", label: "ID", format: "number" as const },
      { key: "zone", label: "Zone", format: "text" as const, formatValue: (_: any, row: any) => row.zone?.name ?? String(row.zoneId) },
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
