/**
 * EMAIL ROUTES — /api/admin/emails/* (store admin, Settings > Emails)
 *   GET  /templates                  every email with its on/off switch
 *   GET  /templates/:key             wording, defaults and variables
 *   PUT  /templates/:key             save wording, switch and staff recipients
 *   DELETE /templates/:key           back to the built-in wording
 *   POST /templates/:key/preview     rendered HTML with example data (optionally for unsaved wording)
 *   POST /templates/:key/test        send an example to yourself
 *   GET  /log, /log/:id              sent-email log, one email with its HTML
 *   POST /log/:id/resend             send a logged email again
 */
import { Router, type Request, type Response } from "express"
import { prisma } from "../../config"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { EmailService } from "./notifications.service"
import {
  IdParamDto,
  LogQueryDto,
  PreviewDto,
  TemplateDto,
  TemplateKeyParamDto,
  TestSendDto,
} from "./notifications.dto"
import type { z } from "zod"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => EmailService.forContext(req.ctx)
const key = (req: Req) => (req.params as { key: string }).key
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const body = <T>(req: Req) => req.body as T

/** Runs a service call and sends its result in the standard envelope. */
const send = (run: (req: Req) => Promise<unknown>, status = 200) =>
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status, data: await run(req) })
  })

export const adminEmailsRouter = Router()
adminEmailsRouter.use(authMiddleware("adminOrSuper"))

adminEmailsRouter.get(
  "/templates",
  rbacMiddleware("emails.view"),
  send((req) => svc(req).listTemplates()),
)
adminEmailsRouter.get(
  "/templates/:key",
  rbacMiddleware("emails.view"),
  validate({ params: TemplateKeyParamDto }),
  send((req) => svc(req).getTemplate(key(req))),
)
adminEmailsRouter.put(
  "/templates/:key",
  rbacMiddleware("emails.edit"),
  validate({ params: TemplateKeyParamDto, body: TemplateDto }),
  send((req) =>
    svc(req).saveTemplate(key(req), body<z.infer<typeof TemplateDto>>(req), req.ctx.admin?.id),
  ),
)
adminEmailsRouter.delete(
  "/templates/:key",
  rbacMiddleware("emails.edit"),
  validate({ params: TemplateKeyParamDto }),
  send((req) => svc(req).resetTemplate(key(req))),
)
adminEmailsRouter.post(
  "/templates/:key/preview",
  rbacMiddleware("emails.edit"),
  validate({ params: TemplateKeyParamDto, body: PreviewDto }),
  send((req) => svc(req).preview(key(req), body<z.infer<typeof PreviewDto>>(req).draft)),
)
adminEmailsRouter.post(
  "/templates/:key/test",
  rbacMiddleware("emails.edit"),
  validate({ params: TemplateKeyParamDto, body: TestSendDto }),
  send(async (req) => {
    const b = body<z.infer<typeof TestSendDto>>(req)
    let to = b.to
    if (!to && req.ctx.admin) {
      const me = await prisma.adminUser.findUnique({
        where: { id: req.ctx.admin.id },
        select: { email: true },
      })
      to = me?.email
    }
    if (!to) throw new BadRequestError("Enter an email address to send the test to")
    return svc(req).sendTest(key(req), to, b.draft)
  }, 201),
)
adminEmailsRouter.get(
  "/log",
  rbacMiddleware("emails.view"),
  validate({ query: LogQueryDto }),
  ctrl(async (req: Req, res: Response) => {
    const out = await svc(req).listLog(req.query as unknown as z.infer<typeof LogQueryDto>)
    envelope(res, { status: 200, data: out.items, meta: out.meta })
  }),
)
adminEmailsRouter.get(
  "/log/:id",
  rbacMiddleware("emails.view"),
  validate({ params: IdParamDto }),
  send((req) => svc(req).getLog(id(req))),
)
adminEmailsRouter.post(
  "/log/:id/resend",
  rbacMiddleware("emails.edit"),
  validate({ params: IdParamDto }),
  send((req) => svc(req).resend(id(req)), 201),
)
