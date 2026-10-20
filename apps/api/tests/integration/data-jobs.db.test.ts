/**
 * Import & export jobs against a REAL Postgres: exports run with the creator's permissions and
 * storefronts, files are real CSV / Excel with spreadsheet-safe cells, product imports report what
 * they did, and old jobs are cleaned up. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("import & export jobs (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Jobs: typeof import("../../src/modules/jobs/jobs.service").DataJobsService
  let storeId: bigint
  let owner: bigint
  let dhaka: bigint
  let ctg: bigint
  let asOwner: RequestContext
  let asDhaka: RequestContext
  let asViewer: RequestContext
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ DataJobsService: Jobs } = await import("../../src/modules/jobs/jobs.service"))
    storeId = (await prisma.store.create({ data: { name: "Jobs Shop", slug: `jobs-${suffix}` } })).id
    dhaka = (await prisma.storefront.create({ data: { storeId, name: "Dhaka", code: "DHK", isDefault: true } })).id
    ctg = (await prisma.storefront.create({ data: { storeId, name: "Ctg", code: "CTG" } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner", isSystem: true } })
    owner = (await prisma.adminUser.create({ data: { storeId, email: `o-${suffix}@x.test`, name: "Owner", passwordHash: "x", roleId: role.id } })).id
    asOwner = { storeId, requestId: "t", locale: "en", currency: "BDT", admin: { id: owner, role: "ADMIN", permissions: ["*"] } }
    asDhaka = { ...asOwner, admin: { id: owner, role: "ADMIN", permissions: ["orders.view"], storefrontIds: [dhaka] } }
    asViewer = { ...asOwner, admin: { id: owner, role: "ADMIN", permissions: ["products.view"] } }
    const order = (n: number, sf: bigint, first: string) =>
      prisma.order.create({
        data: {
          storeId, storefrontId: sf, number: `J-${suffix}-${n}`, orderKey: `jk-${suffix}-${n}`, itemsSubtotal: 1000 * n, grandTotal: 1000 * n, currencyCode: "BDT",
          paymentGatewayCode: "cod", shippingMethodCode: "pickup", shippingMethodName: "Pickup", status: "PROCESSING",
          billingFirstName: first, billingLastName: "Akter", billingPhone: "01711000000", billingCountryCode: "BD", billingAddress1: "x", billingCity: "Dhaka",
        },
      })
    await order(1, dhaka, "Shirin")
    await order(2, ctg, "=HYPERLINK(\"http://evil\")") // a name that would run as a formula
    await prisma.customer.create({ data: { storeId, firstName: "+Rahim", lastName: "Uddin", phone: "01722000000", email: `r-${suffix}@x.test` } })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const runAndRead = async (id: string) => {
    await Jobs.run(BigInt(id))
    return prisma.dataJob.findUniqueOrThrow({ where: { id: BigInt(id) } })
  }

  it("exports orders as a real CSV, safe for spreadsheets, and tells the creator", async () => {
    const job = await new Jobs(asOwner).createExport("export_orders", { format: "csv" })
    expect(job).toMatchObject({ status: "queued", label: "Orders export", createdBy: "Owner" })
    const done = await runAndRead(job.id)
    expect(done).toMatchObject({ status: "done", progress: 100, rows: 2 })
    const csv = Buffer.from(done.file!).toString("utf8")
    expect(csv.split("\r\n")[0]).toContain("Order,Date,Status,Payment")
    expect(csv).toContain(`J-${suffix}-1,`)
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"") Akter"`) // starts with ' so it stays text
    const notice = await prisma.staffNotice.findFirst({ where: { storeId, adminId: owner, event: "data_job" } })
    expect(notice?.title).toBe("Orders export is ready: 2 rows")
    const file = await new Jobs(asOwner).file(BigInt(job.id))
    expect(file.filename).toMatch(/^orders.*\.csv$/)
  })

  it("runs with the creator's storefronts and permissions", async () => {
    const job = await new Jobs(asDhaka).createExport("export_orders", { format: "xlsx" })
    const done = await runAndRead(job.id)
    expect(done.rows).toBe(1) // only the Dhaka order
    expect(Buffer.from(done.file!).subarray(0, 2).toString()).toBe("PK") // an .xlsx is a zip
    await expect(new Jobs(asViewer).createExport("export_customers", {})).rejects.toThrow(/customers.view/)
    // Someone without orders.view doesn't see order jobs, or their files.
    expect((await new Jobs(asViewer).list()).some((j) => j.kind === "export_orders")).toBe(false)
    await expect(new Jobs(asViewer).file(BigInt(job.id))).rejects.toThrow(/not found/)
  })

  it("exports customers, and the instant customer export gives the same real file", async () => {
    const done = await runAndRead((await new Jobs(asOwner).createExport("export_customers", { format: "csv" })).id)
    expect(done.rows).toBe(1)
    expect(Buffer.from(done.file!).toString("utf8")).toContain("'+Rahim Uddin")
    const { CustomersService } = await import("../../src/modules/customers/customers.service")
    const instant = await new CustomersService(asOwner).generateCustomersExport({ format: "csv" } as never)
    expect(Buffer.from(instant.buffer).toString("utf8")).toContain("'+Rahim Uddin")
    await expect(new CustomersService(asOwner).generateCustomersExport({ format: "pdf" } as never)).rejects.toThrow(/CSV or Excel/)
  })

  it("imports products in the background and reports what it did", async () => {
    const sheet = "product_sku,name,price,stock\nJOB-1,Cotton Panjabi,2500,10\nJOB-2,,100,1\n"
    const job = await new Jobs(asOwner).createProductImport({ buffer: Buffer.from(sheet, "utf8"), originalname: "products.csv" })
    const done = await runAndRead(job.id)
    expect(done.status).toBe("done")
    expect(done.input).toBeNull() // the sheet isn't kept after the run
    expect(done.result).toMatchObject({ created: 1, updated: 0, failedCount: 1 })
    expect(await prisma.product.count({ where: { storeId, sku: "JOB-1" } })).toBe(1)
    // Running a finished job again does nothing.
    await Jobs.run(BigInt(job.id))
    expect(await prisma.product.count({ where: { storeId, sku: "JOB-1" } })).toBe(1)
  })

  it("removes finished jobs after a week", async () => {
    const old = await prisma.dataJob.create({ data: { storeId, kind: "export_orders", status: "done", actor: {}, finishedAt: new Date(Date.now() - 8 * 86_400_000) } })
    await Jobs.prune()
    expect(await prisma.dataJob.findUnique({ where: { id: old.id } })).toBeNull()
  })
})
