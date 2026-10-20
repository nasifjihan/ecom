/**
 * IMPORT & EXPORT JOBS — big exports and product imports run in the background (jobs.queue.ts).
 * A job runs with the permissions and storefronts its creator had when they asked, keeps its file
 * in the row (never in public storage) and tells its creator in the bell when it's done. Finished
 * jobs go after 7 days.
 */
import { hasPermission } from "@ecom/shared-types"
import type { Prisma } from "@prisma/client"
import { logger, prisma } from "../../config"
import { BadRequestError, ForbiddenError, NotFoundError, type RequestContext } from "../../core"
import { ProductImportService } from "../catalog/import/import.service"
import { SHEET_COLUMNS } from "../catalog/import/import.rules"
import { NewsletterService } from "../customers/newsletter.service"
import { CUSTOMER_COLUMNS, ORDER_COLUMNS, customerRows, orderRows, toFile, type CustomerExportFilters, type OrderExportFilters, type SheetFormat } from "./export-sheets"

export const JOB_KINDS = {
  export_orders: { label: "Orders export", permissions: ["orders.view"] },
  export_customers: { label: "Customers export", permissions: ["customers.view"] },
  export_products: { label: "Products export", permissions: ["products.view"] },
  export_newsletter: { label: "Newsletter export", permissions: ["customers.view"] },
  import_products: { label: "Products import", permissions: ["products.create", "products.edit"] },
} as const
export type JobKind = keyof typeof JOB_KINDS
export type ExportKind = Exclude<JobKind, "import_products">

/** Kept for a week after they finish. */
export const KEEP_DAYS = 7

interface Actor {
  storeId: string
  adminId: string | null
  permissions: string[]
  storefrontIds: string[]
  super: boolean
}

const actorOf = (ctx: RequestContext): Actor => ({
  storeId: String(ctx.storeId),
  adminId: ctx.admin ? String(ctx.admin.id) : null,
  permissions: ctx.admin?.permissions ?? [],
  storefrontIds: (ctx.admin?.storefrontIds ?? []).map(String),
  super: !!ctx.super,
})

const ctxOf = (a: Actor): RequestContext => ({
  storeId: BigInt(a.storeId),
  requestId: "data-job",
  locale: "en",
  currency: "BDT",
  ...(a.super ? { super: { id: 0n } } : {}),
  ...(a.adminId ? { admin: { id: BigInt(a.adminId), role: "ADMIN", permissions: a.permissions, storefrontIds: a.storefrontIds.map(BigInt) } } : {}),
})

const may = (ctx: RequestContext, kind: JobKind) => !!ctx.super || JOB_KINDS[kind].permissions.every((p) => hasPermission(ctx.admin?.permissions ?? [], p))

/** Everything about a job but its file and uploaded sheet. */
const VIEW = {
  id: true,
  kind: true,
  status: true,
  params: true,
  progress: true,
  rows: true,
  result: true,
  error: true,
  filename: true,
  inputName: true,
  createdById: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
} satisfies Prisma.DataJobSelect

type JobRow = Prisma.DataJobGetPayload<{ select: typeof VIEW }>

const view = (j: JobRow, names: Map<string, string>) => ({
  ...j,
  id: String(j.id),
  label: JOB_KINDS[j.kind as JobKind]?.label ?? j.kind,
  createdBy: j.createdById ? (names.get(String(j.createdById)) ?? "Staff") : "Platform admin",
  createdById: j.createdById ? String(j.createdById) : null,
  hasFile: !!j.filename && j.status === "done",
  expiresAt: j.finishedAt ? new Date(j.finishedAt.getTime() + KEEP_DAYS * 86_400_000).toISOString() : null,
})

