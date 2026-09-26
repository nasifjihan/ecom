import { z } from "zod";

export const StoreOwnerDto = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(20).optional(),
});
export type StoreOwnerDto = z.infer<typeof StoreOwnerDto>;

const StoreFieldsDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  planId: z.coerce.bigint().optional(),
  status: z.enum(["active", "trial", "suspended", "cancelled"]).default("trial"),
  trialDays: z.coerce.number().int().min(0).max(365).optional(),
});

/** A new store can be created with its owner login in one step. */
export const CreateStoreDto = StoreFieldsDto.extend({ owner: StoreOwnerDto.optional() });
export type CreateStoreDto = z.infer<typeof CreateStoreDto>;

export const UpdateStoreDto = StoreFieldsDto.deepPartial();
export type UpdateStoreDto = z.infer<typeof UpdateStoreDto>;

export const CreateDomainDto = z.object({
  storeId: z.coerce.bigint(),
  hostname: z.string().min(3).toLowerCase(),
  type: z.enum(["storefront", "admin"]),
  primary: z.boolean().default(false),
  sslEnabled: z.boolean().default(true),
});
export type CreateDomainDto = z.infer<typeof CreateDomainDto>;

export const UpdateDomainDto = z.object({
  hostname: z.string().optional(),
  type: z.enum(["storefront", "admin"]).optional(),
  primary: z.boolean().optional(),
  sslEnabled: z.boolean().optional(),
});
export type UpdateDomainDto = z.infer<typeof UpdateDomainDto>;

export const PlanIdDto = z.object({
  planId: z.coerce.bigint().optional(),
});
export type PlanIdDto = z.infer<typeof PlanIdDto>;

export const PaginationDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(100).optional(),
});
export type PaginationDto = z.infer<typeof PaginationDto>;

export const StoreListQueryDto = PaginationDto.extend({
  status: z.enum(["active", "trial", "suspended", "cancelled"]).optional(),
  planId: z.coerce.bigint().optional(),
});
export type StoreListQueryDto = z.infer<typeof StoreListQueryDto>;

export const StoreIdParamDto = z.object({
  id: z.coerce.bigint(),
});
export type StoreIdParamDto = z.infer<typeof StoreIdParamDto>;

export const DomainIdParamDto = z.object({
  id: z.coerce.bigint(),
});
export type DomainIdParamDto = z.infer<typeof DomainIdParamDto>;

export const StoreDomainQueryDto = z.object({
  storeId: z.coerce.bigint().optional(),
});
export type StoreDomainQueryDto = z.infer<typeof StoreDomainQueryDto>;
