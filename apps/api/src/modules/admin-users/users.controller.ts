import type { Request, Response } from "express";
import { BaseController, envelope, ctrl } from "../../core";
import type { RequestContext } from "../../core";
import { UsersService } from "./users.service";
import type {
  CreateAdminUserDtoType,
  UpdateAdminUserDtoType,
  AdminUserAssignRoleDtoType,
  AdminUserStatusDtoType,
  CreateRoleDtoType,
  UpdateRoleDtoType,
  BulkAssignPermissionsDtoType,
  PaginationDtoType,
} from "./users.dto";
import { z } from "zod";

const ResetPasswordDto = z.object({
  newPassword: z.string().min(8),
  temporary: z.boolean().optional(),
});

function parseId(param: string | undefined): bigint {
  return BigInt(param as string);
}

export class UsersController extends BaseController {
  private getService(ctx: RequestContext): UsersService {
    return new UsersService(ctx);
  }

  listAdminUsers = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const paginated = req.query as unknown as PaginationDtoType;
    const result = await svc.listAdminUsers(paginated);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  createAdmin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateAdminUserDtoType;
    const created = await svc.createAdmin(dto);
    envelope(res, { status: 201, data: created, message: "Admin user created" });
  });

  getAdmin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const admin = await svc.getAdmin(id);
    envelope(res, { status: 200, data: admin });
  });

  updateAdmin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const dto = req.body as UpdateAdminUserDtoType;
    const updated = await svc.updateAdmin(id, dto);
    envelope(res, { status: 200, data: updated, message: "Admin user updated" });
  });

  deleteAdmin = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    await svc.deleteAdmin(id);
    envelope(res, { status: 200, message: "Admin user deactivated" });
  });

  assignRole = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const dto = req.body as AdminUserAssignRoleDtoType;
    const updated = await svc.assignRole(id, dto);
    envelope(res, { status: 200, data: updated, message: "Role assigned" });
  });

  changeStatus = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const dto = req.body as AdminUserStatusDtoType;
    const updated = await svc.changeStatus(id, dto);
    envelope(res, { status: 200, data: updated, message: "Status updated" });
  });

  resetPassword = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const body = ResetPasswordDto.parse(req.body);
    await svc.resetAdminPassword(id, body.newPassword);
    envelope(res, { status: 200, message: "Password reset successful" });
  });

  listRoles = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const paginated = req.query as unknown as PaginationDtoType;
    const result = await svc.listRoles(paginated);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  createRole = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateRoleDtoType;
    const created = await svc.createRole(dto);
    envelope(res, { status: 201, data: created, message: "Role created" });
  });

  getRole = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const role = await svc.getRole(id);
    envelope(res, { status: 200, data: role });
  });

  updateRole = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const dto = req.body as UpdateRoleDtoType;
    const updated = await svc.updateRole(id, dto);
    envelope(res, { status: 200, data: updated, message: "Role updated" });
  });

  deleteRole = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    await svc.deleteRole(id);
    envelope(res, { status: 200, message: "Role deleted" });
  });

  bulkAssignPermissions = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const id = parseId(req.params.id);
    const dto = req.body as BulkAssignPermissionsDtoType;
    const result = await svc.bulkAssignRolePermissions(id, dto.permissions);
    envelope(res, { status: 200, data: result, message: "Permissions assigned" });
  });
}

export const usersController = new UsersController();
