/**
 * What a store admin may do, cached per admin for 5 minutes. Anything that changes it (a role's
 * permissions, an admin's role or status) must call one of the invalidate helpers so the change
 * applies on the next request.
 */
import { prisma } from "./prisma";
import { cacheDel, cacheGet, cacheSet } from "./redis";

const key = (storeId: bigint | string, adminId: bigint | string) => `admin:perms:${storeId}:${adminId}`;

/** Permission codes of an active admin; [] for a missing or deactivated one. */
export async function adminPermissions(storeId: bigint, adminId: bigint): Promise<string[]> {
  const k = key(storeId, adminId);
  const cached = await cacheGet<string[]>(k).catch(() => null);
  if (cached) return cached;
  const admin = await prisma.adminUser.findFirst({
    where: { id: adminId, storeId },
    select: { status: true, role: { select: { permissions: { select: { permission: true } } } } },
  });
  const perms = admin && admin.status === "active" ? admin.role?.permissions.map((p) => p.permission) ?? [] : [];
  await cacheSet(k, perms, 300).catch(() => void 0);
  return perms;
}

export async function invalidateAdminPermissions(storeId: bigint, adminIds: bigint[]) {
  if (adminIds.length) await cacheDel(...adminIds.map((id) => key(storeId, id))).catch(() => void 0);
}

/** After a role's permissions change: everyone holding it. */
export async function invalidateRolePermissions(storeId: bigint, roleId: bigint) {
  const admins = await prisma.adminUser.findMany({ where: { storeId, roleId }, select: { id: true } });
  await invalidateAdminPermissions(storeId, admins.map((a) => a.id));
}
