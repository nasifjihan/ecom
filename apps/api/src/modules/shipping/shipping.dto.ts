import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";

const NO_XSS = /<\s*script|javascript:|\son[a-z]+\s*=/i;
const noXss = (val: string | undefined, path: string[], ctx: z.RefinementCtx) => {
  if (val && NO_XSS.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Field contains disallowed content", path });
  }
};

const CountryCode = z.string().trim().toUpperCase().refine((v) => v === "*" || /^[A-Z]{2}$/.test(v), "2-letter country code or *");

/**
 * A zone covers countries, optionally narrowed to locations (division, district or upazila ids)
 * and postcode ranges. No locations = the whole of each country.
 */
const BaseShippingZoneDto = z.object({
  name: z.string().trim().min(2).max(80).superRefine((v, ctx) => noXss(v, ["name"], ctx)),
  enabled: z.boolean().default(true),
  /** Only for these storefronts (empty: all). */
  storefrontIds: z.array(z.coerce.bigint().positive()).max(50).default([]),
  countries: z.array(CountryCode).min(1, "Pick at least one country").max(50).default(["BD"]),
  locationIds: z.array(z.coerce.bigint().positive()).max(700).default([]),
  postcodes: z.array(z.string().trim().max(32)).max(200).default([]).refine(
    (arr) => arr.every((p) => p === "*" || /^[0-9]{4}$/.test(p) || /^\d{4}-\d{4}$/.test(p)),
    "Postcodes look like 1200 or 1200-1230",
  ),
});
export const CreateShippingZoneDto = BaseShippingZoneDto;
export const UpdateShippingZoneDto = z.object({
  name: BaseShippingZoneDto.shape.name.optional(),
  enabled: z.boolean().optional(),
  storefrontIds: z.array(z.coerce.bigint().positive()).max(50).optional(),
  countries: z.array(CountryCode).min(1).max(50).optional(),
  locationIds: z.array(z.coerce.bigint().positive()).max(700).optional(),
  postcodes: BaseShippingZoneDto.shape.postcodes.optional(),
});
export type CreateShippingZoneDto = z.infer<typeof CreateShippingZoneDto>;
export type UpdateShippingZoneDto = z.infer<typeof UpdateShippingZoneDto>;

export const ShippingZoneSearchQueryDto = PaginationSchema.extend({
  enabled: z.enum(["true", "false"]).optional(),
  search: z.string().max(80).optional(),
});
export type ShippingZoneSearchQueryDto = z.infer<typeof ShippingZoneSearchQueryDto>;

const BaseShippingMethodPlain = z.object({
  zoneId: z.coerce.bigint(),
  code: z.string().min(2).max(40).refine((v) => /^[a-z0-9_-]+$/.test(v), "code: lowercase letters digits underscores hyphens"),
  name: z.string().min(2).max(80).superRefine((v, ctx) => noXss(v, ["name"], ctx)),
  description: z.string().max(500).nullable().optional().superRefine((v, ctx) => noXss(v ?? undefined, ["description"], ctx)),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  baseCost: z.coerce.number().min(0).multipleOf(0.01),
  perItemCost: z.coerce.number().min(0).multipleOf(0.01).default(0),
  perKgExtra: z.coerce.number().min(0).multipleOf(0.01).default(0),
  freeFromSubtotal: z.coerce.number().min(0).multipleOf(0.01).nullable().optional(),
  minimumCost: z.coerce.number().min(0).multipleOf(0.01).default(0),
  /** Price by parcel weight: the first tier the weight fits in; perKgExtra per kg above the last. */
  weightTiers: z.array(z.object({
    upToKg: z.coerce.number().positive().max(1000),
    cost: z.coerce.number().min(0).multipleOf(0.01),
  })).max(20).refine(
    (t) => new Set(t.map((x) => x.upToKg)).size === t.length,
    "Each weight tier needs its own weight",
  ).default([]),
  /** Only offered when the order subtotal is at least this. */
  minSubtotal: z.coerce.number().min(0).multipleOf(0.01).default(0),
  deliveryEstimateMinDays: z.coerce.number().int().min(0).max(60).nullable().optional(),
  deliveryEstimateMaxDays: z.coerce.number().int().min(0).max(90).nullable().optional(),
  /** Customers pick a delivery time slot with this method. */
  useSlots: z.boolean().default(false),
  taxClassId: z.coerce.bigint().nullable().optional(),
});
export const CreateShippingMethodDto = BaseShippingMethodPlain.superRefine((v, ctx) => {
  if (v.deliveryEstimateMinDays != null && v.deliveryEstimateMaxDays != null && v.deliveryEstimateMinDays > v.deliveryEstimateMaxDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "min days <= max days", path: ["deliveryEstimateMinDays"] });
  }
});
// .partial() keeps .default()s, which would reset unsent fields; strip them for PATCH-style updates.
export const UpdateShippingMethodDto = z.object(
  Object.fromEntries(
    Object.entries(BaseShippingMethodPlain.omit({ zoneId: true }).shape).map(([k, v]) => [
      k,
      (v instanceof z.ZodDefault ? v.removeDefault() : v).optional(),
    ]),
  ) as { [K in keyof Omit<typeof BaseShippingMethodPlain.shape, "zoneId">]: z.ZodOptional<z.ZodTypeAny> },
);
export type CreateShippingMethodDto = z.infer<typeof CreateShippingMethodDto>;
export type UpdateShippingMethodDto = z.infer<typeof UpdateShippingMethodDto>;

