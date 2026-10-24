/**
 * Turns off two-step sign-in for someone who lost their phone and their backup codes, and ends
 * their sessions. For the platform team (there's no screen to reset each other), and as a last
 * resort for store staff. Run by whoever operates the server:
 *   pnpm --filter @ecom/api two-factor:reset --super ops@platform.dev
 *   pnpm --filter @ecom/api two-factor:reset --admin owner@shop.com --store fashion-bd
 */
import { prisma } from "../src/config/prisma"
import { resetTwoFactor } from "../src/modules/auth/two-factor"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const superEmail = arg("super")
  const adminEmail = arg("admin")
  if (superEmail) {
    const u = await prisma.platformAdmin.findUnique({ where: { email: superEmail } })
    if (!u) throw new Error(`No platform admin ${superEmail}`)
    await resetTwoFactor("super", u.id)
    console.log(`Two-step sign-in is off for ${superEmail} (platform). They sign in with their password now.`)
  } else if (adminEmail) {
    const slug = arg("store")
    if (!slug) throw new Error("Add --store <store slug> for a store admin")
    const store = await prisma.store.findUnique({ where: { slug } })
    if (!store) throw new Error(`No store ${slug}`)
    const u = await prisma.adminUser.findUnique({ where: { storeId_email: { storeId: store.id, email: adminEmail } } })
    if (!u) throw new Error(`No admin ${adminEmail} in ${slug}`)
    await resetTwoFactor("admin", u.id)
    console.log(`Two-step sign-in is off for ${adminEmail} (${slug}). They sign in with their password now.`)
  } else {
    throw new Error("Use --super <email>, or --admin <email> --store <slug>")
  }
}

main()
  .catch((err: Error) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect().then(() => process.exit()))
