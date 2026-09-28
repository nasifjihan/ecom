/**
 * TEAM — a store's staff accounts and roles (Settings → Staff / Roles in the store admin).
 *
 * Rules:
 * - The owner role always has every permission ("*"); its permissions can't be edited.
 * - Someone who isn't an owner can only grant permissions they hold themselves, can't hand out
 *   the owner role and can't change an owner's account (no way to promote yourself).
 * - Nobody changes their own role or deactivates themselves, and a store always keeps at least
 *   one active owner.
 * - Staff are deactivated, not deleted: orders, notes and the activity log point at them.
 */
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, PERMISSION_AREAS, hasPermission } from "@ecom/shared-types";
import { prisma } from "../../config";
import { checkStorefrontIds, staffStorefronts } from "../storefronts/storefronts.context";
import { invalidateAdminPermissions, invalidateRolePermissions } from "../../config/admin-permissions";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, type RequestContext } from "../../core";
import { markPasswordChanged } from "../auth/password-reset";
import type { CreateRoleDto, CreateStaffDto, ResetStaffPasswordDto, UpdateRoleDto, UpdateStaffDto } from "./team.dto";

const OWNER = "owner";

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "role";

type RoleRow = {
  id: bigint;
  name: string;
  slug: string;
  isSystem: boolean;
  maxManualDiscountPct: unknown;
  permissions: { permission: string }[];
  _count: { admins: number };
};

const roleView = (r: RoleRow) => ({
  id: String(r.id),
  name: r.name,
  slug: r.slug,
  isSystem: r.isSystem,
  isOwner: r.slug === OWNER,
  maxManualDiscountPct: Number(r.maxManualDiscountPct),
  permissions: r.permissions.map((p) => p.permission).sort(),
  memberCount: r._count.admins,
});

