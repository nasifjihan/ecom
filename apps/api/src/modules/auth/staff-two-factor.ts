/**
 * STAFF TWO-STEP SIGN-IN — an authenticator app code after the password.
 *   GET  /api/admin/me/two-factor          { enabled, enabledAt, backupCodesLeft }
 *   POST /api/admin/me/two-factor/start    → { secret, otpauthUrl, qr } (a new secret, not on yet)
 *   POST /api/admin/me/two-factor/confirm  { code } → { backupCodes } (on; the 10 codes shown once)
 *   POST /api/admin/me/two-factor/disable  { password }
 *   POST /api/admin/me/two-factor/backup-codes { password } → { backupCodes } (new set, old ones stop working)
 * Owners reset it for a staff member who lost their phone: POST /api/admin/staff/:id/two-factor/reset.
 * At sign-in, `checkSignInCode` takes either a 6-digit code (each works once) or a backup code
 * (each works once). The secret is kept encrypted, backup codes only as hashes.
 */
import type { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import QRCode from "qrcode"
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { decrypt, encrypt, prisma } from "../../config"
import { BadRequestError, ConflictError, UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, validate } from "../../middleware"
import {
  hashBackupCode,
  looksLikeBackupCode,
  newBackupCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
} from "./totp"

interface TwoFactorRow {
  id: bigint
  twoFactorSecret: string | null
  twoFactorEnabledAt: Date | null
  twoFactorLastStep: number | null
  twoFactorBackupCodes: string[]
}

/** Uses a TOTP code once: only the first request with a step after the last one wins. */
async function useStep(id: bigint, step: number): Promise<boolean> {
  const r = await prisma.adminUser.updateMany({
    where: { id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
    data: { twoFactorLastStep: step },
  })
  return r.count === 1
}

/** Uses a backup code once (removed in the same statement that checks it). */
async function useBackupCode(id: bigint, code: string): Promise<boolean> {
  const hash = hashBackupCode(code)
  const n = await prisma.$executeRaw`
    UPDATE "AdminUser" SET "twoFactorBackupCodes" = array_remove("twoFactorBackupCodes", ${hash})
    WHERE id = ${id} AND ${hash} = ANY("twoFactorBackupCodes")`
  return n === 1
}

/** After a right password: nothing to do when two-step sign-in is off, else the code must be right. */
export async function checkSignInCode(row: TwoFactorRow, code: string | undefined, nowMs = Date.now()) {
  if (!row.twoFactorEnabledAt) return
  if (!code?.trim()) {
    throw new UnauthorizedError("Enter the 6-digit code from your authenticator app", "AUTH_2FA_REQUIRED")
  }
  const secret = decrypt(row.twoFactorSecret)
  const step = secret ? verifyTotp(secret, code, nowMs, row.twoFactorLastStep) : null
  const ok =
    (step !== null && (await useStep(row.id, step))) ||
    (step === null && looksLikeBackupCode(code) && (await useBackupCode(row.id, code)))
  if (!ok) throw new UnauthorizedError("That code isn't right, or was already used", "AUTH_2FA_INVALID")
}

/** Turns two-step sign-in off and forgets the secret and backup codes. */
export const TWO_FACTOR_OFF: Prisma.AdminUserUpdateInput = {
  twoFactorSecret: null,
  twoFactorEnabledAt: null,
  twoFactorLastStep: null,
  twoFactorBackupCodes: [],
}

export class StaffTwoFactor {
  constructor(private readonly adminId: bigint) {}

  private async row() {
    const u = await prisma.adminUser.findUnique({
      where: { id: this.adminId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        twoFactorSecret: true,
        twoFactorEnabledAt: true,
        twoFactorLastStep: true,
        twoFactorBackupCodes: true,
        store: { select: { name: true } },
      },
    })
    if (!u) throw new UnauthorizedError("Staff only", "AUTH_MISSING_TOKEN")
    return u
  }

  private async checkPassword(password: string) {
    const u = await this.row()
    // 400, not 401: the session is fine, and a 401 would make the admin refresh it.
    if (!(await bcrypt.compare(password, u.passwordHash))) {
      throw new BadRequestError("That password isn't right", "AUTH_CREDENTIALS_INVALID")
    }
    return u
  }

  private async freshBackupCodes() {
    const codes = newBackupCodes()
    await prisma.adminUser.update({
      where: { id: this.adminId },
      data: { twoFactorBackupCodes: codes.map(hashBackupCode) },
    })
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
    await prisma.adminUser.update({ where: { id: u.id }, data: { twoFactorSecret: encrypt(secret), twoFactorLastStep: null } })
    const url = otpauthUrl(u.store.name, u.email, secret)
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
    await prisma.adminUser.update({ where: { id: u.id }, data: { twoFactorEnabledAt: new Date(), twoFactorLastStep: step } })
    return { backupCodes: await this.freshBackupCodes() }
  }

  async disable(password: string) {
    await this.checkPassword(password)
    await prisma.adminUser.update({ where: { id: this.adminId }, data: TWO_FACTOR_OFF })
    return { enabled: false }
  }

  async newBackupCodes(password: string) {
    const u = await this.checkPassword(password)
    if (!u.twoFactorEnabledAt) throw new BadRequestError("Turn on two-step sign-in first", "VALIDATION_FAILED")
    return { backupCodes: await this.freshBackupCodes() }
  }
}

type Req = Request & { ctx: RequestContext }
const me = (req: Req) => {
  const id = req.ctx.admin?.id
  if (!id) throw new UnauthorizedError("Staff only", "AUTH_MISSING_TOKEN")
  return new StaffTwoFactor(BigInt(id))
}
const CodeDto = z.object({ code: z.string().trim().min(6).max(12) })
const PasswordDto = z.object({ password: z.string().min(1).max(200) })

export const adminTwoFactorRouter = Router()
adminTwoFactorRouter.use(authMiddleware("admin"))
adminTwoFactorRouter.get("/", ctrl(async (req: Req, res: Response) => {
  envelope(res, { data: await me(req).status() })
}))
adminTwoFactorRouter.post("/start", ctrl(async (req: Req, res: Response) => {
  envelope(res, { data: await me(req).start() })
}))
adminTwoFactorRouter.post(
  "/confirm",
  validate({ body: CodeDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await me(req).confirm((req.body as z.infer<typeof CodeDto>).code), message: "Two-step sign-in is on" })
  }),
)
adminTwoFactorRouter.post(
  "/disable",
  validate({ body: PasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await me(req).disable((req.body as z.infer<typeof PasswordDto>).password), message: "Two-step sign-in is off" })
  }),
)
adminTwoFactorRouter.post(
  "/backup-codes",
  validate({ body: PasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await me(req).newBackupCodes((req.body as z.infer<typeof PasswordDto>).password) })
  }),
)
