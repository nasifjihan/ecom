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
} from "./auth.dto";

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
