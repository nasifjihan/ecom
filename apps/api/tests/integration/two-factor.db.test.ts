/**
 * Staff two-step sign-in against a real Postgres: set up with a code, sign in with a code (once
 * each), backup codes (once each), turn off with the password, and owners resetting it for staff.
 * Runs only when RUN_DB_TESTS=1.
 */
import bcrypt from "bcryptjs"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"
import { totpCode, totpStep } from "../../src/modules/auth/totp"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("two-step sign-in (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let TwoFactor: typeof import("../../src/modules/auth/two-factor").TwoFactor
  let Auth: typeof import("../../src/modules/auth/auth.service").AuthService
  let Team: typeof import("../../src/modules/team/team.service").TeamService
  let AdminLoginDto: typeof import("../../src/modules/auth/auth.dto").AdminLoginDto
  let storeId: bigint | undefined
  let owner: bigint
  let staff: bigint
  const suffix = Date.now().toString(36)
  const PASSWORD = "Test@12345"
  const email = `staff-${suffix}@x.test`

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ TwoFactor } = await import("../../src/modules/auth/two-factor"))
    ;({ AuthService: Auth } = await import("../../src/modules/auth/auth.service"))
    ;({ TeamService: Team } = await import("../../src/modules/team/team.service"))
    ;({ AdminLoginDto } = await import("../../src/modules/auth/auth.dto"))
    storeId = (await prisma.store.create({ data: { name: "Two Step", slug: `twostep-${suffix}` } })).id
    const ownerRole = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner", isSystem: true } })
    const staffRole = await prisma.role.create({ data: { storeId, name: "Staff", slug: "staff" } })
    const passwordHash = await bcrypt.hash(PASSWORD, 4)
    owner = (await prisma.adminUser.create({ data: { storeId, email: `o-${suffix}@x.test`, name: "Owner", passwordHash, roleId: ownerRole.id } })).id
    staff = (await prisma.adminUser.create({ data: { storeId, email, name: "Staff", passwordHash, roleId: staffRole.id } })).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.role.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const ctx = (admin?: { id: bigint; perms: string[] }): RequestContext =>
    ({
      storeId,
      requestId: "t",
      locale: "en",
      currency: "BDT",
      ip: "127.0.0.1",
      ...(admin ? { admin: { id: admin.id, role: "x", permissions: admin.perms } } : {}),
    }) as RequestContext
  // Through the DTO, as the route does.
  const login = (code?: string) =>
    new Auth(ctx()).adminLogin(AdminLoginDto.parse({ email, password: PASSWORD, ...(code !== undefined ? { code } : {}) }), storeId!)
  const codeOf = (secret: string, offset = 0) => totpCode(secret, totpStep(Date.now()) + offset)
  const fails = async (p: Promise<unknown>) => (await p.then(() => null, (e: { code?: string }) => e.code ?? "error"))

  let secret = ""
  let backup: string[] = []

  it("is off at first: the password alone signs in", async () => {
    expect((await login()).user.id).toBe(staff)
    expect(await new TwoFactor("admin", staff).status()).toEqual({ enabled: false, enabledAt: null, backupCodesLeft: 0 })
  })

  it("setup gives a secret and QR, and only a right code turns it on", async () => {
    const s = await new TwoFactor("admin", staff).start()
    secret = s.secret
    expect(s.otpauthUrl).toContain(`otpauth://totp/Two%20Step%3A${encodeURIComponent(email)}?secret=${secret}`)
    expect(s.qr).toMatch(/^data:image\/png;base64,/)
    // Kept encrypted, never as the plain secret.
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff } })
    expect(row.twoFactorSecret).not.toContain(secret)
    // Still off while setting up.
    expect((await login()).user.id).toBe(staff)

    expect(await fails(new TwoFactor("admin", staff).confirm("000000"))).toBe("AUTH_2FA_INVALID")
    const done = await new TwoFactor("admin", staff).confirm(codeOf(secret))
    backup = done.backupCodes
    expect(backup).toHaveLength(10)
    expect((await new TwoFactor("admin", staff).status()).backupCodesLeft).toBe(10)
    expect(await fails(new TwoFactor("admin", staff).start())).toBe("CONFLICT")
  })

  it("then sign-in needs the code, and each code works once", async () => {
    expect(await fails(login())).toBe("AUTH_2FA_REQUIRED")
    expect(await fails(login("123456"))).toBe("AUTH_2FA_INVALID")
    // The setup code was already used (its step is stored; "now" may have moved to the next step).
    const used = (await prisma.adminUser.findUniqueOrThrow({ where: { id: staff } })).twoFactorLastStep!
    expect(await fails(login(totpCode(secret, used)))).toBe("AUTH_2FA_INVALID")
    // The step after it (now, or a phone clock a little ahead) works once.
    expect((await login(totpCode(secret, used + 1))).user.id).toBe(staff)
    expect(await fails(login(totpCode(secret, used + 1)))).toBe("AUTH_2FA_INVALID")
  })

  it("a backup code works once, however it's typed", async () => {
    const typed = backup[0]!.toUpperCase().replace("-", " ")
    expect((await login(typed)).user.id).toBe(staff)
    expect(await fails(login(backup[0]))).toBe("AUTH_2FA_INVALID")
    expect((await new TwoFactor("admin", staff).status()).backupCodesLeft).toBe(9)
    // Two sign-ins with the same backup code at once: only one gets in.
    const both = await Promise.allSettled([login(backup[1]), login(backup[1])])
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1)
  })

  it("a new set of backup codes needs the password and replaces the old ones", async () => {
    expect(await fails(new TwoFactor("admin", staff).newBackupCodes("wrong-password"))).toBe("AUTH_CREDENTIALS_INVALID")
    const fresh = (await new TwoFactor("admin", staff).newBackupCodes(PASSWORD)).backupCodes
    expect(await fails(login(backup[2]))).toBe("AUTH_2FA_INVALID")
    expect((await login(fresh[0])).user.id).toBe(staff)
  })

  it("turning it off needs the password", async () => {
    expect(await fails(new TwoFactor("admin", staff).disable("wrong-password"))).toBe("AUTH_CREDENTIALS_INVALID")
    await new TwoFactor("admin", staff).disable(PASSWORD)
    expect((await login()).user.id).toBe(staff)
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff } })
    expect([row.twoFactorSecret, row.twoFactorEnabledAt, row.twoFactorBackupCodes]).toEqual([null, null, []])
  })

  it("owners reset it for staff; nobody else can, and not for themselves", async () => {
    const s = await new TwoFactor("admin", staff).start()
    await new TwoFactor("admin", staff).confirm(codeOf(s.secret))
    const asStaff = new Team(ctx({ id: owner + 1000n, perms: ["staff.edit"] }))
    expect(await fails(asStaff.resetStaffTwoFactor(staff))).toBe("AUTH_INSUFFICIENT_PERMISSION")
    const asOwner = new Team(ctx({ id: owner, perms: ["*"] }))
    expect(await fails(asOwner.resetStaffTwoFactor(owner))).toBe("VALIDATION_FAILED")
    expect(await asOwner.resetStaffTwoFactor(staff)).toEqual({ id: String(staff), twoFactorOn: false })
    expect((await login()).user.id).toBe(staff)
    const list = await asOwner.listStaff()
    expect(list.find((u) => u.id === String(staff))?.twoFactorOn).toBe(false)
  })

  it("the platform team: set up, then super sign-in needs the code", async () => {
    const SuperLoginDto = (await import("../../src/modules/auth/auth.dto")).SuperLoginDto
    const superEmail = `ops-${suffix}@platform.test`
    const ops = await prisma.platformAdmin.create({ data: { email: superEmail, name: "Ops", passwordHash: await bcrypt.hash(PASSWORD, 4) } })
    try {
      const superLogin = (code?: string) =>
        new Auth(ctx()).superLogin(SuperLoginDto.parse({ email: superEmail, password: PASSWORD, ...(code ? { code } : {}) }))
      const s = await new TwoFactor("super", ops.id).start()
      expect(s.otpauthUrl).toContain("otpauth://totp/Platform%20admin%3A")
      await new TwoFactor("super", ops.id).confirm(codeOf(s.secret))
      expect(await fails(superLogin())).toBe("AUTH_2FA_REQUIRED")
      expect((await superLogin(codeOf(s.secret, 1))).id).toBe(ops.id)
      const { resetTwoFactor } = await import("../../src/modules/auth/two-factor")
      await resetTwoFactor("super", ops.id)
      expect((await superLogin()).id).toBe(ops.id)
    } finally {
      await prisma.platformAdmin.delete({ where: { id: ops.id } })
    }
  })

  it("the store rule: staff without two-step can only reach its setup until they turn it on", async () => {
    const { default: request } = await import("supertest")
    const { buildApp } = await import("../../src/app")
    const app = buildApp()
    const asOwner = new Team(ctx({ id: owner, perms: ["*"] }))
    // The owner can't require it before having it themselves.
    expect(await fails(asOwner.setTwoFactorRule(true))).toBe("VALIDATION_FAILED")
    const o = await new TwoFactor("admin", owner).start()
    await new TwoFactor("admin", owner).confirm(codeOf(o.secret))
    expect(await asOwner.setTwoFactorRule(true)).toMatchObject({ required: true, staffWithout: 1, youHaveIt: true })

    const staffRow = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff }, include: { role: true } })
    const token = (await new Auth(ctx()).issueTokens(staffRow, "admin")).accessToken
    const call = (path: string) =>
      request(app).get(path).set("x-store-id", String(storeId)).set("Authorization", `Bearer ${token}`)
    const blocked = await call("/api/admin/orders")
    expect(blocked.status).toBe(403)
    expect(blocked.body.code).toBe("AUTH_2FA_SETUP_REQUIRED")
    expect((await call("/api/admin/me/two-factor")).status).toBe(200)
    const me = await call("/api/auth/me/admin")
    expect(me.status).toBe(200)
    expect(me.body.data.twoFactorSetupRequired).toBe(true)

    // Once set up, the rule no longer stops them (the cached check is cleared on confirm).
    const s = await new TwoFactor("admin", staff).start()
    await new TwoFactor("admin", staff).confirm(codeOf(s.secret))
    const after = await call("/api/admin/orders")
    expect(after.body.code).not.toBe("AUTH_2FA_SETUP_REQUIRED")
    expect((await call("/api/auth/me/admin")).body.data.twoFactorSetupRequired).toBe(false)

    await asOwner.setTwoFactorRule(false)
    await new TwoFactor("admin", owner).disable(PASSWORD)
    await new TwoFactor("admin", staff).disable(PASSWORD)
  }, 30_000) // builds the whole app the first time

  it("turning it on ends the person's other sessions; the new tokens keep working", async () => {
    const auth = new Auth(ctx())
    const staffRow = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff }, include: { role: true } })
    const other = await auth.issueTokens(staffRow, "admin")
    // Refresh tokens are refused when issued before the change (whole seconds).
    await new Promise((r) => setTimeout(r, 1100))
    const s = await new TwoFactor("admin", staff).start()
    await new TwoFactor("admin", staff).confirm(codeOf(s.secret))
    expect(await fails(auth.validateRefresh(other.refreshToken, "admin"))).toBe("AUTH_EXPIRED_TOKEN")
    const mine = await auth.issueTokens(staffRow, "admin")
    expect((await auth.validateRefresh(mine.refreshToken, "admin")).sub).toBe(String(staff))
    await new TwoFactor("admin", staff).disable(PASSWORD)
  })
})
