/**
 * OPENAPI from the running app: walks Express's route table, and for each route reads what its
 * middleware tagged (core/route-meta): the login it needs, its permissions and its zod schemas for
 * params, query and body. Router-level middleware (router.use(auth, rbac)) applies to every route
 * under it. So the docs follow the code: a new route shows up with nothing else to write.
 */
import type { Express } from "express"
import type { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { routeMetaOf, type RouteMeta } from "../../core/route-meta"

interface Layer {
  name: string
  handle: { stack?: Layer[] } & ((...a: unknown[]) => unknown)
  regexp: RegExp & { fast_slash?: boolean }
  keys: { name: string | number }[]
  route?: { path: string | RegExp | (string | RegExp)[]; methods: Record<string, boolean>; stack: { handle: unknown }[] }
}

export interface RouteInfo {
  method: string
  /** Express style, e.g. /api/admin/orders/:id */
  path: string
  meta: Required<Pick<RouteMeta, "permissions">> & RouteMeta
}

/** "/api/admin/reports" back from the regexp Express keeps for a mounted router. */
export function mountPath(layer: Pick<Layer, "regexp" | "keys">): string {
  if (layer.regexp.fast_slash) return ""
  let i = 0
  return layer.regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    // A path part is "(?:\/([^/]+?))" (the slash inside the group; the class may be [^/] or [^\/]).
    .replace(/\(\?:(\\\/)?\(\[\^\\?\/\]\+\?\)\)/g, (_m, slash?: string) => `${slash ? "\\/" : ""}:${String(layer.keys[i++]?.name ?? "param")}`)
    .replace(/\\(.)/g, "$1")
}

const join = (a: string, b: string) => (`${a}/${b}`.replace(/\/+/g, "/").replace(/(.)\/$/, "$1") || "/")

function merge(metas: RouteMeta[]): RouteInfo["meta"] {
  const out: RouteInfo["meta"] = { permissions: [] }
  for (const m of metas) {
    if (m.auth) out.auth = m.auth
    if (m.permissions) out.permissions = [...new Set([...out.permissions, ...m.permissions])]
    if (m.schemas) out.schemas = { ...out.schemas, ...Object.fromEntries(Object.entries(m.schemas).filter(([, v]) => v)) }
  }
  return out
}

/** Middleware seen so far, for the routes under `scope` (a path prefix). */
interface Scoped {
  scope: string
  meta: RouteMeta
}

const under = (path: string, scope: string) => path === scope || path.startsWith(scope === "/" ? "/" : `${scope}/`)

function walk(stack: Layer[], prefix: string, inherited: Scoped[], out: RouteInfo[]) {
  const local = [...inherited]
  for (const layer of stack) {
    if (layer.route) {
      const paths = (Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path]).filter((p): p is string => typeof p === "string")
      const own = layer.route.stack.map((l) => routeMetaOf(l.handle)).filter((m): m is RouteMeta => !!m)
      for (const method of Object.keys(layer.route.methods).filter((m) => m !== "_all"))
        for (const p of paths) {
          const path = join(prefix, p)
          out.push({ method, path, meta: merge([...local.filter((s) => under(path, s.scope)).map((s) => s.meta), ...own]) })
        }
    } else if (layer.handle.stack) {
      walk(layer.handle.stack, join(prefix, mountPath(layer)), local, out)
    } else {
      // Middleware for everything below this point: router.use(auth) or router.use("/loyalty", auth).
      const m = routeMetaOf(layer.handle)
      if (m) local.push({ scope: join(prefix, mountPath(layer)), meta: m })
    }
  }
}

/** Every route the app serves, in mount order. */
export function listRoutes(app: Express): RouteInfo[] {
  const out: RouteInfo[] = []
  const router = (app as unknown as { _router?: { stack: Layer[] } })._router
  if (router) walk(router.stack, "", [], out)
  return out
}

