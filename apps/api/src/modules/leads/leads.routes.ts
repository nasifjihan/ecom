/**
 * CRM LEADS (permission area "leads"): /api/admin/leads
 *   GET /            list (?status=open|new|…, owner=me|none|id, due=overdue|today, tag, search) with counts
 *   GET /tags, GET /owners
 *   POST /           add       GET /:id   one, with its timeline
 *   PATCH /:id       edit      DELETE /:id
 *   POST /:id/status {status, reason?}   POST /:id/notes {kind, body, nextFollowUpAt?}
 *   POST /:id/customer   link to (or make) their customer record
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { LEAD_CHANNELS, LEAD_STATUSES, NOTE_KINDS } from "./leads.rules"
import { LeadsService, type LeadQuery } from "./leads.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new LeadsService(req.ctx)
const idOf = (req: Req) => BigInt((req.params as { id: string }).id)

const text = (max: number) => z.string().trim().max(max)
const when = z.coerce.date().nullable().optional()
const LeadBody = z.object({
  name: text(120).min(2, "Enter their name"),
  phone: text(30).nullable().optional(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(254)]).nullable().optional(),
  channel: z.enum(LEAD_CHANNELS).default("facebook"),
  handle: text(300).nullable().optional(),
  interest: text(1000).nullable().optional(),
  value: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  tags: z.array(text(30)).max(20).optional(),
  ownerId: z.coerce.bigint().positive().nullable().optional(),
  nextFollowUpAt: when,
  note: text(2000).nullable().optional(),
})
const ListQuery = z.object({
  status: z.enum(["open", ...LEAD_STATUSES]).optional(),
  owner: z.string().trim().max(20).optional(),
  due: z.enum(["overdue", "today"]).optional(),
  tag: text(30).optional(),
  search: text(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const StatusBody = z.object({ status: z.enum(LEAD_STATUSES), reason: text(300).nullable().optional() })
const NoteBody = z.object({ kind: z.enum(NOTE_KINDS).default("note"), body: text(2000).min(1, "Write something"), nextFollowUpAt: when })

export const adminLeadsRouter = Router()
adminLeadsRouter.use(authMiddleware("adminOrSuper"))

adminLeadsRouter.get(
  "/",
  rbacMiddleware("leads.view"),
  validate({ query: ListQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).list(req.query as unknown as LeadQuery)
    envelope(res, { status: 200, data: r.items, meta: r.meta })
  }),
)
adminLeadsRouter.get(
  "/tags",
  rbacMiddleware("leads.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await svc(req).tags() })
  }),
)
adminLeadsRouter.get(
  "/owners",
  rbacMiddleware("leads.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await svc(req).owners() })
  }),
)
adminLeadsRouter.post(
  "/",
  rbacMiddleware("leads.create"),
  validate({ body: LeadBody }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as z.infer<typeof LeadBody>), message: "Lead added" })
  }),
)
adminLeadsRouter.get(
  "/:id",
  rbacMiddleware("leads.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await svc(req).get(idOf(req)) })
  }),
)
adminLeadsRouter.patch(
  "/:id",
  rbacMiddleware("leads.edit"),
  validate({ params: IdParam, body: LeadBody.omit({ note: true }).partial() }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await svc(req).update(idOf(req), req.body as Partial<z.infer<typeof LeadBody>>), message: "Lead saved" })
  }),
)
adminLeadsRouter.delete(
  "/:id",
  rbacMiddleware("leads.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).remove(idOf(req))
    envelope(res, { status: 200, data: null, message: "Lead deleted" })
  }),
)
adminLeadsRouter.post(
  "/:id/status",
  rbacMiddleware("leads.edit"),
  validate({ params: IdParam, body: StatusBody }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof StatusBody>
    envelope(res, { status: 200, data: await svc(req).setStatus(idOf(req), b.status, b.reason) })
  }),
)
adminLeadsRouter.post(
  "/:id/notes",
  rbacMiddleware("leads.edit"),
  validate({ params: IdParam, body: NoteBody }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).addNote(idOf(req), req.body as z.infer<typeof NoteBody>) })
  }),
)
adminLeadsRouter.post(
  "/:id/customer",
  rbacMiddleware("leads.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await svc(req).makeCustomer(idOf(req)) })
  }),
)
