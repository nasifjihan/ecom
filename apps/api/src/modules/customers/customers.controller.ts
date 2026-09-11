import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext, NotFoundError } from "../../core";
import { CustomersService } from "./customers.service";
import type {
  CreateCustomerDto as CreateCustomerDtoType,
  UpdateCustomerDto as UpdateCustomerDtoType,
  CustomerSearchQueryDto as CustomerSearchQueryDtoType,
  CustomerIdParamDto as CustomerIdParamDtoType,
  AddressIdParamDto as AddressIdParamDtoType,
  CustomerStatusTransitionDto as CustomerStatusTransitionDtoType,
  ExportCustomersDto as ExportCustomersDtoType,
  CustomerAddressDto as CustomerAddressDtoType,
  UpdateProfileDto as UpdateProfileDtoType,
  ChangePasswordDto as ChangePasswordDtoType,
  SetDefaultAddressDto as SetDefaultAddressDtoType,
  ImportCustomersDto as ImportCustomersDtoType,
} from "./customers.dto";

class CustomersController extends BaseController {
  private getService(ctx: RequestContext): CustomersService {
    return new CustomersService(ctx);
  }

  createCustomer = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateCustomerDtoType;
    const customer = await svc.createCustomer(dto);
    envelope(res, { status: 201, data: customer, message: "Customer created" });
  });

  listCustomers = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as CustomerSearchQueryDtoType;
    const result = await svc.listCustomers(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  getCustomer = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType;
    const customer = await svc.getCustomer(params.id);
    envelope(res, { status: 200, data: customer });
  });

  updateCustomer = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType;
    const dto = req.body as UpdateCustomerDtoType;
    const customer = await svc.updateCustomer(params.id, dto);
    envelope(res, { status: 200, data: customer, message: "Customer updated" });
  });

  deleteCustomer = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType;
    await svc.deleteCustomer(params.id);
    envelope(res, { status: 200, message: "Customer deleted" });
  });

  bulkUpdateStatuses = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const body = req.body as CustomerStatusTransitionDtoType;
    const result = await svc.bulkUpdateStatuses(body.ids, body.action);
    envelope(res, {
      status: 200,
      data: result,
      message: `${result.action} applied to ${result.count} customers`,
    });
  });

  exportCustomers = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.query as unknown as ExportCustomersDtoType;
    const result = await svc.generateCustomersExport(dto);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", result.contentDisposition);
    res.status(200).send(Buffer.from(result.buffer));
  });

  listAddresses = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType;
    const addresses = await svc.listAddresses(params.id);
    envelope(res, { status: 200, data: addresses });
  });

  addAddress = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType;
    const dto = req.body as CustomerAddressDtoType;
    const address = await svc.addAddress(params.id, dto);
    envelope(res, { status: 201, data: address, message: "Address added" });
  });

  setDefaultAddress = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType & AddressIdParamDtoType;
    const body = req.body as SetDefaultAddressDtoType;
    const address = await svc.setDefaultAddress(params.id, params.addressId, body.type);
    envelope(res, { status: 200, data: address, message: "Default address updated" });
  });

  getCustomerLtv = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CustomerIdParamDtoType;
    const ltv = await svc.getCustomerLtv(params.id);
    envelope(res, { status: 200, data: ltv });
  });

  importCustomers = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const multerFile = (req as any).file;
    if (!multerFile) {
      throw new NotFoundError("No file uploaded");
    }
    const body = req.body as ImportCustomersDtoType;
    const file = {
      buffer: multerFile.buffer as Uint8Array,
      originalName: multerFile.originalname as string,
      mimeType: multerFile.mimetype as string,
    };
    const result = await svc.importCustomers(file, {
      format: body.format ?? "csv",
      mode: body.mode ?? "insert",
    });
    envelope(res, { status: 200, data: result, message: "Import complete" });
  });

  myProfile = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const profile = await svc.getMyProfile();
    envelope(res, { status: 200, data: profile });
  });

  myAddresses = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const addresses = await svc.listMyAddresses();
    envelope(res, { status: 200, data: addresses });
  });

  updateProfile = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as UpdateProfileDtoType;
    const profile = await svc.updateMyProfile(dto);
    envelope(res, { status: 200, data: profile, message: "Profile updated" });
  });

  changePassword = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as ChangePasswordDtoType;
    await svc.changePassword(dto);
    envelope(res, { status: 200, message: "Password changed" });
  });
}

export const customersController = new CustomersController();