export class TeamService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    return this.ctx.storeId;
  }

  /** What the person making the request holds ("*" for owners and the platform team). */
  private get myPerms(): string[] {
    return this.ctx.admin?.permissions ?? [];
  }

  private get iAmOwner() {
    return !!this.ctx.super || this.myPerms.includes("*");
  }

  /** The acting store admin's id (null for the platform team). */
  private get myId(): bigint | null {
    return this.ctx.super ? null : this.ctx.admin?.id ?? null;
  }

  /** Non-owners may only hand out permissions they have themselves. */
  private assertCanGrant(perms: string[]) {
    if (this.iAmOwner) return;
    const missing = perms.filter((p) => p === "*" || !hasPermission(this.myPerms, p));
    if (missing.length) {
      throw new ForbiddenError(`You can't give permissions you don't have: ${missing.join(", ")}`, "AUTH_INSUFFICIENT_PERMISSION");
    }
  }

  // ------------------------------------------------------------------ roles

  catalogue() {
    return PERMISSION_AREAS;
  }

  async listRoles() {
    const rows = await prisma.role.findMany({
      where: { storeId: this.storeId },
      include: { permissions: { select: { permission: true } }, _count: { select: { admins: true } } },
      orderBy: [{ isSystem: "desc" }, { id: "asc" }],
    });
    // Owner first, then built-in roles, then the store's own.
    return rows.map(roleView).sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  }

  private async getRoleRow(id: bigint) {
    const row = await prisma.role.findFirst({
      where: { id, storeId: this.storeId },
      include: { permissions: { select: { permission: true } }, _count: { select: { admins: true } } },
    });
    if (!row) throw new NotFoundError("Role", String(id));
    return row;
  }

  async getRole(id: bigint) {
    return roleView(await this.getRoleRow(id));
  }

  private checkCodes(perms: string[]) {
    const unknown = perms.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (unknown.length) throw new BadRequestError(`Unknown permissions: ${unknown.join(", ")}`, "VALIDATION_FAILED");
    return [...new Set(perms)];
  }

  async createRole(dto: CreateRoleDto) {
    const storeId = this.storeId;
    let perms = dto.permissions;
    let cap = dto.maxManualDiscountPct;
    if (dto.copyFromRoleId) {
      const src = await this.getRoleRow(dto.copyFromRoleId);
      if (src.slug === OWNER) throw new BadRequestError("Make a copy of another role; the owner role can't be copied", "VALIDATION_FAILED");
      perms = perms ?? src.permissions.map((p) => p.permission);
      cap = cap ?? Number(src.maxManualDiscountPct);
    }
    perms = this.checkCodes(perms ?? []);
    this.assertCanGrant(perms);

    const base = slugify(dto.name);
    let slug = base;
    for (let i = 2; await prisma.role.findUnique({ where: { storeId_slug: { storeId, slug } } }); i++) slug = `${base}_${i}`;
    if (await prisma.role.findFirst({ where: { storeId, name: { equals: dto.name, mode: "insensitive" } } })) {
      throw new ConflictError(`A role called "${dto.name}" already exists`, "CONFLICT");
    }

    const role = await prisma.role.create({
      data: {
        storeId,
        name: dto.name,
        slug,
        isSystem: false,
        maxManualDiscountPct: cap ?? 0,
        permissions: { create: perms.map((permission) => ({ permission })) },
      },
    });
    return this.getRole(role.id);
  }

  async updateRole(id: bigint, dto: UpdateRoleDto) {
    const row = await this.getRoleRow(id);
    if (row.slug === OWNER) throw new ForbiddenError("The owner role always has full access and can't be changed", "AUTH_INSUFFICIENT_PERMISSION");
    if (dto.name !== undefined && dto.name !== row.name) {
      if (row.isSystem) throw new BadRequestError("Built-in roles keep their names; make a copy to rename it", "VALIDATION_FAILED");
      const dup = await prisma.role.findFirst({ where: { storeId: this.storeId, name: { equals: dto.name, mode: "insensitive" }, id: { not: id } } });
      if (dup) throw new ConflictError(`A role called "${dto.name}" already exists`, "CONFLICT");
    }
    if (!this.iAmOwner && this.myId !== null) {
      const me = await prisma.adminUser.findUnique({ where: { id: this.myId }, select: { roleId: true } });
      if (me?.roleId === id) throw new ForbiddenError("You can't change your own role", "AUTH_INSUFFICIENT_PERMISSION");
    }
    let perms: string[] | undefined;
    if (dto.permissions !== undefined) {
      perms = this.checkCodes(dto.permissions);
      // Only newly added codes need to be ones the editor holds.
      const current = new Set(row.permissions.map((p) => p.permission));
      this.assertCanGrant(perms.filter((p) => !current.has(p)));
    }

    await prisma.$transaction(async (t) => {
      await t.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.maxManualDiscountPct !== undefined ? { maxManualDiscountPct: dto.maxManualDiscountPct } : {}),
        },
      });
      if (perms) {
        await t.permissionAssignment.deleteMany({ where: { roleId: id } });
        await t.permissionAssignment.createMany({ data: perms.map((permission) => ({ roleId: id, permission })) });
      }
    });
    await invalidateRolePermissions(this.storeId, id);
    return this.getRole(id);
  }

  async deleteRole(id: bigint) {
    const row = await this.getRoleRow(id);
    if (row.isSystem) throw new BadRequestError("Built-in roles can't be deleted", "VALIDATION_FAILED");
    if (row._count.admins > 0) {
      throw new ConflictError(`${row._count.admins} staff member(s) still have this role; give them another role first`, "CONFLICT");
    }
    await prisma.role.delete({ where: { id } });
    return { id: String(id), deleted: true };
  }

  // ------------------------------------------------------------------ staff

  async listStaff() {
    const rows = await prisma.adminUser.findMany({
      where: { storeId: this.storeId },
      include: { role: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    return rows.map((u) => this.staffView(u));
  }

  private staffView(u: {
    id: bigint;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    lastLoginAt: Date | null;
    createdAt: Date;
    role: { id: bigint; name: string; slug: string };
    storefrontIds: bigint[];
  }) {
    return {
      id: String(u.id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      role: { id: String(u.role.id), name: u.role.name, slug: u.role.slug },
      storefrontIds: u.storefrontIds.map(String),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      isYou: this.myId !== null && u.id === this.myId,
    };
  }

  private async getStaffRow(id: bigint) {
    const row = await prisma.adminUser.findFirst({
      where: { id, storeId: this.storeId },
      include: { role: { select: { id: true, name: true, slug: true } } },
    });
    if (!row) throw new NotFoundError("Staff member", String(id));
    return row;
  }

  /** The role someone is about to be given: in this store, and not beyond what the editor holds. */
  private async assignableRole(roleId: bigint) {
    const role = await this.getRoleRow(roleId);
    if (!this.iAmOwner) {
      if (role.slug === OWNER) throw new ForbiddenError("Only an owner can make someone an owner", "AUTH_INSUFFICIENT_PERMISSION");
      this.assertCanGrant(role.permissions.map((p) => p.permission));
    }
    return role;
  }

  /**
   * Storefronts to limit someone to: this store's, and for an editor who is limited themselves,
   * only (some of) their own, so nobody gives more than they have. Owners always work on all.
   */
  private async storefrontLimit(ids: bigint[] | undefined, roleSlug: string): Promise<bigint[] | undefined> {
    if (ids === undefined) return undefined;
    const unique = [...new Set(ids.map(String))].map((x) => BigInt(x));
    if (roleSlug === OWNER && unique.length) throw new BadRequestError("An owner works on every storefront", "VALIDATION_FAILED");
    await checkStorefrontIds(this.storeId, unique);
    const mine = staffStorefronts(this.ctx);
    if (mine && (!unique.length || unique.some((id) => !mine.includes(id)))) {
      throw new ForbiddenError("You can only give access to storefronts you work on", "AUTH_INSUFFICIENT_PERMISSION");
    }
    return unique;
  }

  private async activeOwnerCount() {
    return prisma.adminUser.count({ where: { storeId: this.storeId, status: "active", role: { slug: OWNER } } });
  }

  async createStaff(dto: CreateStaffDto) {
    const storeId = this.storeId;
    const role = await this.assignableRole(dto.roleId);
    // Staff limited to some storefronts can only add people to those.
    const storefrontIds = (await this.storefrontLimit(dto.storefrontIds, role.slug)) ?? staffStorefronts(this.ctx) ?? [];
    const email = dto.email.toLowerCase();
    if (await prisma.adminUser.findUnique({ where: { storeId_email: { storeId, email } } })) {
      throw new ConflictError(`${email} already has a staff account here`, "CONFLICT");
    }
    const u = await prisma.adminUser.create({
      data: {
        storeId,
        email,
        name: dto.name,
        phone: dto.phone || null,
        roleId: dto.roleId,
        storefrontIds,
        status: "active",
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      include: { role: { select: { id: true, name: true, slug: true } } },
    });
    return this.staffView(u);
  }

  async updateStaff(id: bigint, dto: UpdateStaffDto) {
    const u = await this.getStaffRow(id);
    const isMe = this.myId !== null && u.id === this.myId;
    const isOwner = u.role.slug === OWNER;
    if (!this.iAmOwner && isOwner) throw new ForbiddenError("Only an owner can change an owner's account", "AUTH_INSUFFICIENT_PERMISSION");
    if (isMe && dto.roleId !== undefined && dto.roleId !== u.role.id) {
      throw new ForbiddenError("You can't change your own role", "AUTH_INSUFFICIENT_PERMISSION");
    }
    if (isMe && dto.status === "inactive") throw new ForbiddenError("You can't deactivate yourself", "AUTH_INSUFFICIENT_PERMISSION");
    if (isMe && dto.storefrontIds !== undefined) throw new ForbiddenError("You can't change your own storefronts", "AUTH_INSUFFICIENT_PERMISSION");
    // A limited editor can't change someone who works on storefronts they don't.
    const mine = staffStorefronts(this.ctx);
    if (mine && (!u.storefrontIds.length || u.storefrontIds.some((sid) => !mine.includes(sid)))) {
      throw new ForbiddenError("This person works on storefronts you don't", "AUTH_INSUFFICIENT_PERMISSION");
    }

    let newRoleSlug = u.role.slug;
    if (dto.roleId !== undefined && dto.roleId !== u.role.id) newRoleSlug = (await this.assignableRole(dto.roleId)).slug;
    const storefrontIds = await this.storefrontLimit(dto.storefrontIds, newRoleSlug);
    const losesOwner = isOwner && u.status === "active" && (newRoleSlug !== OWNER || dto.status === "inactive");
    if (losesOwner && (await this.activeOwnerCount()) <= 1) {
      throw new ConflictError("The store needs at least one active owner", "CONFLICT");
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        // Becoming an owner: every storefront.
        ...(newRoleSlug === OWNER ? { storefrontIds: [] } : storefrontIds !== undefined ? { storefrontIds } : {}),
      },
      include: { role: { select: { id: true, name: true, slug: true } } },
    });
    await invalidateAdminPermissions(this.storeId, [id]);
    if (dto.status === "inactive" && u.status !== "inactive") await markPasswordChanged("admin", id);
    return this.staffView(updated);
  }

  async resetStaffPassword(id: bigint, dto: ResetStaffPasswordDto) {
    const u = await this.getStaffRow(id);
    if (!this.iAmOwner && u.role.slug === OWNER) {
      throw new ForbiddenError("Only an owner can change an owner's password", "AUTH_INSUFFICIENT_PERMISSION");
    }
    await prisma.adminUser.update({ where: { id }, data: { passwordHash: await bcrypt.hash(dto.password, 12) } });
    // Sessions signed in with the old password end.
    await markPasswordChanged("admin", id);
    return { id: String(id), passwordChanged: true };
  }
}
