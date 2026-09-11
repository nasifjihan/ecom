import {
  prisma,
  logger,
  env,
  jwt as jwtCfg,
  cacheGet,
  cacheSet,
  CACHE_KEYS,
  COOKIE_NAMES,
} from "../../config";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  envelope,
  ctrl,
  BaseService,
  BaseController,
} from "../../core";
import bcrypt from "bcryptjs";
import type { RequestContext } from "../../core/base.repository";
import type { TokenAudience, TokenPayload } from "../../config/jwt";
import { UserType, AdminRole } from "@ecom/shared-types";
import type {
  SuperLoginDto,
  AdminLoginDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  AdminOwnerRegisterFirstDto,
} from "./auth.dto";

export class AuthService extends BaseService {
  constructor(ctx: RequestContext) {
    super(ctx);
  }

  async superLogin(dto: SuperLoginDto) {
    const row = await prisma.platformAdmin.findUnique({
      where: { email: dto.email },
    });
    if (!row) {
      throw new UnauthorizedError("Invalid credentials", "AUTH_CREDENTIALS_INVALID");
    }
    const ok = await bcrypt.compare(dto.password, row.passwordHash ?? "");
    if (!ok) {
      throw new UnauthorizedError("Invalid credentials", "AUTH_CREDENTIALS_INVALID");
    }
    const lastLoginIp = this.ctx.requestId ?? "";
    await prisma.platformAdmin.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date(), lastLoginIp },
    });
    const exists = await prisma.adminUser.findUnique({
      where: { id: row.id },
    }).catch(() => null);
    if (exists) {
      await prisma.auditLog.create({
        data: {
          storeId: this.ctx.storeId,
          action: "SUPER_LOGIN",
          entityType: "PLATFORM_ADMIN",
          entityId: String(row.id),
          meta: { ip: lastLoginIp, adminId: String(row.id) },
        } as any,
      });
    } else {
      logger.info({ superAdminId: String(row.id), ip: lastLoginIp }, "Super login");
    }
    return row;
  }

  async adminLogin(dto: AdminLoginDto, storeId: bigint) {
    const row = await prisma.adminUser.findUnique({
      where: {
        storeId_email: { storeId, email: dto.email },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });
    if (!row) {
      throw new UnauthorizedError("Invalid credentials", "AUTH_CREDENTIALS_INVALID");
    }
    const ok = await bcrypt.compare(dto.password, row.passwordHash ?? "");
    if (!ok) {
      throw new UnauthorizedError("Invalid credentials", "AUTH_CREDENTIALS_INVALID");
    }
    if (row.status !== "active") {
      throw new UnauthorizedError("Account inactive", "AUTH_ACCOUNT_INACTIVE");
    }
    const lastLoginIp = this.ctx.requestId ?? "";
    await prisma.adminUser.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date(), lastLoginIp },
    });
    const perms: string[] = [];
    if (row.role?.permissions) {
      for (const p of row.role.permissions) {
        perms.push((p as any).permission ?? (p as any).name ?? String(p));
      }
    }
    return { user: row, permissions: perms };
  }

  async customerLogin(dto: CustomerLoginDto, storeId: bigint) {
    const row = await prisma.customer.findUnique({
      where: {
        storeId_email: { storeId, email: dto.email },
      },
    });
    if (!row) {
      throw new UnauthorizedError("Invalid credentials", "AUTH_CREDENTIALS_INVALID");
    }
    const ok = await bcrypt.compare(dto.password, row.passwordHash ?? "");
    if (!ok) {
      throw new UnauthorizedError("Invalid credentials", "AUTH_CREDENTIALS_INVALID");
    }
    if (row.status !== "active") {
      throw new UnauthorizedError("Account suspended", "AUTH_ACCOUNT_SUSPENDED");
    }
    const lastLoginIp = this.ctx.requestId ?? "";
    await prisma.customer.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date(), lastLoginIp },
    });
    return row;
  }

  async customerRegister(dto: CustomerRegisterDto, storeId: bigint) {
    const existing = await prisma.customer.findUnique({
      where: {
        storeId_email: { storeId, email: dto.email },
      },
    });
    if (existing) {
      throw new ConflictError("Email already registered", "DUPLICATE_EMAIL");
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return prisma.customer.create({
      data: {
        storeId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        acceptMarketing: dto.acceptMarketing,
      },
    });
  }

  async getSuperProfile(id: bigint) {
    const row = await prisma.platformAdmin.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("PlatformAdmin", id);
    return row;
  }

  async getAdminProfile(id: bigint, storeId: bigint) {
    const row = await prisma.adminUser.findUnique({
      where: { id },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });
    if (!row) throw new NotFoundError("AdminUser", id);
    (row as any).passwordHash = null;
    return row;
  }

  async getCustomerProfile(id: bigint, storeId: bigint) {
    const row = await prisma.customer.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("Customer", id);
    (row as any).passwordHash = null;
    return row;
  }

  async issueTokens(user: any, audience: TokenAudience) {
    const payload: Omit<TokenPayload, "aud" | "jti" | "iat" | "exp"> = {
      sub: String(user.id),
      type:
        audience === "super"
          ? UserType.PLATFORM_SUPER_ADMIN
          : audience === "admin"
            ? UserType.STORE_ADMIN
            : UserType.CUSTOMER,
    };
    if (audience === "admin" || audience === "customer") {
      payload.storeId = String(this.ctx.storeId ?? user.storeId);
    }
    if (user.email) payload.email = user.email;
    if (audience === "admin" && user.role) {
      payload.role = (typeof user.role === "object"
        ? (user.role.name as AdminRole) ?? (user.role.slug as AdminRole) ?? "ADMIN"
        : (user.role as AdminRole)) ?? "ADMIN";
    }
    const accessToken = jwtCfg.signAccessToken(payload, audience);
    const refreshToken = jwtCfg.signRefreshToken(payload, audience);
    return {
      accessToken,
      refreshToken,
      expiresInMin: env.JWT_ACCESS_TTL_MIN,
    };
  }

  async validateRefresh(tok: string, audience: TokenAudience) {
    return jwtCfg.verifyRefreshToken(tok, audience);
  }

  async logout(_id: bigint, _audience: TokenAudience) {
    return { ok: true };
  }

  async loadAdminPermissions(roleId: bigint): Promise<string[]> {
    const cacheKey = `perms:role:${String(roleId)}`;
    const cached = await cacheGet<string[]>(cacheKey);
    if (cached) return cached;
    const rows = await prisma.permissionAssignment.findMany({
      where: { roleId },
    });
    const perms = rows.map((p: any) => p.permission);
    await cacheSet(cacheKey, perms, CACHE_KEYS.TTL_LONG ?? 3600);
    return perms;
  }
}