type Json = Record<string, unknown>
const json = (s: z.ZodTypeAny) => {
  const j = zodToJsonSchema(s as Parameters<typeof zodToJsonSchema>[0], { target: "openApi3", $refStrategy: "none" }) as Json
  delete j.$schema
  return j
}

/** A query or params schema as OpenAPI parameters. */
function parameters(s: z.ZodTypeAny | undefined, where: "query" | "path"): Json[] {
  if (!s) return []
  const j = json(s) as { properties?: Record<string, Json>; required?: string[] }
  return Object.entries(j.properties ?? {}).map(([name, schema]) => ({
    name,
    in: where,
    required: where === "path" || (j.required ?? []).includes(name),
    schema,
    ...(typeof schema.description === "string" ? { description: schema.description } : {}),
  }))
}

const AUDIENCE: Record<string, string> = {
  adminOrSuper: "Store staff or platform super admin",
  admin: "Store staff",
  super: "Platform super admin",
  customer: "Signed-in customer",
  optional: "Works signed in or out",
  any: "Any signed-in user",
}

/** "admin · orders" from /api/admin/orders/..., "storefront · products", "auth". */
export function tagOf(path: string): string {
  const [, , area, group] = path.split("/")
  if (!area) return "other"
  if (["admin", "storefront", "super"].includes(area) && group && !group.startsWith(":")) return `${area} · ${group}`
  return area
}

export function buildOpenApi(app: Express) {
  const paths: Record<string, Record<string, Json>> = {}
  for (const r of listRoutes(app)) {
    if (!r.path.startsWith("/api/") || r.path.startsWith("/api/docs")) continue
    const oaPath = r.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}")
    const pathNames = [...r.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]!)
    const params = parameters(r.meta.schemas?.params, "path")
    // Path parts without a schema are still listed, as text.
    for (const name of pathNames) if (!params.some((p) => p.name === name)) params.push({ name, in: "path", required: true, schema: { type: "string" } })
    const needsLogin = r.meta.auth && r.meta.auth !== "optional"
    const lines = [
      r.meta.auth ? `**Who:** ${AUDIENCE[r.meta.auth] ?? r.meta.auth}` : "**Who:** public",
      r.meta.permissions.length ? `**Permission:** ${r.meta.permissions.map((p) => `\`${p}\``).join(", ")}` : "",
    ].filter(Boolean)
    const op: Json = {
      tags: [tagOf(r.path)],
      operationId: `${r.method}_${r.path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
      description: lines.join("  \n"),
      parameters: [...params, ...parameters(r.meta.schemas?.query, "query")],
      ...(r.meta.schemas?.body ? { requestBody: { required: true, content: { "application/json": { schema: json(r.meta.schemas.body) } } } } : {}),
      ...(needsLogin ? { security: [{ bearerAuth: [] }] } : r.meta.auth === "optional" ? { security: [{}, { bearerAuth: [] }] } : {}),
      ...(r.meta.permissions.length ? { "x-permissions": r.meta.permissions } : {}),
      responses: {
        "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        ...(r.meta.schemas ? { "422": { description: "Validation failed: `errors` maps each field to its messages" } } : {}),
        ...(needsLogin ? { "401": { description: "Not signed in" } } : {}),
        ...(r.meta.permissions.length ? { "403": { description: "Missing the permission" } } : {}),
      },
    }
    ;(paths[oaPath] ??= {})[r.method] = op
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "E-commerce platform API",
      version: "1.0.0",
      description:
        "Generated from the running API. Store routes find the store from the request's Origin (or `X-Store-Id` in development). " +
        "Every answer is wrapped as `{ success, message, data, meta? }`; ids are strings.",
    },
    servers: [{ url: "/" }],
    tags: [...new Set(Object.values(paths).flatMap((m) => Object.values(m).map((o) => (o.tags as string[])[0]!)))].sort().map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Envelope: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {},
            meta: { type: "object", additionalProperties: true },
            requestId: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
  }
}
