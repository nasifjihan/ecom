import { z } from "zod";

const PlanFeaturesDto = z.record(z.union([z.string(), z.number(), z.boolean()]));

export const CreatePlanDto = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
  priceMonthly: z.coerce.number().min(0),
  priceYearly: z.coerce.number().min(0),
  features: PlanFeaturesDto.default({}),
});
export type CreatePlanDto = z.infer<typeof CreatePlanDto>;

export const UpdatePlanDto = CreatePlanDto.partial();
export type UpdatePlanDto = z.infer<typeof UpdatePlanDto>;

export const IdParamDto = z.object({ id: z.coerce.bigint() });

export const SubscriptionListQueryDto = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(["active", "trialing", "past_due", "cancelled"]).optional(),
  planId: z.coerce.bigint().optional(),
});
export type SubscriptionListQueryDto = z.infer<typeof SubscriptionListQueryDto>;

export const UpdateSubscriptionDto = z.object({
  planId: z.coerce.bigint().optional(),
  status: z.enum(["active", "trialing", "past_due", "cancelled"]).optional(),
  currentPeriodEnd: z.coerce.date().nullable().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});
export type UpdateSubscriptionDto = z.infer<typeof UpdateSubscriptionDto>;

export const ReportsQueryDto = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});
export type ReportsQueryDto = z.infer<typeof ReportsQueryDto>;

export const AuditLogQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  storeId: z.coerce.bigint().optional(),
  search: z.string().max(100).optional(),
});
export type AuditLogQueryDto = z.infer<typeof AuditLogQueryDto>;
