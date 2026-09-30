/**
 * 15 — IDEMPOTENCY (per route, not global): requests that must not happen twice — placing an order,
 * a refund — may carry an `Idempotency-Key` header (8–100 letters, digits, "-" or "_"). The first
 * request with a key runs; a repeat with the same key and the same body gets the first answer back
 * (header `Idempotent-Replayed: true`) instead of placing a second order. A repeat while the first
 * is still running waits for it and gets the same answer (409 only if it takes over 15s); the same
 * key with a different body gets 400. Only successful answers
 * are kept (for a day): after an error the key is freed, so the client can fix it and retry.
 * Without the header a request runs as before.
 */
import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { logger, prisma } from "../config";
import { BadRequestError, ConflictError, type RequestContext } from "../core";

const KEEP_MS = 24 * 60 * 60 * 1000;
const KEY = /^[A-Za-z0-9_-]{8,100}$/;

/** JSON that Postgres can store (BigInts as strings, as the API sends them). */
const plain = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v ?? null, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x))) as Prisma.InputJsonValue;

/**
 * A repeat that arrives while the first is still running (a double click) waits for it — up to
 * WAIT_MS — and gets its answer, instead of an error the customer would see. Null if the first
 * failed (its key is freed) or is still going.
 */
const WAIT_MS = 15_000;
async function waitForFirst(where: { storeId_scope_key: { storeId: bigint; scope: string; key: string } }) {
  for (let waited = 0; waited < WAIT_MS; waited += 250) {
    await new Promise((r) => setTimeout(r, 250));
    const row = await prisma.idempotencyKey.findUnique({ where });
    if (!row) return null;
    if (row.status === "done") return row;
  }
  return null;
}

export default function idempotent(scope: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.get("idempotency-key");
    const storeId = (req as Request & { ctx?: RequestContext }).ctx?.storeId;
    if (!key || storeId === undefined) return next();
    if (!KEY.test(key)) return next(new BadRequestError("Idempotency-Key must be 8–100 letters, digits, - or _", "VALIDATION_FAILED"));
    const where = { storeId_scope_key: { storeId, scope, key } };
    try {
      // The validated body (ids are BigInts by now) fingerprints the request.
      const requestHash = createHash("sha256")
        .update(`${req.method} ${req.baseUrl}${req.path}\n${JSON.stringify(plain(req.body))}`)
        .digest("hex");
      // Now and then, forget keys older than a day.
      if (Math.random() < 0.02) await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      const old = await prisma.idempotencyKey.findUnique({ where });
      if (old && old.expiresAt < new Date()) await prisma.idempotencyKey.delete({ where: { id: old.id } });
      else if (old) {
        if (old.requestHash !== requestHash) {
          return next(new BadRequestError("This Idempotency-Key was already used for a different request", "VALIDATION_FAILED"));
        }
        const done = old.status === "done" ? old : await waitForFirst(where);
        if (!done) return next(new ConflictError("This request is already being processed; wait a moment and reload"));
        res.setHeader("Idempotent-Replayed", "true");
        res.status(done.responseCode ?? 200).json(done.response);
        return;
      }
      await prisma.idempotencyKey.create({ data: { storeId, scope, key, requestHash, expiresAt: new Date(Date.now() + KEEP_MS) } });
    } catch (e) {
      // Two identical requests at the same moment: the one that lost the insert waits for the other.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const done = await waitForFirst(where).catch(() => null);
        if (!done) return next(new ConflictError("This request is already being processed; wait a moment and reload"));
        res.setHeader("Idempotent-Replayed", "true");
        res.status(done.responseCode ?? 200).json(done.response);
        return;
      }
      return next(e);
    }

    // Keep the answer the route sends before it goes out (a quick retry then gets it back); free
    // the key after anything but a success, so the request can be fixed and tried again.
    const send = res.json.bind(res);
    let saved = false;
    res.json = (b: unknown) => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      saved = true;
      const store = ok
        ? prisma.idempotencyKey.update({ where, data: { status: "done", responseCode: res.statusCode, response: plain(b) } })
        : prisma.idempotencyKey.delete({ where });
      store
        .catch((err: unknown) => logger.warn({ err: (err as Error).message, scope }, "Couldn't save an idempotency key"))
        .finally(() => send(b));
      return res;
    };
    // An answer that isn't JSON (or none at all): free the key.
    res.on("finish", () => {
      if (!saved) prisma.idempotencyKey.delete({ where }).catch(() => undefined);
    });
    next();
  };
}
