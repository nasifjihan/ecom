import { describe as group, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ALL_PERMISSIONS, PERMISSION_AREAS, hasPermission } from "@ecom/shared-types";
import { STORE_ROLE_PERMISSIONS } from "../../src/modules/stores/store-roles";
import { describe, redact } from "../../src/modules/team/audit";

const MODULES = path.resolve(__dirname, "../../src/modules");
// Routes only the platform team reaches (they sign in as "super" and skip permission codes).
const PLATFORM_FILES = new Set(["stores.routes.ts", "users.routes.ts", "platform.routes.ts"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

group("permission catalogue", () => {
  it("has unique area.action codes", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    expect(ALL_PERMISSIONS).toContain("orders.create");
    expect(PERMISSION_AREAS.every((a) => a.actions.length > 0)).toBe(true);
  });

  it("every store-admin route checks a code from the catalogue", () => {
    const bad: string[] = [];
    for (const f of files(MODULES)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/(?:rbacMiddleware|can)\(\s*("[^"]*"|\[[^\]]*\])\s*\)/g)) {
        const codes = [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
        for (const c of codes) {
          if (ALL_PERMISSIONS.includes(c)) continue;
          // The platform team's own routes (super.*, and the store CRUD they run) are exempt.
          if (PLATFORM_FILES.has(path.basename(f)) || c === "super.*") continue;
          if (path.basename(f) === "dashboard.controller.ts" && c === "super.*") continue;
          bad.push(`${path.relative(MODULES, f)}: ${c}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("built-in roles only hold real codes", () => {
    for (const [slug, perms] of Object.entries(STORE_ROLE_PERMISSIONS)) {
      for (const p of perms) expect(p === "*" || ALL_PERMISSIONS.includes(p), `${slug}: ${p}`).toBe(true);
    }
    expect(STORE_ROLE_PERMISSIONS.owner).toEqual(["*"]);
    expect(STORE_ROLE_PERMISSIONS.order_manager).toEqual(expect.arrayContaining(["orders.view", "orders.create", "orders.edit"]));
  });

  it("hasPermission understands *, area.* and exact codes only", () => {
    expect(hasPermission(["*"], "roles.delete")).toBe(true);
    expect(hasPermission(["orders.*"], "orders.edit")).toBe(true);
    expect(hasPermission(["orders.view"], "orders.edit")).toBe(false);
    expect(hasPermission(["orders.view"], "orders.view")).toBe(true);
    // No prefix leaks between areas with similar names.
    expect(hasPermission(["pages.*"], "pages_extra.view")).toBe(false);
    expect(hasPermission([], "dashboard.view")).toBe(false);
  });
});

group("activity log", () => {
  it.each([
    ["POST", "/api/admin/orders/:id/status", "orders.status", "orders"],
    ["PATCH", "/api/admin/products/:id", "products.update", "products"],
    ["POST", "/api/admin/orders/manual", "orders.manual.create", "orders"],
    ["POST", "/api/admin/marketing/coupons/", "marketing.coupons.create", "coupons"],
    ["DELETE", "/api/admin/content/faqs/:id", "content.faqs.delete", "faqs"],
    ["PUT", "/api/admin/locations/:id/delivery", "locations.delivery", "locations"],
    ["POST", "/api/admin/staff/:id/password", "staff.password", "staff"],
  ])("%s %s -> %s", (method, route, action, objectType) => {
    expect(describe(method, route)).toEqual({ action, objectType });
  });

  it("hides secrets and trims big values", () => {
    const out = redact({ name: "Mitu", password: "Secret123!", nested: { apiKey: "k", ok: 1 }, long: "x".repeat(400), list: Array(25).fill(1) }) as any;
    expect(out.password).toBe("[hidden]");
    expect(out.nested).toEqual({ apiKey: "[hidden]", ok: 1 });
    expect(out.long.length).toBe(301);
    expect(out.list).toHaveLength(21);
  });
});
