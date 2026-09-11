/**
 * JSON WEB TOKEN helpers — 3 audiences: SUPER_ADMIN / ADMIN / CUSTOMER.
 *
 * Why separate tokens per audience?
 *  - A customer JWT cannot be used on /api/admin/* endpoints even if stolen.
 *  - Short-lived access tokens (15 min) + long-lived refresh tokens (7 days) cookies.
 */
import jwt from "jsonwebtoken";
import { env } from "./env";
import type { AdminRole, UserType } from "@ecom/shared-types";

export type TokenAudience = "super" | "admin" | "customer";

export type TokenPayload = {
  sub: string;            // userId (stringified BigInt)
  storeId?: string;       // stringified BigInt (super has none)
  email?: string;
  role?: AdminRole;
  type: UserType;
  aud: TokenAudience;
  iat?: number;
  exp?: number;
  jti: string;
};

const SECRETS: Record<TokenAudience, { access: string; refresh: string }> = {
  super: {
    access: env.JWT_SUPER_ACCESS_SECRET,
    refresh: env.JWT_SUPER_REFRESH_SECRET,
  },
  admin: {
    access: env.JWT_ADMIN_ACCESS_SECRET,
    refresh: env.JWT_ADMIN_REFRESH_SECRET,
  },
  customer: {
    access: env.JWT_CUSTOMER_ACCESS_SECRET,
    refresh: env.JWT_CUSTOMER_REFRESH_SECRET,
  },
};

import { newId } from "@ecom/utils";

export function signAccessToken(payload: Omit<TokenPayload, "aud" | "jti" | "iat" | "exp">, audience: TokenAudience): string {
  return jwt.sign(
    { ...payload, jti: newId("jti") },
    SECRETS[audience].access,
    {
      algorithm: "HS256",
      expiresIn: `${env.JWT_ACCESS_TTL_MIN}m`,
      audience,
      issuer: "ecom-platform",
    },
  );
}

export function signRefreshToken(payload: Omit<TokenPayload, "aud" | "jti" | "iat" | "exp">, audience: TokenAudience): string {
  return jwt.sign(
    { ...payload, jti: newId("jti") },
    SECRETS[audience].refresh,
    {
      algorithm: "HS256",
      expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
      audience,
      issuer: "ecom-platform",
    },
  );
}

export function verifyAccessToken(token: string, audience: TokenAudience): TokenPayload {
  return jwt.verify(token, SECRETS[audience].access, {
    algorithms: ["HS256"],
    audience,
    issuer: "ecom-platform",
  }) as TokenPayload;
}

export function verifyRefreshToken(token: string, audience: TokenAudience): TokenPayload {
  return jwt.verify(token, SECRETS[audience].refresh, {
    algorithms: ["HS256"],
    audience,
    issuer: "ecom-platform",
  }) as TokenPayload;
}
