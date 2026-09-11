import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";
import { ShippingProvider } from "@ecom/shared-types";

const COUNTRY_CODES = ["BD", "US", "GB", "CA", "AU", "IN", "PK", "SAE", "AE", "MY", "SG"];

const NO_XSS = /<\s*script|javascript:|\son[a-z]+\s*=/i;
const noXss = (val: string | undefined, path: string[], ctx: z.RefinementCtx) => {
  if (val && NO_XSS.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Field contains disallowed content", path });
  }
};

export const ShippingZoneRegionDto = z.object({
  countryCode: z.string().length(2).toUpperCase().refine((v) => COUNTRY_CODES.includes(v) || /^[A-Z]{2}$/.test(v), "Country code 2 letters"),
  divisions: z.array(z.string().max(64)).default([]).superRefine((arr, ctx) => {
    for (let i = 0; i < arr.length; i++) noXss(arr[i], ["divisions", String(i)], ctx);
  }),
  districts: z.array(z.string().max(64)).default([]).superRefine((arr, ctx) => {
    for (let i = 0; i < arr.length; i++) noXss(arr[i], ["districts", String(i)], ctx);
  }),
  postcodeRanges: z.array(z.string().max(32)).default([]).refine(
    (arr) => arr.every((p) => p === "*" || /^[0-9]{4}$/.test(p) || /^\d{4}-\d{4}$/.test(p)),
    "postcode format 1200 or 1200-1230 or *",
  ),
});
export type ShippingZoneRegionDto = z.infer<typeof ShippingZoneRegionDto>;

const BaseShippingZoneDto = z.object({
  name: z.string().min(2).max(80).superRefine((v, ctx) => noXss(v, ["name"], ctx)),
  regions: z.array(ShippingZoneRegionDto).min(1, "At least one region required"),
  zoneType: z.enum(["metro", "suburban", "rural", "international"]).default("suburban"),
  enabled: z.boolean().default(true),
});
export const CreateShippingZoneDto = BaseShippingZoneDto;
export const UpdateShippingZoneDto = BaseShippingZoneDto.partial();
export type CreateShippingZoneDto = z.infer<typeof CreateShippingZoneDto>;
export type UpdateShippingZoneDto = z.infer<typeof UpdateShippingZoneDto>;

export const ShippingZoneSearchQueryDto = PaginationSchema.extend({
  enabled: z.enum(["true", "false"]).optional(),
  search: z.string().max(80).optional(),
});
export type ShippingZoneSearchQueryDto = z.infer<typeof ShippingZoneSearchQueryDto>;

const METHOD_CODES: readonly [string, ...string[]] = ["standard", "express", "same_day", "next_day", "economy", "pickup"];

const BaseShippingMethodPlain = z.object({
  zoneId: z.coerce.bigint(),
  code: z.string().min(2).max(40).refine((v) => /^[a-z0-9_-]+$/.test(v), "code: lowercase letters digits underscores hyphens"),
  name: z.string().min(2).max(80).superRefine((v, ctx) => noXss(v, ["name"], ctx)),
  description: z.string().max(500).optional().superRefine((v, ctx) => noXss(v, ["description"], ctx)),
  provider: z.nativeEnum(ShippingProvider).default(ShippingProvider.FLAT_RATE),
  methodType: z.enum(METHOD_CODES).default("standard"),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  baseCost: z.coerce.number().min(0).multipleOf(0.01),
  perItemCost: z.coerce.number().min(0).multipleOf(0.01).default(0),
  perKgExtra: z.coerce.number().min(0).multipleOf(0.01).default(0),
  freeFromSubtotal: z.coerce.number().min(0).multipleOf(0.01).optional(),
  minimumCost: z.coerce.number().min(0).multipleOf(0.01).default(0),
  deliveryEstimateMinDays: z.coerce.number().int().min(0).max(60).optional(),
  deliveryEstimateMaxDays: z.coerce.number().int().min(0).max(90).optional(),
  taxClassId: z.coerce.bigint().optional(),
});
export const CreateShippingMethodDto = BaseShippingMethodPlain.superRefine((v, ctx) => {
  if (v.deliveryEstimateMinDays !== undefined && v.deliveryEstimateMaxDays !== undefined && v.deliveryEstimateMinDays > v.deliveryEstimateMaxDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "min days <= max days", path: ["deliveryEstimateMinDays"] });
  }
});
export const UpdateShippingMethodDto = BaseShippingMethodPlain.omit({ zoneId: true }).partial();
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
