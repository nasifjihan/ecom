import type { Request, Response } from "express";
import {
  prisma,
  env,
  jwt as jwtCfg,
  COOKIE_NAMES,
} from "../../config";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  envelope,
  ctrl,
  BaseController,
} from "../../core";
import bcrypt from "bcryptjs";
import type { RequestContext } from "../../core/base.repository";
import type { TokenAudience, TokenPayload } from "../../config/jwt";
import { UserType, AdminRole } from "@ecom/shared-types";
import { AuthService } from "./auth.service";
import type {
  SuperLoginDto,
  AdminLoginDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  AdminOwnerRegisterFirstDto,
  RefreshTokenDto,
} from "./auth.dto";

function omitPasswordHash(obj: any): any {
  if (!obj) return obj;
  const { passwordHash, ...rest } = obj;
  return rest;
}

export class AuthController extends BaseController {
  private service = (ctx: RequestContext) => new AuthService(ctx);

  private setCookie(res: Response, audience: TokenAudience, refreshToken: string) {
    const name =
      audience === "super"
        ? COOKIE_NAMES.SUPER_REFRESH
        : audience === "admin"
          ? COOKIE_NAMES.ADMIN_REFRESH
          : COOKIE_NAMES.CUSTOMER_REFRESH;
    res.cookie(name, refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      domain: env.COOKIE_DOMAIN,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearCookie(res: Response, audience: TokenAudience) {
    const name =
      audience === "super"
        ? COOKIE_NAMES.SUPER_REFRESH
        : audience === "admin"
          ? COOKIE_NAMES.ADMIN_REFRESH
          : COOKIE_NAMES.CUSTOMER_REFRESH;
    res.clearCookie(name, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      domain: env.COOKIE_DOMAIN,
      path: "/",
    });
  }

  postSuperLogin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = req.body as SuperLoginDto;
    const svc = this.service(req.ctx);
    const user = await svc.superLogin(dto);
    const tokens = await svc.issueTokens(user, "super");
    this.setCookie(res, "super", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(user),
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postAdminLogin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = req.body as AdminLoginDto;
    const storeId = (req.body as any).storeId ?? req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const svc = this.service(req.ctx);
    const result = await svc.adminLogin(dto, BigInt(storeId));
    req.ctx.admin = {
      id: result.user.id,
      role:
        (result.user.role as any)?.name ??
        (result.user.role as any)?.slug ??
        (String(result.user.role) || "ADMIN"),
      permissions: result.permissions,
    };
    const tokens = await svc.issueTokens(result.user, "admin");
    this.setCookie(res, "admin", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(result.user),
        permissions: result.permissions,
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postCustomerLogin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = req.body as CustomerLoginDto;
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const svc = this.service(req.ctx);
    const customer = await svc.customerLogin(dto, storeId);
    const tokens = await svc.issueTokens(customer, "customer");
    this.setCookie(res, "customer", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(customer),
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postCustomerRegister = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = req.body as CustomerRegisterDto;
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const svc = this.service(req.ctx);
    const customer = await svc.customerRegister(dto, storeId);
    const tokens = await svc.issueTokens(customer, "customer");
    this.setCookie(res, "customer", tokens.refreshToken);
    envelope(res, {
      status: 201,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(customer),
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postRegisterOwnerFirst = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = req.body as AdminOwnerRegisterFirstDto;
    const count = await prisma.adminUser.count({
      where: {
        storeId: dto.storeId,
        role: { name: "owner" },
      },
    });
    if (count > 0) {
      throw new ForbiddenError(
        "Store already has an owner",
        "AUTH_INSUFFICIENT_PERMISSION",
      );
    }
    let roleId = dto.roleId;
    if (!roleId) {
      const ownerRole = await prisma.role.findFirst({
        where: {
          OR: [{ name: "owner" }, { slug: "owner" }, { name: "OWNER" }],
        },
      });
      if (!ownerRole) {
        throw new ForbiddenError(
          "Owner role not configured",
          "AUTH_INSUFFICIENT_PERMISSION",
        );
      }
      roleId = ownerRole.id;
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await prisma.adminUser.create({
      data: {
        storeId: dto.storeId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId,
        status: "active",
      } as any,
      include: {
        role: { include: { permissions: true } },
      },
    });
    envelope(res, {
      status: 201,
      data: { user: omitPasswordHash(user) },
    });
  });

  postRefreshSuper = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = (req.body ?? {}) as RefreshTokenDto;
    const tok = dto.refreshToken ?? (req.cookies?.[COOKIE_NAMES.SUPER_REFRESH] as string);
    if (!tok) throw new UnauthorizedError("Missing refresh token", "AUTH_MISSING_TOKEN");
    const svc = this.service(req.ctx);
    const payload = await svc.validateRefresh(tok, "super");
    const user = await svc.getSuperProfile(BigInt(payload.sub));
    const tokens = await svc.issueTokens(user, "super");
    this.setCookie(res, "super", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(user),
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postRefreshAdmin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = (req.body ?? {}) as RefreshTokenDto;
    const tok = dto.refreshToken ?? (req.cookies?.[COOKIE_NAMES.ADMIN_REFRESH] as string);
    if (!tok) throw new UnauthorizedError("Missing refresh token", "AUTH_MISSING_TOKEN");
    const svc = this.service(req.ctx);
    const payload = await svc.validateRefresh(tok, "admin");
    const storeId = payload.storeId ? BigInt(payload.storeId) : req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const user = await svc.getAdminProfile(BigInt(payload.sub), storeId);
    let permissions: string[] = [];
    if (user.roleId) {
      permissions = await svc.loadAdminPermissions(user.roleId);
    } else if (user.role?.permissions) {
      permissions = (user.role.permissions as any[]).map((p) => p.permission ?? p.name ?? String(p));
    }
    req.ctx.admin = {
      id: user.id,
      role:
        (user.role as any)?.name ??
        (user.role as any)?.slug ??
        "ADMIN",
      permissions,
    };
    const tokens = await svc.issueTokens(user, "admin");
    this.setCookie(res, "admin", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(user),
        permissions,
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postRefreshCustomer = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const dto = (req.body ?? {}) as RefreshTokenDto;
    const tok = dto.refreshToken ?? (req.cookies?.[COOKIE_NAMES.CUSTOMER_REFRESH] as string);
    if (!tok) throw new UnauthorizedError("Missing refresh token", "AUTH_MISSING_TOKEN");
    const svc = this.service(req.ctx);
    const payload = await svc.validateRefresh(tok, "customer");
    const storeId = payload.storeId ? BigInt(payload.storeId) : req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const user = await svc.getCustomerProfile(BigInt(payload.sub), storeId);
    const tokens = await svc.issueTokens(user, "customer");
    this.setCookie(res, "customer", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(user),
        expiresInMin: tokens.expiresInMin,
      },
    });
  });

  postLogout = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.service(req.ctx);
    let audience: TokenAudience = "customer";
    let id: bigint | undefined;
    if (req.ctx.super?.id) {
      audience = "super";
      id = req.ctx.super.id;
    } else if (req.ctx.admin?.id) {
      audience = "admin";
      id = req.ctx.admin.id;
    } else if (req.ctx.customer?.id) {
      audience = "customer";
      id = req.ctx.customer.id;
    }
    this.clearCookie(res, audience);
    if (id) await svc.logout(id, audience);
    else await svc.logout(0n, audience);
    envelope(res, { status: 200, data: { ok: true } });
  });

  getMeSuper = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const id = req.ctx.super?.id;
    if (!id) throw new UnauthorizedError("Not authenticated", "AUTH_MISSING_TOKEN");
    const svc = this.service(req.ctx);
    const user = await svc.getSuperProfile(id);
    envelope(res, { status: 200, data: omitPasswordHash(user) });
  });

  getMeAdmin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const id = req.ctx.admin?.id;
    const storeId = req.ctx.storeId;
    if (!id) throw new UnauthorizedError("Not authenticated", "AUTH_MISSING_TOKEN");
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const svc = this.service(req.ctx);
    const user = await svc.getAdminProfile(id, storeId);
    envelope(res, { status: 200, data: omitPasswordHash(user) });
  });

  getMeCustomer = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const id = req.ctx.customer?.id;
    const storeId = req.ctx.storeId;
    if (!id) throw new UnauthorizedError("Not authenticated", "AUTH_MISSING_TOKEN");
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const svc = this.service(req.ctx);
    const user = await svc.getCustomerProfile(id, storeId);
    envelope(res, { status: 200, data: omitPasswordHash(user) });
  });

  getMeAny = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.service(req.ctx);
    if (req.ctx.super?.id) {
      const user = await svc.getSuperProfile(req.ctx.super.id);
      envelope(res, { status: 200, data: { audience: "super", user: omitPasswordHash(user) } });
      return;
    }
    if (req.ctx.admin?.id && req.ctx.storeId) {
      const user = await svc.getAdminProfile(req.ctx.admin.id, req.ctx.storeId);
      envelope(res, { status: 200, data: { audience: "admin", user: omitPasswordHash(user) } });
      return;
    }
    if (req.ctx.customer?.id && req.ctx.storeId) {
      const user = await svc.getCustomerProfile(req.ctx.customer.id, req.ctx.storeId);
      envelope(res, { status: 200, data: { audience: "customer", user: omitPasswordHash(user) } });
      return;
    }
    throw new UnauthorizedError("Not authenticated", "AUTH_MISSING_TOKEN");
  });
}

export const authController = new AuthController();
