import { BaseService, type RequestContext } from "../../core";
import { prisma, cacheGet, cacheSet, cacheDel, CACHE_KEYS } from "../../config";

export class RbacService extends BaseService {
  constructor(ctx: RequestContext) {
    super(ctx);
  }

  static hasPerm(perms: string[], required: string): boolean {
    if (!perms.length) return false;
    if (perms.includes("*")) return true;
    if (perms.includes(required)) return true;
    const prefix = required.split(".").slice(0, -1).join(".") + ".*";
    if (perms.includes(prefix)) return true;
    for (const p of perms) {
      if (p.endsWith(".*")) {
        const base = p.slice(0, -2);
        if (required.startsWith(base)) return true;
      }
    }
    return false;
  }

  hasPerm(perms: string[], required: string): boolean {
    return RbacService.hasPerm(perms, required);
  }

  async getRolePermissions(roleId: bigint): Promise<string[]> {
    const cacheKey = CACHE_KEYS.settings(`role:perms:${roleId}`);
    const cached = await cacheGet<string[]>(cacheKey);
    if (cached) return cached;

    const assignments = await prisma.permissionAssignment.findMany({
      where: { roleId },
      select: { permission: true },
    });
    const perms = assignments.map((a) => a.permission);
    await cacheSet(cacheKey, perms, CACHE_KEYS.TTL_DEFAULT);
    return perms;
  }

  async bulkAssignRolePermissions(
    roleId: bigint,
    permissions: string[],
  ): Promise<{ success: true; assignedCount: number }> {
    await prisma.$transaction(async (tx) => {
      await tx.permissionAssignment.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.permissionAssignment.createMany({
          data: permissions.map((p) => ({ roleId, permission: p })),
          skipDuplicates: true,
        });
      }
    });

    const cacheKey = CACHE_KEYS.settings(`role:perms:${roleId}`);
    await cacheDel(cacheKey);

    return { success: true, assignedCount: permissions.length };
  }

  async adminHasAllPermissions(
    adminUserId: bigint,
    storeId: bigint | undefined,
    required: string[],
  ): Promise<{ ok: boolean; missing: string[] }> {
    const where: Record<string, unknown> = { id: adminUserId };
    if (storeId !== undefined) where.storeId = storeId;

    const admin = await prisma.adminUser.findFirst({
      where,
      include: { role: true },
    });
    if (!admin || !admin.role) {
      return { ok: false, missing: [...required] };
    }

    const perms = await this.getRolePermissions(admin.roleId);
    const missing: string[] = [];
    for (const r of required) {
      if (!this.hasPerm(perms, r)) missing.push(r);
    }
    return { ok: missing.length === 0, missing };
  }

  async invalidateRolePermissions(roleId: bigint): Promise<void> {
    const cacheKey = CACHE_KEYS.settings(`role:perms:${roleId}`);
    await cacheDel(cacheKey);
  }
}
