/**
 * SCHEDULED REPORT EMAILS — Reports > Scheduled emails, and the PDF behind "Download PDF" on every
 * report page. A schedule picks reports, how often and which days they cover, a storefront (or the
 * whole store) and who gets them: staff members and other addresses. The scheduler
 * (report-schedules.scheduler.ts) sends the ones due; each sending keeps its PDF (ReportRun) so a
 * resent email carries the same file, and the 30 most recent per schedule are kept.
 *
 * Staff limited to some storefronts only get reports for one of theirs, both when the schedule is
 * saved and when it's sent (someone limited later is left out, not sent the whole store).
 */
import type { ReportSchedule } from "@prisma/client"
import { logger, prisma } from "../../config"
import { BadRequestError, ForbiddenError, NotFoundError, type RequestContext } from "../../core"
import { storeBrand, storeUrls } from "../content/store-details"
import { EmailService } from "../notifications/notifications.service"
import { alertStaff } from "../staff-alerts/staff-alerts.service"
import { staffStorefronts } from "../storefronts/storefronts.context"
import { ReportsService } from "./reports.service"
import { dayIn, type ReportBasis } from "./reports.rules"
import { renderReportPdf } from "./report.pdf"
import { buildSection, dayText, summaryLines, type ReportData } from "./report.sections"
import {
  PERIOD_LABELS,
  REPORT_KEYS,
  REPORT_LABELS,
  afterRun,
  cleanEmails,
  nextRunAt,
  periodRange,
  scheduleProblem,
  staffMayReceive,
  timingText,
  type Frequency,
  type Period,
  type ReportKey,
} from "./report-schedule.rules"

/** Sendings kept per schedule, with their PDFs. */
const KEEP_RUNS = 30

export interface ScheduleInput {
  name: string
  reports: ReportKey[]
  frequency: Frequency
  weekday?: number | null
  monthDay?: number | null
  sendHour: number
  period: Period
  basis: ReportBasis
  storefrontId?: bigint | null
  staffIds: bigint[]
  emails: string[]
  enabled?: boolean
}

export interface PdfRequest {
  reports: ReportKey[]
  from?: string
  to?: string
  basis?: ReportBasis
  storefrontId?: bigint | null
  /** Heading; defaults to the report's name. */
  title?: string
}

async function storeTz(storeId: bigint): Promise<string> {
  const s = await prisma.storeGeneralSetting.findUnique({ where: { storeId }, select: { timezone: true } })
  const tz = s?.timezone ?? "Asia/Dhaka"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return tz
  } catch {
    return "Asia/Dhaka"
  }
}

const madeAtText = (now: Date, tz: string) =>
  `Made ${now.toLocaleString("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} (${tz})`

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "report"

/**
 * One PDF of the reports asked for, made as the request's staff member sees them (their
 * storefronts only). Also returns the figures, for the email's summary.
 */
