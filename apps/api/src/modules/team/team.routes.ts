/**
 * TEAM ROUTES (store admin)
 *   GET              /api/admin/permissions             the permission catalogue (areas × actions)
 *   GET|POST         /api/admin/roles                   list / create (optionally copying a role)
 *   GET|PATCH|DELETE /api/admin/roles/:id
 *   GET|POST         /api/admin/staff                   list / add a staff account
 *   PATCH            /api/admin/staff/:id               name, phone, role, active/inactive
 *   POST             /api/admin/staff/:id/password      set a new password (ends their sessions)
 *   GET              /api/admin/audit-logs              activity log
 */
import { Router, type Request, type Response } from "express";
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { TeamService } from "./team.service";
import { listAudit } from "./audit";
import {
  AuditQueryDto,
  CreateRoleDto,
  CreateStaffDto,
  IdParam,
  ResetStaffPasswordDto,
  UpdateRoleDto,
  UpdateStaffDto,
} from "./team.dto";

type Req = Request & { ctx: RequestContext };
const svc = (req: Req) => new TeamService(req.ctx);
const id = (req: Req) => BigInt((req.params as { id: string }).id);
const send = (run: (req: Req) => Promise<unknown> | unknown, status = 200) =>
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status, data: await run(req) });
  });

export const adminPermissionsRouter = Router();
adminPermissionsRouter.use(authMiddleware("adminOrSuper"));
adminPermissionsRouter.get("/", rbacMiddleware("roles.view"), send((r) => svc(r).catalogue()));

export const adminTeamRolesRouter = Router();
adminTeamRolesRouter.use(authMiddleware("adminOrSuper"));
adminTeamRolesRouter.get("/", rbacMiddleware("roles.view"), send((r) => svc(r).listRoles()));
adminTeamRolesRouter.post("/", rbacMiddleware("roles.create"), validate({ body: CreateRoleDto }), send((r) => svc(r).createRole(r.body as CreateRoleDto), 201));
adminTeamRolesRouter.get("/:id", rbacMiddleware("roles.view"), validate({ params: IdParam }), send((r) => svc(r).getRole(id(r))));
adminTeamRolesRouter.patch("/:id", rbacMiddleware("roles.edit"), validate({ params: IdParam, body: UpdateRoleDto }), send((r) => svc(r).updateRole(id(r), r.body as UpdateRoleDto)));
adminTeamRolesRouter.delete("/:id", rbacMiddleware("roles.delete"), validate({ params: IdParam }), send((r) => svc(r).deleteRole(id(r))));

export const adminStaffRouter = Router();
adminStaffRouter.use(authMiddleware("adminOrSuper"));
adminStaffRouter.get("/", rbacMiddleware("staff.view"), send((r) => svc(r).listStaff()));
adminStaffRouter.post("/", rbacMiddleware("staff.create"), validate({ body: CreateStaffDto }), send((r) => svc(r).createStaff(r.body as CreateStaffDto), 201));
adminStaffRouter.patch("/:id", rbacMiddleware("staff.edit"), validate({ params: IdParam, body: UpdateStaffDto }), send((r) => svc(r).updateStaff(id(r), r.body as UpdateStaffDto)));
adminStaffRouter.post(
  "/:id/password",
  rbacMiddleware("staff.edit"),
  validate({ params: IdParam, body: ResetStaffPasswordDto }),
  send((r) => svc(r).resetStaffPassword(id(r), r.body as ResetStaffPasswordDto)),
);

export const adminAuditRouter = Router();
adminAuditRouter.use(authMiddleware("adminOrSuper"));
adminAuditRouter.get(
  "/",
  rbacMiddleware("audit_logs.view"),
  validate({ query: AuditQueryDto }),
  ctrl(async (req: Req, res: Response) => {
    if (req.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    const out = await listAudit(req.ctx.storeId, req.query as unknown as AuditQueryDto);
    envelope(res, { status: 200, data: { items: out.items, objectTypes: out.objectTypes }, meta: out.meta });
  }),
);
