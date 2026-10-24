import type { RequestContext } from "../../core";
import { ShippingZoneRepository, ShippingMethodRepository, TaxRateRepository } from "./shipping.repository";
import type {
  CreateShippingZoneDto, UpdateShippingZoneDto,
  CreateShippingMethodDto, UpdateShippingMethodDto, BulkImportMethodsDto,
  CreateTaxRateDto, UpdateTaxRateDto,
  ShippingRatesQueryDto, TaxesForAddressDto, TaxPreviewDto,
} from "./shipping.dto";
import { BadRequestError } from "../../core";
import { locationDepth, offInChain, resolveAddressLocation, storeLocationsOff } from "../locations/locations.service";
import { optionsSummary, pickZone, shippingOptions } from "./shipping.rules";
import { storefrontZones } from "../storefronts/storefronts.rules";
import { prisma } from "../../config";
import { sharedRate, splitTaxOnTop, taxClassGroups, taxInside } from "./tax.rules";
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
  taxClasses(ctx: RequestContext) { return this.taxes.classes(ctx); }
  createTaxClass(ctx: RequestContext, name: string) { return this.taxes.createClass(ctx, name); }
  updateTaxClass(ctx: RequestContext, id: bigint, d: { name?: string; isDefault?: boolean }) { return this.taxes.updateClass(ctx, id, d); }
  createTax(ctx: RequestContext, d: CreateTaxRateDto) { return this.taxes.create(ctx, d); }
  updateTax(ctx: RequestContext, id: bigint, d: UpdateTaxRateDto) { return this.taxes.update(ctx, id, d); }
  deleteTax(ctx: RequestContext, id: bigint) { return this.taxes.delete(ctx, id); }

  async computeShippingOptions(ctx: RequestContext, q: ShippingRatesQueryDto) {
    const cart = { subtotal: Number(q.subtotal || 0), weightKG: Number(q.weightKG || 0), qty: Number(q.qty || 0) };
    if (q.zoneId) {
      const zone = await this.zones.get(ctx, q.zoneId);
      return optionsSummary(shippingOptions((zone as any).methods || [], cart), null);
    }
    if (!q.countryCode) throw new BadRequestError("Provide zoneId or countryCode", "SHIPPING_PARAM_MISSING");

    // Bangladesh addresses resolve to division -> district -> upazila (by id, else by name).
    const place = q.countryCode === "BD"
      ? await resolveAddressLocation({ locationId: q.locationId, division: q.division, district: q.district, upazila: q.upazila })
      : null;
    if (place?.chain.length && ctx.storeId !== undefined) {
      const off = offInChain(place.chain, await storeLocationsOff(BigInt(ctx.storeId as any)));
      if (off) {
        return { ...optionsSummary([], null), reason: `Sorry, we don't deliver to ${off.nameEn} yet.` };
      }
    }
    // A storefront with its own zones for this address uses them instead of the shared ones.
    const zones = storefrontZones(await this.zones.matchZonesForAddress(ctx, {
      countryCode: q.countryCode,
      chain: (place?.chain ?? []).map((l) => ({ id: l.id, nameEn: l.nameEn, depth: locationDepth(l) })),
      division: q.division,
      district: q.district,
      postcode: q.postcode,
    }), ctx.storefrontId);
    if (zones.length === 0 && q.countryCode !== "BD") {
      return { zonesMatched: 0, zone: null, options: [], cheapest: null, fastest: null, reason: `No shipping zones configured for ${q.countryCode} — International delivery not available.` };
    }
    // Most specific zone wins; ties go to the zone with the cheaper option.
    const scored = zones.map((z) => {
      const options = shippingOptions(z.methods, cart);
      return { zone: z, options, specificity: z.specificity, cheapest: options[0]?.finalRateBDT ?? Infinity };
    });
    const best = pickZone(scored);
    return optionsSummary(best?.options ?? [], best ? { id: String(best.zone.id), name: best.zone.name } : null);
  }

  resolveTaxes(ctx: RequestContext, d: TaxesForAddressDto) { return this.taxes.resolveForAddress(ctx, d); }

  /**
   * Tax on an order's goods (after discounts) and delivery. When the store's prices include VAT
   * (`included`), the amounts are the VAT already inside them and aren't added to the total.
   * Goods and delivery are worked out separately so each has its own share.
   *
   * With `lines` (checkout), each product is taxed with its own tax class, else the store's
   * default class; delivery with its delivery option's class, else the default. With no default
   * class, unclassed goods and delivery use every rate that matches the address (as before).
   */
  async orderTax(
    ctx: RequestContext,
    d: TaxesForAddressDto & { lines?: { amount: number; taxClassId: bigint | null }[]; deliveryTaxClassId?: bigint | null },
  ) {
    const fallback = ctx.storeId === undefined ? null : await prisma.taxClass.findFirst({
      where: { storeId: BigInt(ctx.storeId), isDefault: true },
      select: { id: true },
    });
    const defaultId = fallback ? String(fallback.id) : null;
    const { lines, deliveryTaxClassId, ...address } = d;
    const toId = (k: string | null) => (k === null ? undefined : BigInt(k));
    const goods = Number(address.subtotal || 0);
    const delivery = Number(address.shippingTotal || 0);
    const groups = lines?.length
      ? taxClassGroups(lines.map((l) => ({ amount: l.amount, taxClassId: l.taxClassId === null ? null : String(l.taxClassId) })), goods, defaultId)
      : [{ taxClassId: address.taxClassId !== undefined ? String(address.taxClassId) : defaultId, amount: goods }];
    const deliveryClass = deliveryTaxClassId != null ? String(deliveryTaxClassId) : address.taxClassId !== undefined ? String(address.taxClassId) : defaultId;
    // One class for everything: one calculation, exactly as before classes (compound rates included).
    if (groups.length <= 1 && (delivery === 0 || (groups[0]?.taxClassId ?? deliveryClass) === deliveryClass)) {
      return this.partTax(ctx, { ...address, taxClassId: toId(groups[0]?.taxClassId ?? deliveryClass) });
    }
    const parts = await Promise.all([
      ...groups.map((g) => this.partTax(ctx, { ...address, subtotal: g.amount, shippingTotal: 0, taxClassId: toId(g.taxClassId) })),
      ...(delivery > 0 ? [this.partTax(ctx, { ...address, subtotal: 0, shippingTotal: delivery, taxClassId: toId(deliveryClass) })] : []),
    ]);
    const sum = (pick: (p: (typeof parts)[number]) => number) => Math.round(parts.reduce((s, p) => s + pick(p), 0) * 100) / 100;
    const taxed = parts.find((p) => p.totalTax > 0);
    return {
      effectiveTaxRatePct: sharedRate(parts.map((p) => ({ ratePct: p.effectiveTaxRatePct, tax: p.totalTax }))),
      primaryName: taxed?.primaryName ?? "No tax",
      totalTax: sum((p) => p.totalTax),
      breakdown: parts.flatMap((p) => p.breakdown).filter((b) => b.amount > 0),
      included: parts[0]!.included,
      itemTax: sum((p) => p.itemTax),
      shippingTax: sum((p) => p.shippingTax),
    };
  }

  /** What checkout shows before the order: the same calculation, from the cart lines and delivery option. */
  async taxPreview(ctx: RequestContext, q: TaxPreviewDto) {
    const { lines: raw, shippingMethodId, ...address } = q;
    const pairs = raw ? raw.split(",").map((p) => p.split(":")).map(([id, amount]) => ({ id: BigInt(id!), amount: Number(amount) })) : [];
    const where = ctx.storeId !== undefined ? { storeId: BigInt(ctx.storeId) } : {};
    const products = pairs.length
      ? await prisma.product.findMany({ where: { ...where, id: { in: pairs.map((p) => p.id) } }, select: { id: true, taxClassId: true } })
      : [];
    const classOf = new Map(products.map((p) => [String(p.id), p.taxClassId]));
    const method = shippingMethodId
      ? await prisma.shippingMethod.findFirst({ where: { id: shippingMethodId, zone: where }, select: { taxClassId: true } })
      : null;
    return this.orderTax(ctx, {
      ...address,
      ...(pairs.length ? { lines: pairs.map((p) => ({ amount: p.amount, taxClassId: classOf.get(String(p.id)) ?? null })) } : {}),
      deliveryTaxClassId: method?.taxClassId ?? null,
    });
  }

  /** Tax on goods and delivery with one class's rates (or every rate, with no class). */
  private async partTax(ctx: RequestContext, d: TaxesForAddressDto) {
    const setting = ctx.storeId === undefined ? null : await prisma.storeGeneralSetting.findUnique({
      where: { storeId: BigInt(ctx.storeId) },
      select: { pricesIncludeTax: true },
    });
    const included = !!setting?.pricesIncludeTax;
    const goods = Number(d.subtotal || 0);
    const delivery = Number(d.shippingTotal || 0);
    if (!included) {
      const r = await this.taxes.resolveForAddress(ctx, d);
      const split = splitTaxOnTop(r.totalTax, goods, delivery);
      return { ...r, included, itemTax: split.items, shippingTax: split.shipping };
    }
    const onGoods = await this.taxes.resolveForAddress(ctx, { ...d, subtotal: goods, shippingTotal: 0 });
    const onDelivery = delivery > 0 ? await this.taxes.resolveForAddress(ctx, { ...d, subtotal: 0, shippingTotal: delivery }) : null;
    const itemTax = taxInside(goods, onGoods.totalTax);
    const shippingTax = onDelivery ? taxInside(delivery, onDelivery.totalTax) : 0;
    // Each line of the breakdown shrinks by the same factor as its part's total.
    const scaled = (r: typeof onGoods | null, inside: number) =>
      r && r.totalTax > 0 ? r.breakdown.map((b) => ({ ...b, amount: Math.round(b.amount * (inside / r.totalTax) * 100) / 100 })) : [];
    const breakdown = [...scaled(onGoods, itemTax), ...scaled(onDelivery, shippingTax)].filter((b) => b.amount > 0);
    return {
      effectiveTaxRatePct: onGoods.effectiveTaxRatePct > 0 ? onGoods.effectiveTaxRatePct : (onDelivery?.effectiveTaxRatePct ?? 0),
      primaryName: onGoods.primaryName,
      totalTax: Math.round((itemTax + shippingTax) * 100) / 100,
      breakdown,
      included,
      itemTax,
      shippingTax,
    };
  }

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
