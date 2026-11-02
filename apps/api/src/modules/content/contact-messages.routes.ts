/**
 * The contact form (POST /api/storefront/contact) and Customers > Messages
 * (mounted at /api/admin/contact-messages).
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { CONTACT_KINDS, CONTACT_STATUSES, ContactDto, ContactInbox, sendContactMessage } from "./contact-messages"

type Req = Request & { ctx: RequestContext }
const Id = z.object({ id: z.coerce.bigint().positive() })
const idOf = (r: Req) => BigInt((r.params as { id: string }).id)

export const storefrontContactRouter = Router()
storefrontContactRouter.post(
  "/",
  authMiddleware("optional"),
  validate({ body: ContactDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await sendContactMessage(req.ctx, req.body as ContactDto, req.ip ?? null), message: "Message sent" })
  }),
)

export const adminContactMessagesRouter = Router()
adminContactMessagesRouter.use(authMiddleware("adminOrSuper"))

adminContactMessagesRouter.get(
  "/",
  rbacMiddleware("customers.view"),
  validate({
    query: z.object({
      status: z.enum(CONTACT_STATUSES).optional(),
      kind: z.enum(CONTACT_KINDS).optional(),
      search: z.string().max(80).optional(),
      page: z.coerce.number().int().min(1).default(1),
      perPage: z.coerce.number().int().min(1).max(100).default(25),
    }),
  }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await new ContactInbox(req.ctx).list(req.query as never) })
  }),
)
adminContactMessagesRouter.get(
  "/:id",
  rbacMiddleware("customers.view"),
  validate({ params: Id }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await new ContactInbox(req.ctx).get(idOf(req)) })
  }),
)
adminContactMessagesRouter.put(
  "/:id",
  rbacMiddleware("customers.edit"),
  validate({ params: Id, body: z.object({ status: z.enum(CONTACT_STATUSES).optional(), assignedToId: z.coerce.bigint().positive().nullable().optional() }) }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await new ContactInbox(req.ctx).update(idOf(req), req.body as never), message: "Message updated" })
  }),
)
adminContactMessagesRouter.post(
  "/:id/replies",
  rbacMiddleware("customers.edit"),
  validate({ params: Id, body: z.object({ channel: z.enum(["sms", "email", "note"]), body: z.string().trim().min(2, "Write the reply").max(2000) }) }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as { channel: "sms" | "email" | "note"; body: string }
    envelope(res, { data: await new ContactInbox(req.ctx).reply(idOf(req), b), message: b.channel === "note" ? "Note added" : "Reply sent" })
  }),
)
