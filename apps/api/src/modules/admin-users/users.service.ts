import bcrypt from "bcryptjs";
import { BaseService, type RequestContext, NotFoundError, ConflictError, ForbiddenError } from "../../core";
import { prisma } from "../../config";
import { AdminUserRepository, RoleRepository } from "./users.repository";
import { RbacService } from "./rbac.service";
import {
  CreateAdminUserDtoType,
  UpdateAdminUserDtoType,
  AdminUserAssignRoleDtoType,
  AdminUserStatusDtoType,
  CreateRoleDtoType,
  UpdateRoleDtoType,
  PaginationDtoType,
} from "./users.dto";
import { isSystemRole } from "./permission-codes";

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(" ");
  const first = parts.shift() ?? "";
  const last = parts.join(" ");
  return { firstName: first, lastName: last };
}

function mapAdminToDto(row: any): any {
  if (!row) return row;
  const { firstName, lastName } = splitName(row.name || "");
  const result = { ...row, firstName, lastName };
  delete result.name;
  result.passwordHash = null;
  if (result.role) {
    result.role = { ...result.role };
    if (result.role.permissions) {
      result.role.permissions = result.role.permissions.map((p: any) => p.permission);
    }
  }
  return result;
}

function mapRoleToDto(row: any): any {
  if (!row) return row;
  const result = { ...row };
  if (result.permissions) {
    result.permissions = result.permissions.map((p: any) => p.permission);
  }
  return result;
}

