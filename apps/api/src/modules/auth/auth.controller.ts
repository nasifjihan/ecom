import type { Request, Response } from "express";
import { isBanned } from "../customers/customer.rules";
import { NewsletterService } from "../customers/newsletter.service";
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
import { emitCustomerRegistered } from "../notifications";
import { SmsService } from "../sms/sms.service";
import type { OtpVerifyDto } from "../sms/sms.dto";
import { CustomerLoginService, type EmailCodeVerifyDto } from "./customer-login";
import { isOAuthProvider } from "./oauth.providers";
import { adminNeedsTwoFactor } from "../../config/admin-permissions";
import type {
  SuperLoginDto,
  AdminLoginDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  AdminOwnerRegisterFirstDto,
  RefreshTokenDto,
} from "./auth.dto";

/** The store a refresh token belongs to; refused on another store's address. */
function refreshStore(payload: TokenPayload, ctx: RequestContext): bigint {
  const storeId = payload.storeId ? BigInt(payload.storeId) : ctx.storeId;
  if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
  if (ctx.storeId !== undefined && storeId !== ctx.storeId) throw new UnauthorizedError("Invalid or expired token", "AUTH_INVALID_TOKEN");
  return storeId;
}

function omitPasswordHash(obj: any): any {
  if (!obj) return obj;
  const { passwordHash, ...rest } = obj;
  return rest;
}

/** The httpOnly refresh-token cookie for one kind of account (also used after two-step changes). */
export function setRefreshCookie(res: Response, audience: TokenAudience, refreshToken: string) {
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

export class AuthController extends BaseController {
  private service = (ctx: RequestContext) => new AuthService(ctx);

  private setCookie(res: Response, audience: TokenAudience, refreshToken: string) {
    setRefreshCookie(res, audience, refreshToken);
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
    emitCustomerRegistered({ storeId: String(storeId), customerId: String(customer.id) });
    // "Send me offers" at sign-up puts them on the newsletter list (never blocks signing up).
    if (dto.acceptMarketing && customer.email) {
      await new NewsletterService(BigInt(storeId))
        .subscribe({ email: customer.email, name: `${customer.firstName} ${customer.lastName}`.trim(), source: "signup", locale: req.ctx.locale })
        .catch(() => undefined);
    }
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

  /** Which ways a customer can sign in on this storefront. */
  getCustomerLoginMethods = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    envelope(res, { data: await new CustomerLoginService(BigInt(storeId)).methods(req.ctx.storefrontId) });
  });

  /** The Google / Facebook address to send the customer to. */
  postCustomerOAuthStart = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const provider = String(req.params.provider);
    if (!isOAuthProvider(provider)) throw new NotFoundError("Sign-in provider");
    envelope(res, {
      data: await new CustomerLoginService(BigInt(storeId)).startOAuth(
        provider,
        req.get("origin"),
        (req.body as { next?: string }).next,
        req.ctx.storefrontId,
      ),
    });
  });

  /** Finishes Google / Facebook sign-in with the code the provider sent back. */
  postCustomerOAuthFinish = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const b = req.body as { code: string; state: string };
    const { customer, created, next } = await new CustomerLoginService(BigInt(storeId)).finishOAuth(
      b.code,
      b.state,
      req.get("origin"),
    );
    await this.signInCustomer(req, res, customer, created, { next });
  });

  /** Emails a 6-digit sign-in code. */
  postCustomerEmailCodeRequest = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const r = await new CustomerLoginService(BigInt(storeId)).requestEmailCode(
      (req.body as { email: string }).email,
      req.ctx.ip ?? null,
    );
    envelope(res, { status: 200, message: "Code sent", data: { sent: true, expiresInMinutes: r.expiresInMinutes } });
  });

  /** Checks the emailed code and signs the customer in, creating an account for a new email. */
  postCustomerEmailCodeVerify = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const { customer, created } = await new CustomerLoginService(BigInt(storeId)).verifyEmailCode(
      req.body as EmailCodeVerifyDto,
    );
    await this.signInCustomer(req, res, customer, created);
  });

  /** Issues tokens for a customer who proved who they are, and sets the refresh cookie. */
  private async signInCustomer(
    req: Request & { ctx: RequestContext },
    res: Response,
    customer: Awaited<ReturnType<SmsService["verifyOtp"]>>["customer"],
    created: boolean,
    extra: Record<string, unknown> = {},
  ) {
    if (created) emitCustomerRegistered({ storeId: String(req.ctx.storeId), customerId: String(customer.id) });
    const tokens = await this.service(req.ctx).issueTokens(customer, "customer");
    this.setCookie(res, "customer", tokens.refreshToken);
    envelope(res, {
      status: 200,
      data: {
        accessToken: tokens.accessToken,
        user: omitPasswordHash(customer),
        expiresInMin: tokens.expiresInMin,
        created,
        ...extra,
      },
    });
  }

  /** Sends a 6-digit sign-in code by SMS. */
  postCustomerOtpRequest = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const r = await new SmsService(BigInt(storeId)).requestOtp((req.body as { phone: string }).phone, req.ctx.ip ?? null);
    envelope(res, { status: 200, message: "Code sent", data: { sent: true, expiresInMinutes: r.expiresInMinutes } });
  });

  /** Checks the code and signs the customer in, creating an account for a new number. */
  postCustomerOtpVerify = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = req.ctx.storeId;
    if (!storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
    const dto = req.body as OtpVerifyDto;
    const { customer, created } = await new SmsService(BigInt(storeId)).verifyOtp(dto.phone, dto.code, dto);
    await this.signInCustomer(req, res, customer, created);
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
    const storeId = refreshStore(payload, req.ctx);
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
    const storeId = refreshStore(payload, req.ctx);
    const user = await svc.getCustomerProfile(BigInt(payload.sub), storeId);
    // A customer banned since signing in loses the session at the next refresh.
    if (isBanned(user.status)) throw new UnauthorizedError("Account suspended", "AUTH_ACCOUNT_SUSPENDED");
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
    // The store requires two-step sign-in and this person hasn't set it up: the admin shows the setup screen.
    const twoFactorSetupRequired = await adminNeedsTwoFactor(BigInt(storeId), BigInt(id));
    envelope(res, { status: 200, data: { ...omitPasswordHash(user), twoFactorSetupRequired } });
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
