/**
 * Customer auth flow against a REAL Postgres (no Prisma mocks).
 *
 * Runs only when RUN_DB_TESTS=1 (CI sets it and provisions Postgres); a plain
 * `pnpm test` on a laptop without a database skips this file.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const runDb = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!runDb)("customer auth (Postgres)", () => {
  let app: Express;
  let prisma: typeof import("../../src/config/prisma").prisma;
  let storeId: bigint;
  let otherStoreId: bigint;
  const suffix = Date.now().toString(36);
  const email = `shopper-${suffix}@example.com`;
  const password = "Sup3rSecret!";

  beforeAll(async () => {
    ({ prisma } = await import("../../src/config/prisma"));
    const { buildApp } = await import("../../src/app");
    app = buildApp();
    const store = await prisma.store.create({ data: { name: "Test Store", slug: `test-${suffix}` } });
    const other = await prisma.store.create({ data: { name: "Other Store", slug: `other-${suffix}` } });
    storeId = store.id;
    otherStoreId = other.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.customer.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } });
    await prisma.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
    await prisma.$disconnect();
  });

  const post = (path: string, store: bigint) =>
    request(app).post(path).set("x-store-id", String(store));

  it("registers a customer, stores only a bcrypt hash, and returns a token", async () => {
    const res = await post("/api/auth/customer/register", storeId).send({
      email,
      password,
      firstName: "Rahim",
      lastName: "Uddin",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const row = await prisma.customer.findUniqueOrThrow({
      where: { storeId_email: { storeId, email } },
    });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.passwordHash).not.toContain(password);
  });

  it("rejects a weak password with 422 before touching the database", async () => {
    const res = await post("/api/auth/customer/register", storeId).send({
      email: `weak-${suffix}@example.com`,
      password: "alllowercase",
      firstName: "A",
      lastName: "B",
    });
    expect(res.status).toBe(422);
    expect(await prisma.customer.count({ where: { email: `weak-${suffix}@example.com` } })).toBe(0);
  });

  it("refuses a duplicate email in the same store with 409", async () => {
    const res = await post("/api/auth/customer/register", storeId).send({
      email,
      password,
      firstName: "Dup",
      lastName: "Licate",
    });
    expect(res.status).toBe(409);
  });

  it("scopes customers per store: the same email is not a login in another store", async () => {
    const res = await post("/api/auth/customer/login", otherStoreId).send({ email, password });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong password with 401", async () => {
    const res = await post("/api/auth/customer/login", storeId).send({
      email,
      password: "WrongPassw0rd",
    });
    expect(res.status).toBe(401);
  });

  it("logs in, sets the refresh cookie, and the token loads the profile", async () => {
    const login = await post("/api/auth/customer/login", storeId).send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body.data.accessToken as string;
    expect(String(login.headers["set-cookie"] ?? "")).toMatch(/HttpOnly/i);

    const me = await request(app)
      .get("/api/auth/me/customer")
      .set("x-store-id", String(storeId))
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
    expect(me.body.data.passwordHash).toBeUndefined();

    const row = await prisma.customer.findUniqueOrThrow({
      where: { storeId_email: { storeId, email } },
    });
    expect(row.lastLoginAt).toBeInstanceOf(Date);
  });

  it("does not let a customer token through the admin guard", async () => {
    const login = await post("/api/auth/customer/login", storeId).send({ email, password });
    const res = await request(app)
      .get("/api/auth/me/admin")
      .set("x-store-id", String(storeId))
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(401);
  });
});
