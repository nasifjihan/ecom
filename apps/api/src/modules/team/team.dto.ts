import { z } from "zod";

const name = z.string().trim().min(2).max(80);
const pct = z.coerce.number().min(0).max(100).multipleOf(0.01);
/** Staff passwords: at least 10 characters with a letter and a number. */
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and at least one number");

export const IdParam = z.object({ id: z.coerce.bigint().positive() });

export const CreateRoleDto = z.object({
  name,
  permissions: z.array(z.string().max(60)).max(200).optional(),
  maxManualDiscountPct: pct.optional(),
  /** Start from another role's permissions and discount limit. */
  copyFromRoleId: z.coerce.bigint().positive().optional(),
});
export type CreateRoleDto = z.infer<typeof CreateRoleDto>;

export const UpdateRoleDto = z.object({
  name: name.optional(),
  permissions: z.array(z.string().max(60)).max(200).optional(),
  maxManualDiscountPct: pct.optional(),
});
export type UpdateRoleDto = z.infer<typeof UpdateRoleDto>;

export const CreateStaffDto = z.object({
  name,
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(20).optional(),
  password,
  roleId: z.coerce.bigint().positive(),
  /** Storefronts they work on (empty: all). */
  storefrontIds: z.array(z.coerce.bigint().positive()).max(50).optional(),
});
export type CreateStaffDto = z.infer<typeof CreateStaffDto>;

export const UpdateStaffDto = z.object({
  name: name.optional(),
  phone: z.string().trim().max(20).optional(),
  roleId: z.coerce.bigint().positive().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  /** Storefronts they work on (empty: all). */
  storefrontIds: z.array(z.coerce.bigint().positive()).max(50).optional(),
});
export type UpdateStaffDto = z.infer<typeof UpdateStaffDto>;

export const ResetStaffPasswordDto = z.object({ password });
export type ResetStaffPasswordDto = z.infer<typeof ResetStaffPasswordDto>;

export const AuditQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  adminId: z.coerce.bigint().positive().optional(),
  objectType: z.string().max(40).optional(),
  search: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditQueryDto = z.infer<typeof AuditQueryDto>;
