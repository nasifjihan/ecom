import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core";
import { banCustomer, unbanCustomer } from "./customer-ban";
import { customersController } from "./customers.controller";
import {
  CustomerSearchQueryDto,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerIdParamDto,
  AddressIdParamDto,
  CustomerStatusTransitionDto,
  ExportCustomersDto,
  CustomerAddressDto,
  UpdateProfileDto,
  ChangePasswordDto,
  SetDefaultAddressDto,
  ImportCustomersDto,
} from "./customers.dto";

function multerFallback(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export const adminCustomersRouter = Router();

const BanDto = z.object({ reason: z.string().trim().min(3, "Say why (staff see it on the customer)").max(300) });
const storeOf = (req: Request & { ctx: RequestContext }): bigint => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED");
  return BigInt(req.ctx.storeId);
};

/** Ban a customer (they can't sign in or order) with a reason, or lift the ban. */
adminCustomersRouter.post(
  "/:id/ban",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.edit"),
  validate({ params: CustomerIdParamDto, body: BanDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    await banCustomer(storeOf(req), BigInt(String(req.params.id)), (req.body as z.infer<typeof BanDto>).reason);
    envelope(res, { status: 200, data: { banned: true }, message: "Customer banned" });
  }),
);
adminCustomersRouter.post(
  "/:id/unban",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.edit"),
  validate({ params: CustomerIdParamDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    await unbanCustomer(storeOf(req), BigInt(String(req.params.id)));
    envelope(res, { status: 200, data: { banned: false }, message: "Ban lifted" });
  }),
);

adminCustomersRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.create"),
  validate({ body: CreateCustomerDto }),
  customersController.createCustomer,
);

adminCustomersRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.view"),
  validate({ query: CustomerSearchQueryDto }),
  customersController.listCustomers,
);

adminCustomersRouter.get(
  "/groups",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.view"),
  customersController.listGroups,
);

adminCustomersRouter.get(
  "/export",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.view"),
  validate({ query: ExportCustomersDto }),
  customersController.exportCustomers,
);

adminCustomersRouter.post(
  "/import",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.create"),
  multerFallback,
  validate({ body: ImportCustomersDto }),
  customersController.importCustomers,
);

adminCustomersRouter.post(
  "/bulk-status",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.edit"),
  validate({ body: CustomerStatusTransitionDto }),
  customersController.bulkUpdateStatuses,
);

adminCustomersRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.view"),
  validate({ params: CustomerIdParamDto }),
  customersController.getCustomer,
);

adminCustomersRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.edit"),
  validate({ params: CustomerIdParamDto, body: UpdateCustomerDto }),
  customersController.updateCustomer,
);

adminCustomersRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.delete"),
  validate({ params: CustomerIdParamDto }),
  customersController.deleteCustomer,
);

adminCustomersRouter.get(
  "/:id/ltv",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.view"),
  validate({ params: CustomerIdParamDto }),
  customersController.getCustomerLtv,
);

adminCustomersRouter.get(
  "/:id/addresses",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.view"),
  validate({ params: CustomerIdParamDto }),
  customersController.listAddresses,
);

adminCustomersRouter.post(
  "/:id/addresses",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.edit"),
  validate({ params: CustomerIdParamDto, body: CustomerAddressDto }),
  customersController.addAddress,
);

adminCustomersRouter.post(
  "/:id/addresses/:addressId/default",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("customers.edit"),
  validate({ params: CustomerIdParamDto.merge(AddressIdParamDto), body: SetDefaultAddressDto }),
  customersController.setDefaultAddress,
);

export const customerSelfRouter = Router();

customerSelfRouter.get(
  "/me",
  authMiddleware("customer"),
  customersController.myProfile,
);

customerSelfRouter.patch(
  "/me",
  authMiddleware("customer"),
  validate({ body: UpdateProfileDto }),
  customersController.updateProfile,
);

customerSelfRouter.post(
  "/me/password",
  authMiddleware("customer"),
  validate({ body: ChangePasswordDto }),
  customersController.changePassword,
);

customerSelfRouter.get(
  "/me/addresses",
  authMiddleware("customer"),
  customersController.myAddresses,
);

customerSelfRouter.post(
  "/me/addresses",
  authMiddleware("customer"),
  validate({ body: CustomerAddressDto }),
  customersController.addMyAddress,
);

customerSelfRouter.patch(
  "/me/addresses/:addressId",
  authMiddleware("customer"),
  validate({ params: AddressIdParamDto, body: CustomerAddressDto }),
  customersController.updateMyAddress,
);

customerSelfRouter.delete(
  "/me/addresses/:addressId",
  authMiddleware("customer"),
  validate({ params: AddressIdParamDto }),
  customersController.deleteMyAddress,
);

customerSelfRouter.post(
  "/me/addresses/:addressId/default",
  authMiddleware("customer"),
  validate({ params: AddressIdParamDto, body: SetDefaultAddressDto }),
  customersController.setMyDefaultAddress,
);