export async function buildReportPdf(ctx: RequestContext, req: PdfRequest) {
  if (ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  const storeId = ctx.storeId
  const reports = REPORT_KEYS.filter((k) => req.reports.includes(k))
  if (!reports.length) throw new BadRequestError("Choose at least one report", "VALIDATION_FAILED")
  const q = { from: req.from, to: req.to, basis: req.basis, ...(req.storefrontId ? { storefrontId: req.storefrontId } : {}) }
  const data: Partial<ReportData> = {}
  // One service per report: each keeps the storefronts it was asked for.
  for (const k of reports) {
    const s = new ReportsService(ctx)
    ;(data as Record<string, unknown>)[k] = k === "stock" ? await s.stock() : await s[k](q)
  }
  const [{ brand }, tz, front] = await Promise.all([
    storeBrand(storeId),
    storeTz(storeId),
    req.storefrontId ? prisma.storefront.findFirst({ where: { id: req.storefrontId, storeId }, select: { name: true } }) : null,
  ])
  // Every ranged report resolved the same dates; read them off the first.
  const ranged = reports.find((k) => k !== "stock")
  const head = ranged ? (data[ranged] as { from: string; to: string }) : null
  const usesBasis = reports.some((k) => ["sales", "products", "discounts", "customers", "tax"].includes(k))
  const details = [
    head ? (head.from === head.to ? dayText(head.from) : `${dayText(head.from)} – ${dayText(head.to)}`) : "Stock on hand today",
    ...(usesBasis ? [req.basis === "delivered" ? "Delivered orders only" : "All placed orders (not cancelled or failed)"] : []),
    front ? `Storefront: ${front.name}` : "",
  ].filter(Boolean)
  const title = req.title ?? (reports.length === 1 ? REPORT_LABELS[reports[0]!] : "Reports")
  const now = new Date()
  const pdf = await renderReportPdf({
    storeName: brand.storeName,
    title,
    details,
    madeAt: madeAtText(now, tz),
    sections: reports.map((k) => buildSection(k, data[k] as never)),
  })
  const stamp = head ? (head.from === head.to ? head.from : `${head.from}_${head.to}`) : dayIn(tz, now)
  return { pdf, filename: `${slug(title)}-${stamp}.pdf`, data, range: head, details, title, reports, storefrontName: front?.name ?? null }
}

export class ReportSchedulesService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private async row(id: bigint) {
    const r = await prisma.reportSchedule.findFirst({ where: { id, storeId: this.storeId } })
    if (!r) throw new NotFoundError("Report schedule")
    // Staff limited to storefronts only see schedules for theirs.
    const mine = staffStorefronts(this.ctx)
    if (mine && (r.storefrontId === null || !mine.includes(r.storefrontId))) throw new NotFoundError("Report schedule")
    return r
  }

  private view(r: ReportSchedule, names: Map<string, string>, staff: Map<string, { name: string; email: string }>) {
    return {
      id: String(r.id),
      name: r.name,
      reports: r.reports,
      reportLabels: r.reports.map((k) => REPORT_LABELS[k as ReportKey] ?? k),
      frequency: r.frequency,
      weekday: r.weekday,
      monthDay: r.monthDay,
      sendHour: r.sendHour,
      timing: timingText({ frequency: r.frequency as Frequency, weekday: r.weekday, monthDay: r.monthDay, sendHour: r.sendHour }),
      period: r.period,
      periodLabel: PERIOD_LABELS[r.period as Period] ?? r.period,
      basis: r.basis,
      storefrontId: r.storefrontId === null ? null : String(r.storefrontId),
      storefrontName: r.storefrontId === null ? null : (names.get(String(r.storefrontId)) ?? null),
      staffIds: r.staffIds.map(String),
      staff: r.staffIds.map((id) => ({ id: String(id), ...(staff.get(String(id)) ?? { name: "Removed staff member", email: "" }) })),
      emails: r.emails,
      enabled: r.enabled,
      nextRunAt: r.enabled ? (r.nextRunAt?.toISOString() ?? null) : null,
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
      lastStatus: r.lastStatus,
      lastError: r.lastError,
      failures: r.failures,
      createdAt: r.createdAt.toISOString(),
    }
  }

  private async views(rows: ReportSchedule[]) {
    const [fronts, people] = await Promise.all([
      prisma.storefront.findMany({ where: { storeId: this.storeId }, select: { id: true, name: true } }),
      prisma.adminUser.findMany({
        where: { storeId: this.storeId, id: { in: [...new Set(rows.flatMap((r) => r.staffIds))] } },
        select: { id: true, name: true, email: true },
      }),
    ])
    const names = new Map(fronts.map((f) => [String(f.id), f.name]))
    const staff = new Map(people.map((p) => [String(p.id), { name: p.name || p.email, email: p.email }]))
    return rows.map((r) => this.view(r, names, staff))
  }

  /** Who can be chosen: active staff, with the storefronts they're limited to. */
  async options() {
    const people = await prisma.adminUser.findMany({
      where: { storeId: this.storeId, status: "active" },
      select: { id: true, name: true, email: true, storefrontIds: true, role: { select: { name: true } } },
      orderBy: { name: "asc" },
    })
    return {
      people: people.map((p) => ({ id: String(p.id), name: p.name || p.email, email: p.email, role: p.role.name, storefrontIds: p.storefrontIds.map(String) })),
      /** Set when this staff member only sees some storefronts: a schedule must be for one of them. */
      myStorefrontIds: staffStorefronts(this.ctx)?.map(String) ?? null,
    }
  }

  async list() {
    const mine = staffStorefronts(this.ctx)
    const rows = await prisma.reportSchedule.findMany({
      where: { storeId: this.storeId, ...(mine ? { storefrontId: { in: mine } } : {}) },
      orderBy: [{ enabled: "desc" }, { name: "asc" }, { id: "asc" }],
    })
    return this.views(rows)
  }

  async get(id: bigint) {
    const r = await this.row(id)
    const [view] = await this.views([r])
    const runs = await prisma.reportRun.findMany({
      where: { scheduleId: r.id },
      orderBy: { id: "desc" },
      take: KEEP_RUNS,
      select: { id: true, fromDay: true, toDay: true, trigger: true, status: true, error: true, recipients: true, emailLogId: true, filename: true, createdAt: true },
    })
    return {
      ...view!,
      runs: runs.map((x) => ({
        id: String(x.id),
        from: x.fromDay,
        to: x.toDay,
        trigger: x.trigger,
        status: x.status,
        error: x.error,
        recipients: x.recipients,
        emailLogId: x.emailLogId === null ? null : String(x.emailLogId),
        hasPdf: !!x.filename,
        createdAt: x.createdAt.toISOString(),
      })),
    }
  }

  /** Checks the input and who it goes to; returns what to save. */
  private async clean(input: ScheduleInput) {
    const emails = cleanEmails(input.emails)
    const staffIds = [...new Set(input.staffIds.map(String))].map(BigInt)
    const problem = scheduleProblem({ ...input, emails, staffIds })
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
    const storefrontId = input.storefrontId ?? null
    const mine = staffStorefronts(this.ctx)
    if (mine) {
      if (storefrontId === null) throw new ForbiddenError("Choose one of your storefronts: you don't see the whole store's figures", "AUTH_FORBIDDEN")
      if (!mine.includes(storefrontId)) throw new ForbiddenError("You don't work on this storefront", "AUTH_FORBIDDEN")
    }
    if (storefrontId !== null && !(await prisma.storefront.count({ where: { id: storefrontId, storeId: this.storeId } })))
      throw new BadRequestError("That storefront isn't in this store", "VALIDATION_FAILED")
    if (staffIds.length) {
      const people = await prisma.adminUser.findMany({
        where: { storeId: this.storeId, id: { in: staffIds }, status: "active" },
        select: { id: true, name: true, email: true, storefrontIds: true },
      })
      if (people.length !== staffIds.length) throw new BadRequestError("Pick people from your team", "VALIDATION_FAILED")
      const out = people.filter((p) => !staffMayReceive(p.storefrontIds, storefrontId))
      if (out.length)
        throw new BadRequestError(
          `${out.map((p) => p.name || p.email).join(", ")} only work${out.length === 1 ? "s" : ""} on some storefronts, so can only get reports for one of theirs`,
          "VALIDATION_FAILED",
        )
    }
    const tz = await storeTz(this.storeId)
    const timing = {
      frequency: input.frequency,
      weekday: input.frequency === "weekly" ? input.weekday! : null,
      monthDay: input.frequency === "monthly" ? input.monthDay! : null,
      sendHour: input.sendHour,
    }
    const enabled = input.enabled ?? true
    return {
      name: input.name.trim(),
      reports: REPORT_KEYS.filter((k) => input.reports.includes(k)),
      ...timing,
      period: input.period,
      basis: input.basis,
      storefrontId,
      staffIds,
      emails,
      enabled,
      nextRunAt: enabled ? nextRunAt(timing, new Date(), tz) : null,
    }
  }

  async create(input: ScheduleInput) {
    const data = await this.clean(input)
    const r = await prisma.reportSchedule.create({ data: { ...data, storeId: this.storeId, createdById: this.ctx.admin?.id ?? null } })
    return this.get(r.id)
  }

  async update(id: bigint, input: ScheduleInput) {
    await this.row(id)
    const data = await this.clean(input)
    await prisma.reportSchedule.update({ where: { id }, data: { ...data, ...(data.enabled ? { failures: 0 } : {}) } })
    return this.get(id)
  }

  /** Switches a schedule on (from the next sending time) or off. */
  async setEnabled(id: bigint, enabled: boolean) {
    const r = await this.row(id)
    const tz = await storeTz(this.storeId)
    const timing = { frequency: r.frequency as Frequency, weekday: r.weekday, monthDay: r.monthDay, sendHour: r.sendHour }
    await prisma.reportSchedule.update({
      where: { id },
      data: { enabled, nextRunAt: enabled ? nextRunAt(timing, new Date(), tz) : null, ...(enabled ? { failures: 0 } : {}) },
    })
    return this.get(id)
  }

  async remove(id: bigint) {
    await this.row(id)
    await prisma.reportSchedule.delete({ where: { id } })
    return { id: String(id) }
  }

  /** Sends it now, for the period it would cover today. Doesn't move the next sending. */
  async sendNow(id: bigint) {
    const r = await this.row(id)
    const out = await ReportSchedulesService.run(r, "send_now")
    if (!out.ok) throw new BadRequestError(out.error ?? "The report couldn't be sent", "VALIDATION_FAILED")
    return this.get(id)
  }

  /** The PDF it would send now, without sending it. */
  async preview(id: bigint) {
    const r = await this.row(id)
    const tz = await storeTz(this.storeId)
    const range = periodRange(r.period as Period, dayIn(tz, new Date()))
    const file = await buildReportPdf(ReportSchedulesService.ctxFor(r), {
      reports: r.reports as ReportKey[],
      ...range,
      basis: r.basis as ReportBasis,
      storefrontId: r.storefrontId,
      title: r.name,
    })
    return { filename: file.filename, pdf: file.pdf }
  }

  /** A PDF that went out. */
  async runPdf(id: bigint, runId: bigint) {
    await this.row(id)
    const run = await prisma.reportRun.findFirst({ where: { id: runId, scheduleId: id, storeId: this.storeId } })
    if (!run?.pdf) throw new NotFoundError("Report PDF")
    return { filename: run.filename ?? "report.pdf", pdf: Buffer.from(run.pdf) }
  }

  // ---------------------------------------------------------------- sending

  /** What the scheduled job sees: the whole store, or the schedule's storefront. */
  private static ctxFor(r: ReportSchedule): RequestContext {
    return { storeId: r.storeId, requestId: `report-schedule-${r.id}`, locale: "en", currency: "BDT" }
  }

  /** Who gets it now: active staff chosen (who may see its storefront), and the other addresses. */
  static async recipients(r: ReportSchedule): Promise<string[]> {
    const people = r.staffIds.length
      ? await prisma.adminUser.findMany({
          where: { storeId: r.storeId, id: { in: r.staffIds }, status: "active" },
          select: { email: true, storefrontIds: true },
        })
      : []
    const staff = people.filter((p) => staffMayReceive(p.storefrontIds, r.storefrontId)).map((p) => p.email)
    return cleanEmails([...staff, ...r.emails])
  }

  /** Builds the PDF and emails it. Records the sending, and on schedules counts failures. */
  static async run(r: ReportSchedule, trigger: "schedule" | "send_now", now = new Date()) {
    const tz = await storeTz(r.storeId)
    const range = periodRange(r.period as Period, dayIn(tz, now))
    let runId: bigint | null = null
    let error: string | null = null
    let to: string[] = []
    try {
      to = await ReportSchedulesService.recipients(r)
      if (!to.length) throw new Error("Nobody to send it to: the staff chosen are no longer active, or can't see this storefront")
      const file = await buildReportPdf(ReportSchedulesService.ctxFor(r), {
        reports: r.reports as ReportKey[],
        ...range,
        basis: r.basis as ReportBasis,
        storefrontId: r.storefrontId,
        title: r.name,
      })
      const run = await prisma.reportRun.create({
        data: { storeId: r.storeId, scheduleId: r.id, fromDay: range.from, toDay: range.to, trigger, status: "sent", filename: file.filename, pdf: file.pdf, recipients: to },
      })
      runId = run.id
      const urls = await storeUrls(r.storeId)
      const period = range.from === range.to ? dayText(range.from) : `${dayText(range.from)} – ${dayText(range.to)}`
      const filters = [
        file.reports.some((k) => k !== "stock" && k !== "couriers" && k !== "returns") ? (r.basis === "delivered" ? "delivered orders only" : "all placed orders") : "",
        file.storefrontName ? `storefront ${file.storefrontName}` : "",
      ].filter(Boolean)
      const lines = summaryLines(file.data)
      const logId = await new EmailService(r.storeId).scheduledReport(
        to,
        {
          "report.name": r.name,
          "report.period": `${PERIOD_LABELS[r.period as Period] ?? ""}: ${period}`,
          "report.filters": filters.length ? `, ${filters.join(", ")}` : "",
          "report.summary": lines.length ? lines.join("\n") : "Here are your reports.",
          "report.list": file.reports.map((k) => REPORT_LABELS[k]).join(", "),
          "report.admin_url": `${urls.admin}/reports/schedules/${r.id}`,
        },
        run.id,
      )
      if (!logId) throw new Error('The "Scheduled report" email is switched off in Settings → Emails')
      await prisma.reportRun.update({ where: { id: run.id }, data: { emailLogId: logId } })
    } catch (err) {
      error = (err as Error).message || "The report couldn't be made"
      logger.warn({ err: error, scheduleId: String(r.id) }, "Scheduled report failed")
      if (runId) await prisma.reportRun.update({ where: { id: runId }, data: { status: "failed", error } })
      else
        await prisma.reportRun.create({
          data: { storeId: r.storeId, scheduleId: r.id, fromDay: range.from, toDay: range.to, trigger, status: "failed", error, recipients: to },
        })
    }

    const ok = error === null
    const next = trigger === "schedule" ? afterRun(r.failures, ok) : { failures: ok ? 0 : r.failures, disable: false }
    await prisma.reportSchedule.update({
      where: { id: r.id },
      data: {
        lastRunAt: now,
        lastStatus: ok ? "sent" : "failed",
        lastError: error,
        failures: next.failures,
        ...(next.disable ? { enabled: false, nextRunAt: null } : {}),
      },
    })
    if (next.disable)
      await alertStaff(r.storeId, "report_failed", {
        title: `Scheduled report stopped: ${r.name}`,
        body: `It failed ${next.failures} times in a row and was switched off. Last error: ${error}`,
        link: `/reports/schedules/${r.id}`,
      })
    await ReportSchedulesService.prune(r.id)
    return { ok, error }
  }

  /** Keeps the latest sendings of a schedule; older ones (and their PDFs) go. */
  private static async prune(scheduleId: bigint) {
    const old = await prisma.reportRun.findMany({ where: { scheduleId }, orderBy: { id: "desc" }, skip: KEEP_RUNS, select: { id: true } })
    if (old.length) await prisma.reportRun.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
  }

  /**
   * Sends every schedule that's due. Each is claimed by moving its nextRunAt on first, so two
   * workers (or an overlapping run) never send the same one twice.
   */
  static async sendDue(now = new Date()) {
    const due = await prisma.reportSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" }, take: 100 })
    let sent = 0
    let failed = 0
    for (const r of due) {
      const tz = await storeTz(r.storeId)
      const timing = { frequency: r.frequency as Frequency, weekday: r.weekday, monthDay: r.monthDay, sendHour: r.sendHour }
      const claimed = await prisma.reportSchedule.updateMany({
        where: { id: r.id, enabled: true, nextRunAt: r.nextRunAt },
        data: { nextRunAt: nextRunAt(timing, now, tz) },
      })
      if (!claimed.count) continue
      const out = await ReportSchedulesService.run(r, "schedule", now)
      if (out.ok) sent++
      else failed++
    }
    return { due: due.length, sent, failed }
  }
}

export type ScheduleView = Awaited<ReturnType<ReportSchedulesService["get"]>>
