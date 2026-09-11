import { Router } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { usersController } from "./users.controller";
import {
  CreateAdminUserDto,
  UpdateAdminUserDto,
  AdminUserAssignRoleDto,
  AdminUserStatusDto,
  CreateRoleDto,
  UpdateRoleDto,
  BulkAssignPermissionsDto,
  PaginationDto,
} from "./users.dto";

const adminUsersRouter = Router();

adminUsersRouter.use(authMiddleware("adminOrSuper"));

adminUsersRouter.get(
  "/",
  rbacMiddleware(["admin.users.read", "users.read"]),
  validate({ query: PaginationDto }),
  usersController.listAdminUsers,
);

adminUsersRouter.post(
  "/",
  rbacMiddleware("admin.users.create"),
  validate({ body: CreateAdminUserDto }),
  usersController.createAdmin,
);

adminUsersRouter.get(
  "/:id",
  rbacMiddleware("admin.users.read"),
  usersController.getAdmin,
);

adminUsersRouter.patch(
  "/:id",
  rbacMiddleware("admin.users.update"),
  validate({ body: UpdateAdminUserDto }),
  usersController.updateAdmin,
);

adminUsersRouter.delete(
  "/:id",
  rbacMiddleware(["admin.users.delete", "admin.users.update"]),
  usersController.deleteAdmin,
);

adminUsersRouter.post(
  "/:id/assign-role",
  rbacMiddleware("admin.users.assignRole"),
  validate({ body: AdminUserAssignRoleDto }),
  usersController.assignRole,
);

adminUsersRouter.post(
  "/:id/status",
  rbacMiddleware("admin.users.update"),
  validate({ body: AdminUserStatusDto }),
  usersController.changeStatus,
);

adminUsersRouter.post(
  "/:id/reset-password",
  rbacMiddleware(["admin.users.resetPassword", "admin.users.update"]),
  usersController.resetPassword,
);

const adminRolesRouter = Router();

adminRolesRouter.use(authMiddleware("adminOrSuper"));

adminRolesRouter.get(
  "/",
  rbacMiddleware("rbac.roles.read"),
  validate({ query: PaginationDto }),
  usersController.listRoles,
);

adminRolesRouter.post(
  "/",
  rbacMiddleware("rbac.roles.create"),
  validate({ body: CreateRoleDto }),
  usersController.createRole,
);

adminRolesRouter.get(
  "/:id",
  rbacMiddleware("rbac.roles.read"),
  usersController.getRole,
);

adminRolesRouter.patch(
  "/:id",
  rbacMiddleware("rbac.roles.update"),
  validate({ body: UpdateRoleDto }),
  usersController.updateRole,
);

adminRolesRouter.delete(
  "/:id",
  rbacMiddleware("rbac.roles.delete"),
  usersController.deleteRole,
);

adminRolesRouter.post(
  "/:id/permissions",
  rbacMiddleware("rbac.roles.assignPerms"),
  validate({ body: BulkAssignPermissionsDto }),
  usersController.bulkAssignPermissions,
);

const superAdminUsersRouter = Router();

superAdminUsersRouter.use(authMiddleware("super"));

superAdminUsersRouter.get(
  "/",
  validate({ query: PaginationDto }),
  usersController.listAdminUsers,
);

superAdminUsersRouter.post(
  "/",
  validate({ body: CreateAdminUserDto }),
  usersController.createAdmin,
);

superAdminUsersRouter.get("/:id", usersController.getAdmin);

superAdminUsersRouter.patch(
  "/:id",
  validate({ body: UpdateAdminUserDto }),
  usersController.updateAdmin,
);

superAdminUsersRouter.delete("/:id", usersController.deleteAdmin);

superAdminUsersRouter.post(
  "/:id/assign-role",
  validate({ body: AdminUserAssignRoleDto }),
  usersController.assignRole,
);

superAdminUsersRouter.post(
  "/:id/status",
  validate({ body: AdminUserStatusDto }),
  usersController.changeStatus,
);

superAdminUsersRouter.post("/:id/reset-password", usersController.resetPassword);

const superRolesRouter = Router();

superRolesRouter.use(authMiddleware("super"));

superRolesRouter.get(
  "/",
  validate({ query: PaginationDto }),
  usersController.listRoles,
);

superRolesRouter.post(
  "/",
  validate({ body: CreateRoleDto }),
  usersController.createRole,
);

superRolesRouter.get("/:id", usersController.getRole);

superRolesRouter.patch(
  "/:id",
  validate({ body: UpdateRoleDto }),
  usersController.updateRole,
);

superRolesRouter.delete("/:id", usersController.deleteRole);

superRolesRouter.post(
  "/:id/permissions",
  validate({ body: BulkAssignPermissionsDto }),
  usersController.bulkAssignPermissions,
);

export {
  adminUsersRouter,
  adminRolesRouter,
  superAdminUsersRouter,
  superRolesRouter,
};
