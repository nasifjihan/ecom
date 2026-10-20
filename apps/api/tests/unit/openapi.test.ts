import { describe, expect, it } from "vitest"
import express, { Router } from "express"
import { z } from "zod"
import { authMiddleware, rbacMiddleware, validate } from "../../src/middleware"
import { buildOpenApi, listRoutes } from "../../src/modules/docs"
import { mountPath, tagOf } from "../../src/modules/docs/openapi"

const ok = (_req: unknown, res: { json: (v: unknown) => void }) => res.json({})

function tinyApp() {
  const app = express()
  const orders = Router()
  orders.use(authMiddleware("adminOrSuper"), rbacMiddleware("orders.view"))
  orders.get("/", validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), status: z.enum(["new", "paid"]).optional() }) }), ok)
  orders.patch(
    "/:id",
    rbacMiddleware("orders.edit"),
    validate({ params: z.object({ id: z.coerce.bigint() }), body: z.object({ note: z.string().max(200) }) }),
    ok,
  )
  const shop = Router()
  shop.get("/products/:slug", ok)
  shop.use("/loyalty", authMiddleware("customer"))
  shop.get("/loyalty/points", ok)
  const nested = Router({ mergeParams: true })
  nested.get("/items", ok)
  orders.use("/:orderId/parcels", nested)
  app.use("/api/admin/orders", orders)
  app.use("/api/storefront", shop)
  return app
}

describe("API docs from the routes", () => {
  it("finds every route with the login, permissions and shapes its middleware declare", () => {
    const routes = listRoutes(tinyApp())
    const by = (m: string, p: string) => routes.find((r) => r.method === m && r.path === p)!
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      "get /api/admin/orders",
      "patch /api/admin/orders/:id",
      "get /api/admin/orders/:orderId/parcels/items",
      "get /api/storefront/products/:slug",
      "get /api/storefront/loyalty/points",
    ])
    expect(by("patch", "/api/admin/orders/:id").meta).toMatchObject({ auth: "adminOrSuper", permissions: ["orders.view", "orders.edit"] })
    expect(by("get", "/api/admin/orders/:orderId/parcels/items").meta.permissions).toEqual(["orders.view"])
    // Path-scoped middleware covers only its own path.
    expect(by("get", "/api/storefront/loyalty/points").meta.auth).toBe("customer")
    expect(by("get", "/api/storefront/products/:slug").meta.auth).toBeUndefined()
  })

  it("writes OpenAPI parameters, bodies and security", () => {
    const doc = buildOpenApi(tinyApp())
    const list = doc.paths["/api/admin/orders"]!.get!
    expect(list.parameters).toEqual([
      { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
      { name: "status", in: "query", required: false, schema: { type: "string", enum: ["new", "paid"] } },
    ])
    expect(list.security).toEqual([{ bearerAuth: [] }])
    const patch = doc.paths["/api/admin/orders/{id}"]!.patch!
    expect(patch["x-permissions"]).toEqual(["orders.view", "orders.edit"])
    expect((patch.requestBody as { content: Record<string, { schema: unknown }> }).content["application/json"]!.schema).toEqual({
      type: "object",
      properties: { note: { type: "string", maxLength: 200 } },
      required: ["note"],
      additionalProperties: false,
    })
    // A path part without a schema is still listed.
    expect(doc.paths["/api/storefront/products/{slug}"]!.get!.parameters).toEqual([{ name: "slug", in: "path", required: true, schema: { type: "string" } }])
    expect(doc.paths["/api/storefront/products/{slug}"]!.get!.security).toBeUndefined()
  })

  it("reads mount paths back and groups by area", () => {
    expect(mountPath({ regexp: /^\/api\/admin\/reports\/?(?=\/|$)/i, keys: [] })).toBe("/api/admin/reports")
    expect(mountPath({ regexp: Object.assign(/^\/?(?=\/|$)/i, { fast_slash: true }), keys: [] })).toBe("")
    expect(tagOf("/api/admin/orders/{id}")).toBe("admin · orders")
    expect(tagOf("/api/auth/admin/login")).toBe("auth")
  })

  it("covers the real API: every route documented, every path part listed", async () => {
    const { buildApp } = await import("../../src/app")
    const doc = buildOpenApi(buildApp())
    const ops = Object.entries(doc.paths).flatMap(([p, m]) => Object.values(m).map((o) => ({ p, o })))
    expect(ops.length).toBeGreaterThan(500)
    for (const { p, o } of ops) {
      const names = [...p.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
      const listed = (o.parameters as { name: string; in: string }[]).filter((x) => x.in === "path").map((x) => x.name)
      expect(listed.sort(), p).toEqual(names.sort())
    }
    expect(new Set(ops.map(({ o }) => o.operationId)).size).toBe(ops.length)
  }, 30_000) // loads the whole app, slow when the full suite runs in parallel
})
