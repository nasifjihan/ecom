"use client";

/** Staff accounts, roles and the activity log (API: /admin/staff, /admin/roles, /admin/audit-logs). */
import { api } from "@ecom/api-client";
import type { PermissionArea } from "@ecom/shared-types";

export interface Role {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  isOwner: boolean;
  maxManualDiscountPct: number;
  permissions: string[];
  memberCount: number;
}
export interface RoleInput {
  name?: string;
  permissions?: string[];
  maxManualDiscountPct?: number;
  copyFromRoleId?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive" | string;
  role: { id: string; name: string; slug: string };
  /** Storefronts they work on (empty: all). */
  storefrontIds: string[];
  lastLoginAt: string | null;
  createdAt: string;
  isYou: boolean;
}
export interface StaffInput {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  roleId?: string;
  status?: "active" | "inactive";
  storefrontIds?: string[];
}

export interface AuditEntry {
  id: string;
  action: string;
  objectType: string;
  objectId: string;
  admin: { id: string; name: string; email: string } | null;
  changes: { method?: string; path?: string; by?: string; body?: unknown } | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
export interface AuditQuery {
  page?: number;
  perPage?: number;
  adminId?: string;
  objectType?: string;
  search?: string;
  from?: string;
  to?: string;
}

export const teamApi = api.injectEndpoints({
  endpoints: (b) => ({
    getPermissionCatalogue: b.query<PermissionArea[], void>({
      query: () => "/admin/permissions",
      keepUnusedDataFor: 3600,
    }),
    getRoles: b.query<Role[], void>({ query: () => "/admin/roles", providesTags: ["Role"] }),
    createRole: b.mutation<Role, RoleInput>({
      query: (body) => ({ url: "/admin/roles", method: "POST", body }),
      invalidatesTags: ["Role"],
    }),
    updateRole: b.mutation<Role, { id: string } & RoleInput>({
      query: ({ id, ...body }) => ({ url: `/admin/roles/${id}`, method: "PATCH", body }),
      // Editing your own role's permissions changes what you can see.
      invalidatesTags: ["Role", "Me"],
    }),
    deleteRole: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/roles/${id}`, method: "DELETE" }),
      invalidatesTags: ["Role"],
    }),

    getStaff: b.query<StaffMember[], void>({ query: () => "/admin/staff", providesTags: ["User"] }),
    createStaff: b.mutation<StaffMember, StaffInput>({
      query: (body) => ({ url: "/admin/staff", method: "POST", body }),
      invalidatesTags: ["User", "Role"],
    }),
    updateStaff: b.mutation<StaffMember, { id: string } & StaffInput>({
      query: ({ id, ...body }) => ({ url: `/admin/staff/${id}`, method: "PATCH", body }),
      invalidatesTags: ["User", "Role"],
    }),
    setStaffPassword: b.mutation<void, { id: string; password: string }>({
      query: ({ id, password }) => ({ url: `/admin/staff/${id}/password`, method: "POST", body: { password } }),
    }),

    getAuditLogs: b.query<{ items: AuditEntry[]; objectTypes: string[]; total: number; totalPages: number }, AuditQuery>({
      query: (params) => ({ url: "/admin/audit-logs", params }),
      transformResponse: (data: { items: AuditEntry[]; objectTypes: string[] }, meta) => {
        const m = (meta as { response?: unknown; total?: number; totalPages?: number } | undefined) ?? {};
        return { ...data, total: m.total ?? data.items.length, totalPages: m.totalPages ?? 1 };
      },
      providesTags: ["AuditLog"],
    }),
  }),
});

export const {
  useGetPermissionCatalogueQuery,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetStaffQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useSetStaffPasswordMutation,
  useGetAuditLogsQuery,
} = teamApi;
