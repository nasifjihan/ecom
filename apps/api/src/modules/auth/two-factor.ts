/**
 * TWO-STEP SIGN-IN — an authenticator app code after the password, for store staff ("admin")
 * and the platform team ("super"). The same routes under each:
 *   GET  /api/admin/me/two-factor   ·  /api/super/me/two-factor        { enabled, enabledAt, backupCodesLeft }
 *   POST …/start    → { secret, otpauthUrl, qr } (a new secret, not on yet)
 *   POST …/confirm  { code } → { backupCodes, accessToken } (on; the 10 codes shown once)
 *   POST …/disable  { password }
 *   POST …/backup-codes { password } → { backupCodes, accessToken } (new set, old ones stop working)
 * Turning it on and new backup codes sign the person out everywhere else; this browser gets fresh
 * tokens. Owners reset it for staff: POST /api/admin/staff/:id/two-factor/reset; super owners for
 * the platform team: POST /api/super/admin-users/:id/two-factor/reset.
 * At sign-in, `checkSignInCode` takes a 6-digit code (each works once) or a backup code (each
 * works once). The secret is kept encrypted, backup codes only as hashes.
 */
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import QRCode from "qrcode"
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { decrypt, encrypt, prisma } from "../../config"
import { invalidateAdminPermissions } from "../../config/admin-permissions"
import { BadRequestError, ConflictError, UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, validate } from "../../middleware"
import { markPasswordChanged } from "./password-reset"
import {
  hashBackupCode,
  looksLikeBackupCode,
  newBackupCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
} from "./totp"

/** Store staff, or the platform team. */
export type TwoFactorKind = "admin" | "super"

const TABLE: Record<TwoFactorKind, string> = { admin: "AdminUser", super: "PlatformAdmin" }

interface TwoFactorRow {
  id: bigint
  twoFactorSecret: string | null
  twoFactorEnabledAt: Date | null
  twoFactorLastStep: number | null
  twoFactorBackupCodes: string[]
}

/** The two tables have the same two-step columns; this is the part of each delegate used here. */
interface Accounts {
  findUnique(args: { where: { id: bigint }; select?: Record<string, unknown> }): Promise<Record<string, any> | null>
  update(args: { where: { id: bigint }; data: Record<string, unknown> }): Promise<unknown>
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>
}
const accounts = (kind: TwoFactorKind) => (kind === "admin" ? prisma.adminUser : prisma.platformAdmin) as unknown as Accounts

/** Uses a TOTP code once: only the first request with a step after the last one wins. */
async function useStep(kind: TwoFactorKind, id: bigint, step: number): Promise<boolean> {
  const r = await accounts(kind).updateMany({
    where: { id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
    data: { twoFactorLastStep: step },
  })
  return r.count === 1
}

/** Uses a backup code once (removed in the same statement that checks it). */
async function useBackupCode(kind: TwoFactorKind, id: bigint, code: string): Promise<boolean> {
  const hash = hashBackupCode(code)
  const table = Prisma.raw(`"${TABLE[kind]}"`)
  const n = await prisma.$executeRaw`
    UPDATE ${table} SET "twoFactorBackupCodes" = array_remove("twoFactorBackupCodes", ${hash})
    WHERE id = ${id} AND ${hash} = ANY("twoFactorBackupCodes")`
  return n === 1
}

/** After a right password: nothing to do when two-step sign-in is off, else the code must be right. */
export async function checkSignInCode(kind: TwoFactorKind, row: TwoFactorRow, code: string | undefined, nowMs = Date.now()) {
  if (!row.twoFactorEnabledAt) return
  if (!code?.trim()) {
    throw new UnauthorizedError("Enter the 6-digit code from your authenticator app", "AUTH_2FA_REQUIRED")
  }
  const secret = decrypt(row.twoFactorSecret)
  const step = secret ? verifyTotp(secret, code, nowMs, row.twoFactorLastStep) : null
  const ok =
    (step !== null && (await useStep(kind, row.id, step))) ||
    (step === null && looksLikeBackupCode(code) && (await useBackupCode(kind, row.id, code)))
  if (!ok) throw new UnauthorizedError("That code isn't right, or was already used", "AUTH_2FA_INVALID")
}

/** Turns two-step sign-in off and forgets the secret and backup codes. */
export const TWO_FACTOR_OFF = {
  twoFactorSecret: null,
  twoFactorEnabledAt: null,
  twoFactorLastStep: null,
  twoFactorBackupCodes: [] as string[],
}

/** After a change to someone's two-step sign-in: the staff rule check is cached with permissions. */
async function changed(kind: TwoFactorKind, id: bigint) {
  if (kind !== "admin") return
  const u = await prisma.adminUser.findUnique({ where: { id }, select: { storeId: true } })
  if (u) await invalidateAdminPermissions(u.storeId, [id])
}

/** Owners resetting someone else's (lost phone): off, and their sessions end. */
export async function resetTwoFactor(kind: TwoFactorKind, id: bigint) {
  await accounts(kind).update({ where: { id }, data: TWO_FACTOR_OFF })
  await markPasswordChanged(kind, id)
  await changed(kind, id)
}

export class TwoFactor {
  constructor(
    private readonly kind: TwoFactorKind,
    private readonly id: bigint,
  ) {}

  private async row() {
    const u = await accounts(this.kind).findUnique({ where: { id: this.id } })
    if (!u) throw new UnauthorizedError("Not signed in", "AUTH_MISSING_TOKEN")
    return u as TwoFactorRow & { email: string; passwordHash: string; storeId?: bigint }
  }

  private async issuer(storeId?: bigint) {
    if (this.kind === "super" || storeId === undefined) return "Platform admin"
    return (await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }))?.name ?? "Store admin"
  }

  // 400, not 401: the session is fine, and a 401 would make the admin refresh it.
  private async checkPassword(password: string) {
    const u = await this.row()
    if (!(await bcrypt.compare(password, u.passwordHash))) {
      throw new BadRequestError("That password isn't right", "AUTH_CREDENTIALS_INVALID")
    }
    return u
  }

  /** New backup codes, and every other session of this person ends. */
  private async freshBackupCodes() {
    const codes = newBackupCodes()
    await accounts(this.kind).update({ where: { id: this.id }, data: { twoFactorBackupCodes: codes.map(hashBackupCode) } })
    await markPasswordChanged(this.kind, this.id)
    return codes
  }

  async status() {
    const u = await this.row()
    return {
      enabled: !!u.twoFactorEnabledAt,
      enabledAt: u.twoFactorEnabledAt?.toISOString() ?? null,
      backupCodesLeft: u.twoFactorEnabledAt ? u.twoFactorBackupCodes.length : 0,
    }
  }

  /** A new secret for the app; two-step sign-in stays off until a code from it is confirmed. */
  async start() {
    const u = await this.row()
    if (u.twoFactorEnabledAt) throw new ConflictError("Two-step sign-in is already on", "CONFLICT")
    const secret = newTotpSecret()
    await accounts(this.kind).update({ where: { id: u.id }, data: { twoFactorSecret: encrypt(secret), twoFactorLastStep: null } })
    const url = otpauthUrl(await this.issuer(u.storeId), u.email, secret)
    return { secret, otpauthUrl: url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) }
  }

  /** The first code from the app proves it's set up: turn it on and hand out the backup codes. */
  async confirm(code: string, nowMs = Date.now()) {
    const u = await this.row()
    if (u.twoFactorEnabledAt) throw new ConflictError("Two-step sign-in is already on", "CONFLICT")
    const secret = decrypt(u.twoFactorSecret)
    if (!secret) throw new BadRequestError("Start the setup first", "VALIDATION_FAILED")
    const step = verifyTotp(secret, code, nowMs)
    if (step === null) throw new BadRequestError("That code isn't right. Check the time on your phone and try the newest code.", "AUTH_2FA_INVALID")
    await accounts(this.kind).update({ where: { id: u.id }, data: { twoFactorEnabledAt: new Date(), twoFactorLastStep: step } })
    const backupCodes = await this.freshBackupCodes()
    await changed(this.kind, this.id)
    return { backupCodes }
  }

  async disable(password: string) {
    await this.checkPassword(password)
    await accounts(this.kind).update({ where: { id: this.id }, data: TWO_FACTOR_OFF })
    await changed(this.kind, this.id)
    return { enabled: false }
  }

  async newBackupCodes(password: string) {
    const u = await this.checkPassword(password)
    if (!u.twoFactorEnabledAt) throw new BadRequestError("Turn on two-step sign-in first", "VALIDATION_FAILED")
    return { backupCodes: await this.freshBackupCodes() }
  }
}

