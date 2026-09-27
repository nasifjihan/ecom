/**
 * ACTIVITY LOG — every successful change made through the store admin API is recorded
 * (who, what, which record, a trimmed copy of the request, IP and browser), and staff with
 * `audit_logs.view` can read it under Settings → Activity log.
 */
import type { NextFunction, Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { logger, prisma } from "../../config";
import type { RequestContext } from "../../core";
import type { AuditQueryDto } from "./team.dto";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** POST routes that only read (prices, previews, exports, lookups). */
const READ_ONLY = /\/(quote|preview|export|validate|invoices?)$/;
const SECRET = /password|secret|token|credential|apikey|api_key/i;
const VERB: Record<string, string> = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

/** Request body without secrets, cut down to a readable size. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "string" && value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (depth > 3) return "…";
  if (Array.isArray(value)) {
    const items = value.slice(0, 20).map((v) => redact(v, depth + 1));
    return value.length > 20 ? [...items, `… ${value.length - 20} more`] : items;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET.test(k) ? "[hidden]" : redact(typeof v === "bigint" ? String(v) : v, depth + 1);
  }
  return out;
}

/**
 * "orders.status" for POST /api/admin/orders/:id/status, "products.update" for PATCH /products/:id,
 * "coupons.create" for POST /marketing/coupons. The object type is the first word after the group.
 */
export function describe(method: string, routePath: string): { action: string; objectType: string } {
  const words = routePath
    .replace(/^\/api\/admin\//, "")
    .split("/")
    .filter(Boolean);
  const plain = words.filter((w) => !w.startsWith(":")).map((w) => w.replace(/-/g, "_"));
  const groups = new Set(["marketing", "content", "shipping"]);
  const objectType = (groups.has(plain[0] ?? "") && plain[1] ? plain[1] : plain[0]) ?? "store";
  const last = words[words.length - 1] ?? "";
  // An action word after an id ("status", "refunds") names the change; otherwise use the verb.
  const endsOnAction = words.length > 1 && !last.startsWith(":") && words.some((w) => w.startsWith(":"));
  const parts = endsOnAction ? plain : [...plain, VERB[method] ?? method.toLowerCase()];
  return { action: parts.join("."), objectType };
}

/** Records successful store-admin changes once the response has gone out. */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method)) return next();
  // Remember the id a create returns, so the entry points at the new record.
  let createdId: string | undefined;
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    const id = (body as { data?: { id?: unknown } } | null)?.data?.id;
    if (id !== undefined && id !== null) createdId = String(id);
    return json(body);
  };
  res.on("finish", () => {
    const ctx = (req as Request & { ctx?: RequestContext }).ctx;
    if (res.statusCode >= 400 || !ctx?.storeId || !(ctx.admin || ctx.super)) return;
    const routePath = `${req.baseUrl}${req.route?.path ?? req.path}`;
    if (READ_ONLY.test(routePath)) return;
    const { action, objectType } = describe(req.method, routePath);
    const params = Object.values(req.params ?? {}).filter(Boolean);
    prisma.auditLog
      .create({
        data: {
          storeId: ctx.storeId,
          adminId: ctx.super ? null : ctx.admin?.id ?? null,
          action,
          objectType,
          objectId: params.join("/") || createdId || "",
          changes: {
            method: req.method,
            path: req.originalUrl.split("?")[0],
            ...(ctx.super ? { by: "platform team" } : {}),
            body: redact(req.body ?? null),
          } as Prisma.InputJsonValue,
          ipAddress: ctx.ip ?? req.ip ?? null,
          userAgent: req.get("user-agent")?.slice(0, 300) ?? null,
        },
      })
      .catch((e: Error) => logger.warn({ err: e.message, action }, "Couldn't write the activity log"));
  });
  next();
}

export async function listAudit(storeId: bigint, q: AuditQueryDto) {
  const where: Prisma.AuditLogWhereInput = {
    storeId,
    ...(q.adminId ? { adminId: q.adminId } : {}),
    ...(q.objectType ? { objectType: q.objectType } : {}),
    ...(q.search
      ? { OR: [{ action: { contains: q.search, mode: "insensitive" } }, { objectId: { contains: q.search } }] }
      : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [rows, total, types] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.perPage,
      take: q.perPage,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where: { storeId }, distinct: ["objectType"], select: { objectType: true } }),
  ]);
  return {
    items: rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      objectType: r.objectType,
      objectId: r.objectId,
      admin: r.admin ? { id: String(r.admin.id), name: r.admin.name, email: r.admin.email } : null,
      changes: r.changes,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    })),
    meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    objectTypes: types.map((t) => t.objectType).sort(),
  };
}
