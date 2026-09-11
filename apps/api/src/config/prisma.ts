/**
 * PRISMA CLIENT SINGLETON
 * One connection pool for the entire API. Do NOT new PrismaClient() per request.
 * Includes soft-delete $extends plugin (deletedAt IS NULL filter on find).
 */
import { PrismaClient } from "@prisma/client";
import { env, isDev } from "./env";

const globalPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: isDev ? ["warn", "error"] : ["error"],
  });

if (isDev) globalPrisma.prisma = prisma;

/**
 * Run a set of operations inside a PG transaction.
 * Usage:
 *   const result = await tx((tx) =>
 *     tx.order.create({ data: {...} }).then((o) => tx.orderItem.createMany({...}))
 *   );
 */
export async function tx<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: "ReadCommitted",
  }) as Promise<T>;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