export class UsersService extends BaseService {
  private adminRepo: AdminUserRepository;
  private roleRepo: RoleRepository;
  private rbac: RbacService;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.adminRepo = new AdminUserRepository();
    this.roleRepo = new RoleRepository();
    this.rbac = new RbacService(ctx);
  }

  async createAdmin(dto: CreateAdminUserDtoType) {
    const existing = await this.adminRepo.findByEmail(this.ctx, dto.email);
    if (existing) {
      throw new ConflictError("Email already in use", "DUPLICATE_EMAIL");
    }

    const role = await this.roleRepo.findById(this.ctx, dto.roleId);
    if (!role) {
      throw new NotFoundError("Role", String(dto.roleId));
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const name = `${dto.firstName} ${dto.lastName}`.trim();

    const created = await this.adminRepo.create(this.ctx, {
      email: dto.email,
      passwordHash,
      name,
      phone: dto.phone ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      roleId: dto.roleId,
      status: dto.status,
    });

    return mapAdminToDto(created);
  }

  async updateAdmin(id: bigint, dto: UpdateAdminUserDtoType) {
    const existing = await this.adminRepo.findById(this.ctx, id);
    if (!existing) {
      throw new NotFoundError("AdminUser", String(id));
    }

    const data: Record<string, unknown> = {};

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const current = splitName(existing.name || "");
      const firstName = dto.firstName ?? current.firstName;
      const lastName = dto.lastName ?? current.lastName;
      data.name = `${firstName} ${lastName}`.trim();
    }
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.roleId !== undefined) {
      const role = await this.roleRepo.findById(this.ctx, dto.roleId);
      if (!role) throw new NotFoundError("Role", String(dto.roleId));
      data.roleId = dto.roleId;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.twoFactorEnabled !== undefined) {
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.adminRepo.update(this.ctx, id, data);
    if (dto.roleId !== undefined && existing.roleId !== dto.roleId) {
      await this.rbac.invalidateRolePermissions(existing.roleId);
      await this.rbac.invalidateRolePermissions(dto.roleId);
    }
    return mapAdminToDto(updated);
  }

  async assignRole(id: bigint, dto: AdminUserAssignRoleDtoType) {
    const admin = await this.adminRepo.findById(this.ctx, id);
    if (!admin) {
      throw new NotFoundError("AdminUser", String(id));
    }
    const role = await this.roleRepo.findById(this.ctx, dto.roleId);
    if (!role) {
      throw new NotFoundError("Role", String(dto.roleId));
    }
    const oldRoleId = admin.roleId;
    const updated = await this.adminRepo.update(this.ctx, id, { roleId: dto.roleId });
    await this.rbac.invalidateRolePermissions(oldRoleId);
    await this.rbac.invalidateRolePermissions(dto.roleId);
    return mapAdminToDto(updated);
  }

  async changeStatus(id: bigint, dto: AdminUserStatusDtoType) {
    const updated = await this.adminRepo.updateStatus(this.ctx, id, dto.status);
    return mapAdminToDto(updated);
  }

  async listAdminUsers(paginated: PaginationDtoType) {
    const result = await this.adminRepo.listPaginated(this.ctx, paginated);
    return {
      data: result.data.map(mapAdminToDto),
      meta: result.meta,
    };
  }

  async getAdmin(id: bigint) {
    const row = await (this.adminRepo.q as any).findFirst({
      where: this.ctx.storeId !== undefined
        ? { id: BigInt(id), storeId: this.ctx.storeId }
        : { id: BigInt(id) },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundError("AdminUser", String(id));
    return mapAdminToDto(row);
  }

  async deleteAdmin(id: bigint) {
    const admin = await this.adminRepo.findById(this.ctx, id);
    if (!admin) throw new NotFoundError("AdminUser", String(id));
    const updated = await this.adminRepo.updateStatus(this.ctx, id, "inactive");
    return mapAdminToDto(updated);
  }

  async resetAdminPassword(id: bigint, newPassword: string) {
    const admin = await this.adminRepo.findById(this.ctx, id);
    if (!admin) throw new NotFoundError("AdminUser", String(id));
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await this.adminRepo.update(this.ctx, id, { passwordHash });
    return mapAdminToDto(updated);
  }

  async resolveEffectivePermissions(adminId: bigint, _storeId: bigint | undefined) {
    const where: Record<string, unknown> = { id: adminId };
    if (this.ctx.storeId !== undefined) where.storeId = this.ctx.storeId;

    const admin = await (this.adminRepo.q as any).findFirst({
      where,
      include: { role: true },
    });
    if (!admin || !admin.role) return [] as string[];
    return this.rbac.getRolePermissions(admin.roleId);
  }

  async createRole(dto: CreateRoleDtoType) {
    const existing = await this.roleRepo.findBySlug(this.ctx, dto.slug);
    if (existing) {
      throw new ConflictError("Role slug already in use", "DUPLICATE_SLUG");
    }

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          storeId: this.ctx.storeId!,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          isSystem: dto.isSystem,
        },
      });
      if (dto.permissions.length > 0) {
        await tx.permissionAssignment.createMany({
          data: dto.permissions.map((p) => ({ roleId: role.id, permission: p })),
          skipDuplicates: true,
        });
      }
      return role;
    });

    const withPerms = await (this.roleRepo.q as any).findFirst({
      where: { id: created.id },
      include: { permissions: true, _count: { select: { admins: true, permissions: true } } },
    });
    return mapRoleToDto(withPerms);
  }

  async listRoles(paginated: PaginationDtoType) {
    const result = await this.roleRepo.listPaginated(this.ctx, paginated);
    return {
      data: result.data.map(mapRoleToDto),
      meta: result.meta,
    };
  }

  async getRole(id: bigint) {
    const row = await (this.roleRepo.q as any).findFirst({
      where: this.ctx.storeId !== undefined
        ? { id: BigInt(id), storeId: this.ctx.storeId }
        : { id: BigInt(id) },
      include: {
        permissions: true,
        _count: { select: { admins: true, permissions: true } },
      },
    });
    if (!row) throw new NotFoundError("Role", String(id));
    return mapRoleToDto(row);
  }

  async updateRole(id: bigint, dto: UpdateRoleDtoType) {
    const existing = await this.roleRepo.findById(this.ctx, id);
    if (!existing) throw new NotFoundError("Role", String(id));
    if (existing.isSystem && dto.name !== undefined && dto.name !== existing.name) {
      throw new ForbiddenError("Cannot rename system role", "INSUFFICIENT_PERMISSION");
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;

    let updated;
    if (dto.permissions !== undefined) {
      updated = await prisma.$transaction(async (tx) => {
        const role = await tx.role.update({
          where: { id: BigInt(id) },
          data,
        });
        await tx.permissionAssignment.deleteMany({ where: { roleId: id } });
        if (dto.permissions!.length > 0) {
          await tx.permissionAssignment.createMany({
            data: dto.permissions!.map((p) => ({ roleId: id, permission: p })),
            skipDuplicates: true,
          });
        }
        return role;
      });
      await this.rbac.invalidateRolePermissions(id);
    } else {
      updated = await this.roleRepo.update(this.ctx, id, data);
    }

    return this.getRole(id);
  }

  async deleteRole(id: bigint) {
    const existing = await this.roleRepo.findById(this.ctx, id);
    if (!existing) throw new NotFoundError("Role", String(id));
    if (existing.isSystem || isSystemRole(existing.slug)) {
      throw new ConflictError("Cannot delete system role", "CONFLICT");
    }
    const adminCount = await (this.adminRepo.q as any).count({
      where: this.ctx.storeId !== undefined
        ? { roleId: id, storeId: this.ctx.storeId }
        : { roleId: id },
    });
    if (adminCount > 0) {
      throw new ConflictError(`Role has ${adminCount} admin users assigned`, "CONFLICT");
    }
    await this.rbac.invalidateRolePermissions(id);
    await this.roleRepo.delete(this.ctx, id);
    return { success: true, id };
  }

  async bulkAssignRolePermissions(roleId: bigint, permissions: string[]) {
    const role = await this.roleRepo.findById(this.ctx, roleId);
    if (!role) throw new NotFoundError("Role", String(roleId));
    return this.rbac.bulkAssignRolePermissions(roleId, permissions);
  }
}
