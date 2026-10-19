/**
 * Scheduled report emails against a REAL Postgres: saving schedules with their recipient rules,
 * sending due ones with the PDF attached, sending once when runs overlap, switching off after 3
 * failures, and storefront limits. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("scheduled report emails (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let mod: typeof import("../../src/modules/reports/report-schedules.service")
  let storeId: bigint
  let owner: bigint
  let dhakaStaff: bigint
  let leftStaff: bigint
  let dhaka: bigint
  let ctg: bigint
  let asOwner: RequestContext
  let asDhaka: RequestContext
  const suffix = Date.now().toString(36)
  const base = {
    name: "Weekly sales",
    reports: ["sales", "products"] as ("sales" | "products")[],
    frequency: "weekly" as const,
    weekday: 1,
    sendHour: 8,
    period: "last_7_days" as const,
    basis: "placed" as const,
    staffIds: [] as bigint[],
    emails: [] as string[],
  }
  const svc = (ctx: RequestContext) => new mod.ReportSchedulesService(ctx)
  const past = () => new Date(Date.now() - 60_000)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    mod = await import("../../src/modules/reports/report-schedules.service")
    storeId = (await prisma.store.create({ data: { name: "Report Shop", slug: `reports-${suffix}` } })).id
    dhaka = (await prisma.storefront.create({ data: { storeId, name: "Dhaka shop", code: "DHK", isDefault: true } })).id
    ctg = (await prisma.storefront.create({ data: { storeId, name: "Chattogram shop", code: "CTG" } })).id
    const ownerRole = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner", isSystem: true } })
    const staffRole = await prisma.role.create({ data: { storeId, name: "Staff", slug: `staff-${suffix}` } })
    const mk = (name: string, roleId: bigint, storefrontIds: bigint[] = []) =>
      prisma.adminUser.create({ data: { storeId, email: `${name.toLowerCase()}-${suffix}@x.test`, name, passwordHash: "x", roleId, storefrontIds } })
    owner = (await mk("Owner", ownerRole.id)).id
    dhakaStaff = (await mk("Rina", staffRole.id, [dhaka])).id
    leftStaff = (await mk("Karim", staffRole.id)).id
    asOwner = { storeId, requestId: "t", locale: "en", currency: "BDT", admin: { id: owner, role: "ADMIN", permissions: ["*"] } }
    asDhaka = { ...asOwner, admin: { id: dhakaStaff, role: "ADMIN", permissions: ["*"], storefrontIds: [dhaka] } }
    // Two orders three days ago, one per storefront.
    const when = new Date(Date.now() - 3 * 86_400_000)
    for (const [i, sf] of [dhaka, ctg].entries())
      await prisma.order.create({
        data: {
          storeId, storefrontId: sf, number: `R-${suffix}-${i}`, orderKey: `rk-${suffix}-${i}`, itemsSubtotal: 2000 + i * 1000, grandTotal: 2000 + i * 1000, currencyCode: "BDT",
          paymentGatewayCode: "cod", shippingMethodCode: "pickup", shippingMethodName: "Pickup", status: "PROCESSING", createdAt: when,
          billingFirstName: "Sumi", billingLastName: "A", billingCountryCode: "BD", billingAddress1: "x", billingCity: "Dhaka",
          items: { create: [{ productName: "জামদানি শাড়ি", quantity: 1, unitPrice: 2000 + i * 1000, lineSubtotal: 2000 + i * 1000, lineTotal: 2000 + i * 1000, unitCost: 1200 }] },
        },
      })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return
    await prisma.notification.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("makes a report PDF for the dates and storefront asked for", async () => {
    const file = await mod.buildReportPdf(asOwner, { reports: ["sales"], basis: "placed", storefrontId: ctg })
    expect(file.pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(file.storefrontName).toBe("Chattogram shop")
    expect(file.data.sales!.total.orders).toBe(1)
    expect(file.data.sales!.total.netSales).toBe(3000)
    expect(file.filename).toMatch(/^sales-profit-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf$/)
    // Staff limited to Dhaka can't ask for Chattogram.
    await expect(mod.buildReportPdf(asDhaka, { reports: ["sales"], storefrontId: ctg })).rejects.toThrow(/don't work on this storefront/)
    const own = await mod.buildReportPdf(asDhaka, { reports: ["sales"] })
    expect(own.data.sales!.total.orders).toBe(1)
    expect(own.data.sales!.total.netSales).toBe(2000)
  })

  it("checks who it goes to when it's saved", async () => {
    const s = await svc(asOwner).create({ ...base, staffIds: [owner], emails: [" Accountant@Example.com "] })
    expect(s).toMatchObject({ timing: "Every Monday at 08:00", periodLabel: "The 7 days before", emails: ["accountant@example.com"], enabled: true })
    expect(new Date(s.nextRunAt!).getTime()).toBeGreaterThan(Date.now())
    // Rina only works on Dhaka: not for the whole store, fine for Dhaka.
    await expect(svc(asOwner).create({ ...base, staffIds: [dhakaStaff] })).rejects.toThrow(/Rina only works on some storefronts/)
    const forDhaka = await svc(asOwner).create({ ...base, name: "Dhaka daily", frequency: "daily", period: "yesterday", storefrontId: dhaka, staffIds: [dhakaStaff] })
    expect(forDhaka.storefrontName).toBe("Dhaka shop")
    // Rina sees the Dhaka one only, and can't make a whole-store one.
    expect((await svc(asDhaka).list()).map((x) => x.name)).toEqual(["Dhaka daily"])
    await expect(svc(asDhaka).get(BigInt(s.id))).rejects.toThrow(/not found/)
    await expect(svc(asDhaka).create({ ...base, staffIds: [dhakaStaff] })).rejects.toThrow(/Choose one of your storefronts/)
    await expect(svc(asOwner).create({ ...base, staffIds: [], emails: [] })).rejects.toThrow(/Choose who gets it/)
  })

  it("sends due schedules once, with the PDF attached, and moves them on", async () => {
    const s = await svc(asOwner).create({ ...base, name: "Owner pack", staffIds: [owner, leftStaff], emails: ["accountant@example.com"] })
    await prisma.reportSchedule.update({ where: { id: BigInt(s.id) }, data: { nextRunAt: past() } })
    // Two overlapping runs: only one sends it.
    const [a, b] = await Promise.all([mod.ReportSchedulesService.sendDue(), mod.ReportSchedulesService.sendDue()])
    const runs = await prisma.reportRun.findMany({ where: { scheduleId: BigInt(s.id) } })
    expect(runs).toHaveLength(1)
    expect(a.sent + b.sent).toBeGreaterThanOrEqual(1)
    const run = runs[0]!
    expect(run).toMatchObject({ status: "sent", trigger: "schedule" })
    expect(run.recipients.sort()).toEqual([`karim-${suffix}@x.test`, "accountant@example.com", `owner-${suffix}@x.test`].sort())
    expect(Buffer.from(run.pdf!).subarray(0, 5).toString()).toBe("%PDF-")
    const mail = await prisma.notification.findUniqueOrThrow({ where: { id: run.emailLogId! } })
    expect(mail.eventKey).toBe("report_scheduled_admin")
    expect(mail.title).toMatch(/^Owner pack: The 7 days before: /)
    expect(mail.body).toContain("Net sales: ৳5,000")
    const data = mail.data as { reportRunId?: string; status?: string }
    expect(data.reportRunId).toBe(String(run.id))
    expect(data.status).toBe("sent") // sent with the attachment read back from the run
    const after = await svc(asOwner).get(BigInt(s.id))
    expect(after.lastStatus).toBe("sent")
    expect(new Date(after.nextRunAt!).getTime()).toBeGreaterThan(Date.now())
    expect(after.runs[0]).toMatchObject({ status: "sent", hasPdf: true })
    expect((await svc(asOwner).runPdf(BigInt(s.id), run.id)).pdf.length).toBe(run.pdf!.length)
  })

  it("leaves out staff who can no longer see it, and stops after 3 failures", async () => {
    const s = await svc(asOwner).create({ ...base, name: "Karim only", staffIds: [leftStaff] })
    // Karim is now limited to Dhaka, so he can't get the whole store's figures.
    await prisma.adminUser.update({ where: { id: leftStaff }, data: { storefrontIds: [dhaka] } })
    for (let i = 0; i < 3; i++) {
      await prisma.reportSchedule.update({ where: { id: BigInt(s.id) }, data: { nextRunAt: past() } })
      await mod.ReportSchedulesService.sendDue()
    }
    const after = await prisma.reportSchedule.findUniqueOrThrow({ where: { id: BigInt(s.id) } })
    expect(after).toMatchObject({ enabled: false, nextRunAt: null, failures: 3, lastStatus: "failed" })
    expect(after.lastError).toMatch(/Nobody to send it to/)
    const notice = await prisma.staffNotice.findFirst({ where: { storeId, adminId: owner, event: "report_failed" } })
    expect(notice).toMatchObject({ title: "Scheduled report stopped: Karim only", link: `/reports/schedules/${s.id}` })
    // Switching it back on clears the count.
    await prisma.adminUser.update({ where: { id: leftStaff }, data: { storefrontIds: [] } })
    const on = await svc(asOwner).setEnabled(BigInt(s.id), true)
    expect(on).toMatchObject({ enabled: true, failures: 0 })
  })

  it("sends now without moving the next sending, and fails clearly when the email is off", async () => {
    const s = await svc(asOwner).create({ ...base, name: "Now", reports: ["stock", "tax"], staffIds: [owner] })
    const out = await svc(asOwner).sendNow(BigInt(s.id))
    expect(out.runs[0]).toMatchObject({ trigger: "send_now", status: "sent" })
    expect(out.nextRunAt).toBe(s.nextRunAt)
    await prisma.emailTemplate.create({
      data: { storeId, systemKey: "report_scheduled_admin", subject: "x", enabled: false, useDefault: true },
    })
    await expect(svc(asOwner).sendNow(BigInt(s.id))).rejects.toThrow(/switched off in Settings → Emails/)
    const preview = await svc(asOwner).preview(BigInt(s.id))
    expect(preview.filename).toMatch(/^now-/)
  })
})
