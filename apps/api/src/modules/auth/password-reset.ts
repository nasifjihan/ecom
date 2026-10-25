/**
 * FORGOT / RESET PASSWORD for customers (storefront) and store staff (store admin).
 *
 * The emailed link carries a signed token that lasts an hour and includes a fingerprint of the
 * current password hash, so it stops working as soon as the password changes (single use).
 * After a reset, refresh tokens issued earlier are refused, which signs out other devices.
 */
import { createHash } from "node:crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { env, prisma } from "../../config"
import { BadRequestError, UnauthorizedError } from "../../core"
import type { TokenAudience } from "../../config/jwt"
import { EmailService, inBackground } from "../notifications"

export const RESET_TTL_MIN = 60
type Kind = "customer" | "admin"

const secret = (kind: Kind) =>
  `${kind === "customer" ? env.JWT_CUSTOMER_REFRESH_SECRET : env.JWT_ADMIN_REFRESH_SECRET}:password-reset`
const fingerprint = (hash: string) => createHash("sha256").update(hash).digest("hex").slice(0, 16)
/** Seeded rows use "ACTIVE", app-created ones "active". */
const isActive = (status: string) => status.toLowerCase() === "active"
const invalid = () =>
  new BadRequestError(
    "This reset link is invalid or has expired. Please ask for a new one.",
    "AUTH_INVALID_TOKEN",
  )

function signResetToken(kind: Kind, u: { id: bigint; storeId: bigint; passwordHash: string }) {
  return jwt.sign(
    { sub: String(u.id), sid: String(u.storeId), fp: fingerprint(u.passwordHash) },
    secret(kind),
    {
      algorithm: "HS256",
      expiresIn: `${RESET_TTL_MIN}m`,
      audience: `${kind}-reset`,
      issuer: "ecom-platform",
    },
  )
}

function readResetToken(kind: Kind, token: string, storeId: bigint) {
  try {
    const p = jwt.verify(token, secret(kind), {
      algorithms: ["HS256"],
      audience: `${kind}-reset`,
      issuer: "ecom-platform",
    }) as {
      sub: string
      sid: string
      fp: string
    }
    if (p.sid !== String(storeId)) throw invalid()
    return { id: BigInt(p.sub), fp: p.fp }
  } catch {
    throw invalid()
  }
}

// Kept on the account row, not in Redis: a Redis restart or eviction must not bring ended sessions back.
const accounts = {
  super: prisma.platformAdmin,
  admin: prisma.adminUser,
  customer: prisma.customer,
} as unknown as Record<TokenAudience, {
  update(a: { where: { id: bigint }; data: { sessionsValidFrom: Date } }): Promise<unknown>
  findUnique(a: { where: { id: bigint }; select: { sessionsValidFrom: true } }): Promise<{ sessionsValidFrom: Date | null } | null>
}>

/** Ends sessions issued before now (refresh tokens older than this are refused). */
export async function markPasswordChanged(aud: TokenAudience, id: bigint) {
  // Whole seconds, like a token's iat: tokens issued right after this (same second) stay valid.
  await accounts[aud].update({ where: { id }, data: { sessionsValidFrom: new Date(Math.floor(Date.now() / 1000) * 1000) } })
}

/** Refuses refresh tokens issued before the account's last password reset. */
export async function assertNotRevoked(aud: TokenAudience, sub: string, iat: number | undefined) {
  const row = await accounts[aud].findUnique({ where: { id: BigInt(sub) }, select: { sessionsValidFrom: true } })
  const changedAt = row?.sessionsValidFrom ? row.sessionsValidFrom.getTime() / 1000 : null
  if (changedAt && (iat ?? 0) < changedAt) {
    throw new UnauthorizedError(
      "Your password or sign-in settings changed. Please sign in again.",
      "AUTH_EXPIRED_TOKEN",
    )
  }
}

export class PasswordResetService {
  constructor(private readonly storeId: bigint) {}

  /** Emails a reset link if the address belongs to an active account. Always looks the same to the caller. */
  async requestCustomer(email: string) {
    const c = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: this.storeId, email } },
    })
    if (!c?.passwordHash || !isActive(c.status) || c.isGuest) return
    const token = signResetToken("customer", {
      id: c.id,
      storeId: this.storeId,
      passwordHash: c.passwordHash,
    })
    inBackground("customer password reset", () =>
      new EmailService(this.storeId).customerPasswordReset({ ...c, email }, token, RESET_TTL_MIN),
    )
  }

  async resetCustomer(token: string, password: string) {
    const t = readResetToken("customer", token, this.storeId)
    const c = await prisma.customer.findFirst({ where: { id: t.id, storeId: this.storeId } })
    if (!c?.passwordHash || fingerprint(c.passwordHash) !== t.fp || !isActive(c.status))
      throw invalid()
    await prisma.customer.update({
      where: { id: c.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    })
    await markPasswordChanged("customer", c.id)
    return { email: c.email }
  }

  async requestAdmin(email: string) {
    const a = await prisma.adminUser.findUnique({
      where: { storeId_email: { storeId: this.storeId, email } },
    })
    if (!a || !isActive(a.status)) return
    const token = signResetToken("admin", {
      id: a.id,
      storeId: this.storeId,
      passwordHash: a.passwordHash,
    })
    inBackground("staff password reset", () =>
      new EmailService(this.storeId).staffPasswordReset(a, token, RESET_TTL_MIN),
    )
  }

  async resetAdmin(token: string, password: string) {
    const t = readResetToken("admin", token, this.storeId)
    const a = await prisma.adminUser.findFirst({ where: { id: t.id, storeId: this.storeId } })
    if (!a || fingerprint(a.passwordHash) !== t.fp || !isActive(a.status)) throw invalid()
    await prisma.adminUser.update({
      where: { id: a.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    })
    await markPasswordChanged("admin", a.id)
    return { email: a.email }
  }
}