const BaseImportRows = BaseShippingMethodPlain.omit({ zoneId: true });

export const BulkImportMethodsDto = z.object({
  zoneId: z.coerce.bigint(),
  overwrite: z.boolean().default(false),
  rows: z.array(BaseImportRows).min(1).max(500),
});
export type BulkImportMethodsDto = z.infer<typeof BulkImportMethodsDto>;

export const ShippingRatesQueryDto = z.object({
  zoneId: z.coerce.bigint().optional(),
  countryCode: z.string().length(2).toUpperCase().optional(),
  division: z.string().max(64).optional(),
  district: z.string().max(64).optional(),
  upazila: z.string().max(64).optional(),
  /** Deepest location picked (upazila/thana or district); wins over the names. */
  locationId: z.coerce.bigint().positive().optional(),
  postcode: z.string().max(12).optional(),
  subtotal: z.coerce.number().min(0).default(0),
  weightKG: z.coerce.number().min(0).default(0),
  qty: z.coerce.number().int().min(0).default(0),
}).superRefine((v, ctx) => {
  if (v.zoneId === undefined && !v.countryCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide zoneId OR countryCode", path: ["countryCode"] });
  }
});
export type ShippingRatesQueryDto = z.infer<typeof ShippingRatesQueryDto>;

const BaseTaxRateDtoPlain = z.object({
  taxClassId: z.coerce.bigint(),
  countryCode: z.string().length(2).toUpperCase(),
  state: z.string().max(64).optional(),
  city: z.string().max(64).optional(),
  postcode: z.string().max(12).optional(),
  rate: z.coerce.number().min(0).max(100).multipleOf(0.01),
  name: z.string().min(2).max(60),
  compound: z.boolean().default(false),
  priority: z.coerce.number().int().min(0).max(1000).default(1),
});
export const CreateTaxRateDto = BaseTaxRateDtoPlain;
export const UpdateTaxRateDto = BaseTaxRateDtoPlain.partial();
export type CreateTaxRateDto = z.infer<typeof CreateTaxRateDto>;
export type UpdateTaxRateDto = z.infer<typeof UpdateTaxRateDto>;

export const TaxRateSearchDto = PaginationSchema.extend({
  taxClassId: z.coerce.bigint().optional(),
  countryCode: z.string().length(2).toUpperCase().optional(),
});
export type TaxRateSearchDto = z.infer<typeof TaxRateSearchDto>;

export const TaxesForAddressDto = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  state: z.string().max(64).optional(),
  city: z.string().max(64).optional(),
  postcode: z.string().max(12).optional(),
  subtotal: z.coerce.number().min(0).default(0),
  shippingTotal: z.coerce.number().min(0).default(0),
  taxClassId: z.coerce.bigint().optional(),
});
export type TaxesForAddressDto = z.infer<typeof TaxesForAddressDto>;

export const ExportShippingDto = z.object({
  zoneId: z.coerce.bigint().optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
});
export type ExportShippingDto = z.infer<typeof ExportShippingDto>;
