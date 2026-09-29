import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
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
