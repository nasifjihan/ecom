/**
 * A store's login token only works on that store: one store's staff or customers can't open
 * another store's data by pointing the request at it.
 */
import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import authMiddleware from "../../src/middleware/11-auth";
import { signAccessToken } from "../../src/config/jwt";
import { UserType } from "@ecom/shared-types";

vi.mock("../../src/config/admin-permissions", () => ({
  adminPermissions: async () => ["orders.view"],
  adminStorefronts: async () => [],
  adminNeedsTwoFactor: async () => false,
}));

function run(guard: Parameters<typeof authMiddleware>[0], token: string, requestStore: bigint) {
  const req = {
    ctx: { storeId: requestStore },
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
    originalUrl: "/api/admin/orders",
    get: () => undefined,
  } as unknown as Request;
  return new Promise<{ req: Request; err?: { code?: string } }>((resolve) => {
    const next: NextFunction = (err?: unknown) => resolve({ req, err: err as { code?: string } | undefined });
    void authMiddleware(guard)(req, {} as Response, next);
  });
}

const adminToken = (storeId: string) =>
  signAccessToken({ sub: "7", storeId, type: UserType.STORE_ADMIN, role: "OWNER" } as never, "admin");

describe("store isolation", () => {
  it("accepts an admin token on its own store", async () => {
    const { req, err } = await run("admin", adminToken("1"), 1n);
    expect(err).toBeUndefined();
    expect(req.ctx.admin?.id).toBe(7n);
  });

  it("refuses an admin token on another store", async () => {
    const { req, err } = await run("admin", adminToken("1"), 2n);
    expect(err?.code).toBe("AUTH_INVALID_TOKEN");
    expect(req.ctx.admin).toBeUndefined();
  });

  it("treats another store's customer as signed out on optional routes", async () => {
    const token = signAccessToken({ sub: "9", storeId: "1", type: UserType.CUSTOMER } as never, "customer");
    const { req, err } = await run("optional", token, 2n);
    expect(err).toBeUndefined();
    expect(req.ctx.customer).toBeUndefined();
  });

  it("lets the platform team in on any store", async () => {
    const token = signAccessToken({ sub: "1", type: UserType.PLATFORM_SUPER_ADMIN } as never, "super");
    const { req, err } = await run("adminOrSuper", token, 2n);
    expect(err).toBeUndefined();
    expect(req.ctx.super?.id).toBe(1n);
  });
});
