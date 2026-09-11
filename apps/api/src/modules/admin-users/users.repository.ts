import { BaseRepository, type RequestContext } from "../../core";
import type { PaginationDtoType } from "./users.dto";

export class AdminUserRepository extends BaseRepository<"adminUser"> {
  constructor() {
    super("adminUser");
  }

  async findByEmail(ctx: RequestContext, email: string) {
    return this.findBy(ctx, { email });
  }

  async listPaginated(ctx: RequestContext, paginated: PaginationDtoType) {
    const where: Record<string, unknown> = {};
    if (paginated.search) {
      where.OR = [
        { name: { contains: paginated.search, mode: "insensitive" } },
        { email: { contains: paginated.search, mode: "insensitive" } },
      ];
    }
    if (paginated.roleId) {
      where.roleId = paginated.roleId;
    }
    if (paginated.status) {
      where.status = paginated.status;
    }
    return this.paginate(ctx, {
      ...paginated,
      where,
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });
  }

  async updateStatus(ctx: RequestContext, id: bigint, status: string) {
    return this.update(ctx, id, { status });
  }

  maskPasswordHash(row: any) {
    if (!row) return row;
    const result = { ...row };
    result.passwordHash = null;
    if (result.role) {
      result.role = { ...result.role };
    }
    return result;
  }
}

export class RoleRepository extends BaseRepository<"role"> {
  constructor() {
    super("role");
  }

  async findBySlug(ctx: RequestContext, slug: string) {
    return this.findBy(ctx, { slug });
  }

  async listPaginated(ctx: RequestContext, paginated: PaginationDtoType) {
    const where: Record<string, unknown> = {};
    if (paginated.search) {
      where.OR = [
        { name: { contains: paginated.search, mode: "insensitive" } },
        { slug: { contains: paginated.search, mode: "insensitive" } },
      ];
    }
    return this.paginate(ctx, {
      ...paginated,
      where,
      include: {
        permissions: true,
        _count: {
          select: {
            admins: true,
            permissions: true,
          },
        },
      },
    });
  }

  async listAllWithPermissions(ctx: RequestContext) {
    return this.list(ctx, {}, { include: { permissions: true } });
  }
}
