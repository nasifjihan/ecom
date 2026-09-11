import { z } from "zod";

export const CreateAdminUserDto = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "one uppercase")
    .regex(/[0-9]/, "digit"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  roleId: z.coerce.bigint(),
  status: z.enum(["active", "inactive", "invited"]).default("invited"),
  twoFactorEnabled: z.boolean().default(false),
});

export const UpdateAdminUserDto = CreateAdminUserDto.omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(8).optional(),
    resetPassword: z.boolean().optional(),
  });

export const AdminUserAssignRoleDto = z.object({
  roleId: z.coerce.bigint(),
});

export const AdminUserStatusDto = z.object({
  status: z.enum(["active", "inactive"]),
});

export const CreateRoleDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9_]+$/),
  description: z.string().max(500).optional(),
  isSystem: z.boolean().default(false),
  permissions: z.array(z.string()).min(0).default([]),
});

export const UpdateRoleDto = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const BulkAssignPermissionsDto = z.object({
  roleId: z.coerce.bigint(),
  permissions: z.array(z.string()).default([]),
});

export const PaginationDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(100).optional(),
  roleId: z.coerce.bigint().optional(),
  status: z.enum(["active", "inactive", "invited", "suspended"]).optional(),
});

export type CreateAdminUserDtoType = z.infer<typeof CreateAdminUserDto>;
export type UpdateAdminUserDtoType = z.infer<typeof UpdateAdminUserDto>;
export type AdminUserAssignRoleDtoType = z.infer<typeof AdminUserAssignRoleDto>;
export type AdminUserStatusDtoType = z.infer<typeof AdminUserStatusDto>;
export type CreateRoleDtoType = z.infer<typeof CreateRoleDto>;
export type UpdateRoleDtoType = z.infer<typeof UpdateRoleDto>;
export type BulkAssignPermissionsDtoType = z.infer<typeof BulkAssignPermissionsDto>;
export type PaginationDtoType = z.infer<typeof PaginationDto>;
