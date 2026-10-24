/**
 * First start in production: creates the platform owner and nothing else (never the demo seed).
 * The first store and its domains are then added in the super admin (Stores, Domains).
 *   BOOTSTRAP_EMAIL=you@shop.com BOOTSTRAP_PASSWORD='…' pnpm --filter @ecom/api bootstrap
 * Refuses when a platform admin already exists, so it can't be used to add a second owner later.
 */
import bcrypt from "bcryptjs"
import { prisma } from "../src/config/prisma"

/** Why a bootstrap email/password won't do, or null. */
export function bootstrapProblem(email: string | undefined, password: string | undefined): string | null {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return "Set BOOTSTRAP_EMAIL to the platform owner's email"
  if (!password || password.length < 12) return "Set BOOTSTRAP_PASSWORD to at least 12 characters"
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "BOOTSTRAP_PASSWORD needs letters and at least one number"
  return null
}

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_PASSWORD
  const problem = bootstrapProblem(email, password)
  if (problem) throw new Error(problem)
  if ((await prisma.platformAdmin.count()) > 0) {
    throw new Error("A platform admin already exists; nothing to do (add people from the super admin)")
  }
  await prisma.platformAdmin.create({
    data: { email: email!, name: "Platform owner", passwordHash: await bcrypt.hash(password!, 12), role: "super_owner" },
  })
  console.log(`Platform owner ${email} created. Sign in to the super admin, then turn on two-step sign-in (My account).`)
}

// Only when run as a script (the test imports bootstrapProblem).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/bootstrap.ts")) {
  main()
    .catch((err: Error) => {
      console.error(err.message)
      process.exitCode = 1
    })
    .finally(() => void prisma.$disconnect().then(() => process.exit()))
}