type Req = Request & { ctx: RequestContext }
const CodeDto = z.object({ code: z.string().trim().min(6).max(12) })
const PasswordDto = z.object({ password: z.string().min(1).max(200) })

/** The same routes for staff and for the platform team. */
function twoFactorRouter(kind: TwoFactorKind) {
  const who = (req: Req) => {
    const id = kind === "super" ? req.ctx.super?.id : req.ctx.admin?.id
    if (!id) throw new UnauthorizedError("Not signed in", "AUTH_MISSING_TOKEN")
    return BigInt(id)
  }
  const me = (req: Req) => new TwoFactor(kind, who(req))
  /** Other sessions just ended: this browser gets new tokens so it stays signed in. */
  const keepSignedIn = async (req: Req, res: Response) => {
    const id = who(req)
    const { AuthService } = await import("./auth.service")
    const { setRefreshCookie } = await import("./auth.controller")
    const user =
      kind === "admin"
        ? await prisma.adminUser.findUniqueOrThrow({ where: { id }, include: { role: true } })
        : await prisma.platformAdmin.findUniqueOrThrow({ where: { id } })
    const tokens = await new AuthService(req.ctx).issueTokens(user, kind)
    setRefreshCookie(res, kind, tokens.refreshToken)
    return tokens.accessToken
  }

  const r = Router()
  r.use(authMiddleware(kind))
  r.get("/", ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await me(req).status() })
  }))
  r.post("/start", ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await me(req).start() })
  }))
  r.post(
    "/confirm",
    validate({ body: CodeDto }),
    ctrl(async (req: Req, res: Response) => {
      const out = await me(req).confirm((req.body as z.infer<typeof CodeDto>).code)
      envelope(res, { data: { ...out, accessToken: await keepSignedIn(req, res) }, message: "Two-step sign-in is on" })
    }),
  )
  r.post(
    "/disable",
    validate({ body: PasswordDto }),
    ctrl(async (req: Req, res: Response) => {
      envelope(res, { data: await me(req).disable((req.body as z.infer<typeof PasswordDto>).password), message: "Two-step sign-in is off" })
    }),
  )
  r.post(
    "/backup-codes",
    validate({ body: PasswordDto }),
    ctrl(async (req: Req, res: Response) => {
      const out = await me(req).newBackupCodes((req.body as z.infer<typeof PasswordDto>).password)
      envelope(res, { data: { ...out, accessToken: await keepSignedIn(req, res) } })
    }),
  )
  return r
}

export const adminTwoFactorRouter = twoFactorRouter("admin")
export const superTwoFactorRouter = twoFactorRouter("super")