export class DataJobsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private async views(rows: JobRow[]) {
    const ids = [...new Set(rows.flatMap((r) => (r.createdById ? [r.createdById] : [])))]
    const people = ids.length ? await prisma.adminUser.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
    const names = new Map(people.map((p) => [String(p.id), p.name]))
    return rows.map((r) => view(r, names))
  }

  /** The latest jobs of the kinds this person may run. */
  async list() {
    const kinds = (Object.keys(JOB_KINDS) as JobKind[]).filter((k) => may(this.ctx, k))
    const rows = await prisma.dataJob.findMany({ where: { storeId: this.storeId, kind: { in: kinds } }, orderBy: { id: "desc" }, take: 50, select: VIEW })
    return this.views(rows)
  }

  async get(id: bigint) {
    const row = await prisma.dataJob.findFirst({ where: { id, storeId: this.storeId }, select: VIEW })
    if (!row || !may(this.ctx, row.kind as JobKind)) throw new NotFoundError("Job")
    return (await this.views([row]))[0]!
  }

  async file(id: bigint) {
    const row = await prisma.dataJob.findFirst({ where: { id, storeId: this.storeId }, select: { kind: true, status: true, file: true, filename: true, contentType: true } })
    if (!row || !may(this.ctx, row.kind as JobKind)) throw new NotFoundError("Job")
    if (row.status !== "done" || !row.file) throw new NotFoundError("Export file")
    return { buffer: Buffer.from(row.file), filename: row.filename ?? "export", contentType: row.contentType ?? "application/octet-stream" }
  }

  async createExport(kind: ExportKind, params: Record<string, unknown>) {
    if (!may(this.ctx, kind)) throw new ForbiddenError(`You need ${JOB_KINDS[kind].permissions.join(" and ")} for this`, "AUTH_INSUFFICIENT_PERMISSION")
    return this.create(kind, { params: params as Prisma.InputJsonValue })
  }

  async createProductImport(file: { buffer: Buffer; originalname: string }) {
    if (!may(this.ctx, "import_products")) throw new ForbiddenError("You need products.create and products.edit to import", "AUTH_INSUFFICIENT_PERMISSION")
    return this.create("import_products", { input: file.buffer, inputName: file.originalname })
  }

  private async create(kind: JobKind, data: Partial<Prisma.DataJobUncheckedCreateInput>) {
    const job = await prisma.dataJob.create({
      data: { ...data, storeId: this.storeId, kind, actor: actorOf(this.ctx) as unknown as Prisma.InputJsonValue, createdById: this.ctx.admin?.id ?? null },
      select: VIEW,
    })
    const { enqueueDataJob } = await import("./jobs.queue")
    await enqueueDataJob(job.id)
    return (await this.views([job]))[0]!
  }

  // ---------------------------------------------------------------- running

  /** Runs a queued job. Claimed first, so a job never runs twice. Never throws. */
  static async run(id: bigint) {
    const claimed = await prisma.dataJob.updateMany({ where: { id, status: "queued" }, data: { status: "running", startedAt: new Date(), progress: 0 } })
    if (!claimed.count) return
    const job = await prisma.dataJob.findUniqueOrThrow({ where: { id } })
    const ctx = ctxOf(job.actor as unknown as Actor)
    let last = 0
    const progress = async (done: number, total: number) => {
      const pct = total ? Math.min(99, Math.floor((done / total) * 100)) : 99
      if (pct - last < 5) return // a write every 5% is plenty
      last = pct
      await prisma.dataJob.update({ where: { id }, data: { progress: pct } })
    }
    try {
      const out = await DataJobsService.execute(job.kind as JobKind, job.params as Record<string, unknown>, ctx, job.input, job.inputName, progress)
      await prisma.dataJob.update({
        where: { id },
        data: {
          status: "done",
          progress: 100,
          finishedAt: new Date(),
          rows: out.rows,
          input: null, // the uploaded sheet isn't needed any more
          ...(out.file ? { file: out.file.buffer, filename: out.file.filename, contentType: out.file.contentType } : {}),
          ...(out.result ? { result: out.result } : {}),
        },
      })
      await DataJobsService.tell(job, out.file ? `${JOB_KINDS[job.kind as JobKind].label} is ready: ${out.rows} rows` : `${JOB_KINDS[job.kind as JobKind].label} finished: ${out.summary}`)
    } catch (err) {
      const error = (err as Error).message || "The job failed"
      logger.warn({ err: error, jobId: String(id) }, "Data job failed")
      await prisma.dataJob.update({ where: { id }, data: { status: "failed", error, finishedAt: new Date(), input: null } })
      await DataJobsService.tell(job, `${JOB_KINDS[job.kind as JobKind]?.label ?? "Job"} failed: ${error}`)
    }
    await DataJobsService.prune()
  }

  private static async execute(
    kind: JobKind,
    params: Record<string, unknown>,
    ctx: RequestContext,
    input: Uint8Array | null,
    inputName: string | null,
    progress: (done: number, total: number) => Promise<void>,
  ): Promise<{ rows: number; file?: Awaited<ReturnType<typeof toFile>>; result?: unknown; summary?: string }> {
    const format = (params.format === "xlsx" ? "xlsx" : "csv")
    switch (kind) {
      case "export_orders": {
        const rows = await orderRows(ctx, params, progress)
        return { rows: rows.length, file: await toFile(format, "orders", "Orders", ORDER_COLUMNS, rows) }
      }
      case "export_customers": {
        const rows = await customerRows(ctx.storeId!, params, progress)
        return { rows: rows.length, file: await toFile(format, "customers", "Customers", CUSTOMER_COLUMNS, rows) }
      }
      case "export_products": {
        const rows = await new ProductImportService(ctx).exportRows()
        return { rows: rows.length, file: await toFile(format, "products", "Products", SHEET_COLUMNS, rows) }
      }
      case "export_newsletter": {
        const csv = `\uFEFF${await new NewsletterService(ctx.storeId!).csv(params)}`
        const filename = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`
        return { rows: Math.max(0, csv.trim().split("\n").length - 1), file: { buffer: Buffer.from(csv, "utf8"), filename, contentType: "text/csv; charset=utf-8" } }
      }
      case "import_products": {
        if (!input) throw new Error("The uploaded sheet is missing")
        const name = inputName ?? "import.csv"
        const out = await new ProductImportService(ctx).run(
          { buffer: Buffer.from(input), originalname: name, mimetype: name.toLowerCase().endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv" },
          progress,
        )
        const summary = `${out.created} created, ${out.updated} updated, ${out.failed.length} skipped`
        // The list of skipped products, capped so a bad sheet can't make a huge row.
        return { rows: out.created + out.updated, summary, result: { created: out.created, updated: out.updated, failed: out.failed.slice(0, 500), failedCount: out.failed.length } }
      }
    }
  }

  /** A bell message for whoever asked. */
  private static async tell(job: { storeId: bigint; createdById: bigint | null; id: bigint }, title: string) {
    if (!job.createdById) return
    await prisma.staffNotice
      .create({ data: { storeId: job.storeId, adminId: job.createdById, event: "data_job", title, link: "/settings/jobs", refKey: `job:${job.id}` } })
      .catch((err: unknown) => logger.warn({ err: (err as Error).message }, "Job notice not saved"))
  }

  /** Drops finished jobs older than a week (their files go with them). */
  static async prune(now = new Date()) {
    await prisma.dataJob.deleteMany({ where: { finishedAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } } })
  }
}
