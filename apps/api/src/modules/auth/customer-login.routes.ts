/**
 * CUSTOMER SIGN-IN SETTINGS
 *   GET|PUT /api/admin/login-settings   email-code sign-in switch (phone codes: /api/admin/sms/settings)
 */
import { Router, type Request, type Response } from "express"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { CustomerLoginService, SaveLoginSettingsDto } from "./customer-login"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => {
  if (req.ctx.storeId === undefined)
    throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return new CustomerLoginService(BigInt(req.ctx.storeId))
}

export const adminLoginSettingsRouter = Router()
adminLoginSettingsRouter.use(authMiddleware("adminOrSuper"))

adminLoginSettingsRouter.get(
  "/",
  rbacMiddleware("settings.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).settings() })
  }),
)
adminLoginSettingsRouter.put(
  "/",
  rbacMiddleware("settings.edit"),
  validate({ body: SaveLoginSettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).save(req.body as SaveLoginSettingsDto),
      message: "Sign-in settings saved",
    })
  }),
)
