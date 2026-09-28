import { z } from "zod"

const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)
const text = (max: number) => z.string().trim().max(max).refine(noXss, "No HTML please")
const pct = z.coerce.number().min(0).max(100)
const money = z.coerce.number().min(0).max(10_000_000)

export const IdParam = z.object({ id: z.coerce.bigint().positive() })

export const SettingsDto = z
  .object({
    walletEnabled: z.boolean(),
    walletMaxPercent: pct,
    cashbackEnabled: z.boolean(),
    cashbackPercent: pct,
    cashbackMinOrder: money,
    cashbackMaxPerOrder: money.nullable(),
    levelsEnabled: z.boolean(),
    referralEnabled: z.boolean(),
    referrerReward: money,
    refereeReward: money,
    referralMinOrder: money,
  })
  .partial()

export const LevelDto = z.object({
  name: text(40).pipe(z.string().min(2, "Name the level")),
  minSpend: money,
  discountPercent: pct,
  cashbackPercent: pct,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
})

export const WalletAdjustDto = z.object({
  /** + adds to the wallet, − takes from it. */
  amount: z.coerce.number().refine((v) => v !== 0 && Math.abs(v) <= 1_000_000, "Enter an amount"),
  note: text(300).pipe(z.string().min(3, "Say why")),
})

export const ReferralsQuery = z.object({
  status: z.enum(["signed_up", "ordered", "rewarded"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const ClaimDto = z.object({ code: z.string().trim().min(3).max(20) })
