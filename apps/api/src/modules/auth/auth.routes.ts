import { Router } from "express";
import { validate, authMiddleware, rbacMiddleware } from "../../middleware";
import { authController } from "./auth.controller";
import {
  SuperLoginDto,
  AdminLoginDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  AdminOwnerRegisterFirstDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  CustomerResetPasswordDto,
  AdminResetPasswordDto,
} from "./auth.dto";
import { PasswordResetService } from "./password-reset";
import { OtpRequestDto, OtpVerifyDto } from "../sms/sms.dto";
import { UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core";
import type { Request, Response } from "express";

const router = Router();

router.post(
  "/super/login",
  validate({ body: SuperLoginDto }),
  authController.postSuperLogin,
);

router.post(
  "/admin/login",
  validate({ body: AdminLoginDto }),
  authController.postAdminLogin,
);

router.post(
  "/customer/login",
  validate({ body: CustomerLoginDto }),
  authController.postCustomerLogin,
);

router.post(
  "/customer/register",
  validate({ body: CustomerRegisterDto }),
  authController.postCustomerRegister,
);

// ---- sign in with a code sent by SMS (Settings → SMS → phone sign-in)
router.get("/customer/login-methods", authController.getCustomerLoginMethods);
router.post("/customer/otp/request", validate({ body: OtpRequestDto }), authController.postCustomerOtpRequest);
router.post("/customer/otp/verify", validate({ body: OtpVerifyDto }), authController.postCustomerOtpVerify);

// ---- forgot / reset password (store comes from the request Origin)

type Req = Request & { ctx: RequestContext };
const resets = (req: Req) => {
  if (!req.ctx.storeId) throw new UnauthorizedError("Store not resolved", "TENANT_NOT_RESOLVED");
  return new PasswordResetService(BigInt(req.ctx.storeId));
};
const SENT = "If an account uses that email, we've sent a link to reset the password.";

router.post(
  "/customer/forgot-password",
  validate({ body: ForgotPasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    await resets(req).requestCustomer((req.body as ForgotPasswordDto).email);
    envelope(res, { status: 200, message: SENT, data: { sent: true } });
  }),
);

router.post(
  "/customer/reset-password",
  validate({ body: CustomerResetPasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as CustomerResetPasswordDto;
    envelope(res, { status: 200, message: "Password changed", data: await resets(req).resetCustomer(b.token, b.password) });
  }),
);

router.post(
  "/admin/forgot-password",
  validate({ body: ForgotPasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    await resets(req).requestAdmin((req.body as ForgotPasswordDto).email);
    envelope(res, { status: 200, message: SENT, data: { sent: true } });
  }),
);

router.post(
  "/admin/reset-password",
  validate({ body: AdminResetPasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as AdminResetPasswordDto;
    envelope(res, { status: 200, message: "Password changed", data: await resets(req).resetAdmin(b.token, b.password) });
  }),
);

router.post(
  "/admin/register-first-owner",
  validate({ body: AdminOwnerRegisterFirstDto }),
  authController.postRegisterOwnerFirst,
);

router.post(
  "/super/refresh",
  validate({ body: RefreshTokenDto }),
  authController.postRefreshSuper,
);

router.post(
  "/admin/refresh",
  validate({ body: RefreshTokenDto }),
  authController.postRefreshAdmin,
);

router.post(
  "/customer/refresh",
  validate({ body: RefreshTokenDto }),
  authController.postRefreshCustomer,
);

router.post(
  "/logout",
  authMiddleware("optional"),
  authController.postLogout,
);

router.get(
  "/me/super",
  authMiddleware("super"),
  authController.getMeSuper,
);

router.get(
  "/me/admin",
  authMiddleware("admin"),
  authController.getMeAdmin,
);

router.get(
  "/me/customer",
  authMiddleware("customer"),
  authController.getMeCustomer,
);

router.get(
  "/me",
  authMiddleware("any"),
  authController.getMeAny,
);

export default router;
export { router as authRoutes };
