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

describe.skipIf(!runDb)("staff two-step sign-in (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let TwoFactor: typeof import("../../src/modules/auth/staff-two-factor").StaffTwoFactor
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
    ;({ StaffTwoFactor: TwoFactor } = await import("../../src/modules/auth/staff-two-factor"))
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
    expect(await new TwoFactor(staff).status()).toEqual({ enabled: false, enabledAt: null, backupCodesLeft: 0 })
  })

  it("setup gives a secret and QR, and only a right code turns it on", async () => {
    const s = await new TwoFactor(staff).start()
    secret = s.secret
    expect(s.otpauthUrl).toContain(`otpauth://totp/Two%20Step%3A${encodeURIComponent(email)}?secret=${secret}`)
    expect(s.qr).toMatch(/^data:image\/png;base64,/)
    // Kept encrypted, never as the plain secret.
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff } })
    expect(row.twoFactorSecret).not.toContain(secret)
    // Still off while setting up.
    expect((await login()).user.id).toBe(staff)

    expect(await fails(new TwoFactor(staff).confirm("000000"))).toBe("AUTH_2FA_INVALID")
    const done = await new TwoFactor(staff).confirm(codeOf(secret))
    backup = done.backupCodes
    expect(backup).toHaveLength(10)
    expect((await new TwoFactor(staff).status()).backupCodesLeft).toBe(10)
    expect(await fails(new TwoFactor(staff).start())).toBe("CONFLICT")
  })

  it("then sign-in needs the code, and each code works once", async () => {
    expect(await fails(login())).toBe("AUTH_2FA_REQUIRED")
    expect(await fails(login("123456"))).toBe("AUTH_2FA_INVALID")
    // The setup code was already used.
    expect(await fails(login(codeOf(secret)))).toBe("AUTH_2FA_INVALID")
    // The next step's code (a phone clock a little ahead) works once.
    expect((await login(codeOf(secret, 1))).user.id).toBe(staff)
    expect(await fails(login(codeOf(secret, 1)))).toBe("AUTH_2FA_INVALID")
  })

  it("a backup code works once, however it's typed", async () => {
    const typed = backup[0]!.toUpperCase().replace("-", " ")
    expect((await login(typed)).user.id).toBe(staff)
    expect(await fails(login(backup[0]))).toBe("AUTH_2FA_INVALID")
    expect((await new TwoFactor(staff).status()).backupCodesLeft).toBe(9)
    // Two sign-ins with the same backup code at once: only one gets in.
    const both = await Promise.allSettled([login(backup[1]), login(backup[1])])
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1)
  })

  it("a new set of backup codes needs the password and replaces the old ones", async () => {
    expect(await fails(new TwoFactor(staff).newBackupCodes("wrong-password"))).toBe("AUTH_CREDENTIALS_INVALID")
    const fresh = (await new TwoFactor(staff).newBackupCodes(PASSWORD)).backupCodes
    expect(await fails(login(backup[2]))).toBe("AUTH_2FA_INVALID")
    expect((await login(fresh[0])).user.id).toBe(staff)
  })

  it("turning it off needs the password", async () => {
    expect(await fails(new TwoFactor(staff).disable("wrong-password"))).toBe("AUTH_CREDENTIALS_INVALID")
    await new TwoFactor(staff).disable(PASSWORD)
    expect((await login()).user.id).toBe(staff)
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff } })
    expect([row.twoFactorSecret, row.twoFactorEnabledAt, row.twoFactorBackupCodes]).toEqual([null, null, []])
  })

  it("owners reset it for staff; nobody else can, and not for themselves", async () => {
    const s = await new TwoFactor(staff).start()
    await new TwoFactor(staff).confirm(codeOf(s.secret))
    const asStaff = new Team(ctx({ id: owner + 1000n, perms: ["staff.edit"] }))
    expect(await fails(asStaff.resetStaffTwoFactor(staff))).toBe("AUTH_INSUFFICIENT_PERMISSION")
    const asOwner = new Team(ctx({ id: owner, perms: ["*"] }))
    expect(await fails(asOwner.resetStaffTwoFactor(owner))).toBe("VALIDATION_FAILED")
    expect(await asOwner.resetStaffTwoFactor(staff)).toEqual({ id: String(staff), twoFactorOn: false })
    expect((await login()).user.id).toBe(staff)
    const list = await asOwner.listStaff()
    expect(list.find((u) => u.id === String(staff))?.twoFactorOn).toBe(false)
  })
})
