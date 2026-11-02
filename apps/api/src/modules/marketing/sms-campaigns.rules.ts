/**
 * SMS campaign rules (no database): who a campaign goes to, and the text each person gets.
 */
import type { Prisma } from "@prisma/client"
import { z } from "zod"

export const AudienceDto = z.object({
  /** Ordered in the last N days. */
  lastOrderWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
  /** Ordered before, but not in the last N days (to win back). */
  noOrderForDays: z.coerce.number().int().min(1).max(3650).optional(),
  /** Spent at least this much in all. */
  minSpent: z.coerce.number().min(0).max(100_000_000).optional(),
  /** Has an address in this district. */
  district: z.string().trim().max(80).optional(),
  /** On this loyalty level. */
  levelId: z.coerce.bigint().positive().optional(),
})
export type Audience = z.infer<typeof AudienceDto>

const DAY = 86_400_000

/** The customers a campaign goes to: active ones with a phone, narrowed by the filters. */
export function audienceWhere(storeId: bigint, a: Audience, now: Date): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [{ storeId, phone: { not: null } }, { NOT: { status: { in: ["banned", "BANNED"] } } }]
  if (a.lastOrderWithinDays) and.push({ orders: { some: { createdAt: { gte: new Date(+now - a.lastOrderWithinDays * DAY) } } } })
  if (a.noOrderForDays) and.push({ orderCount: { gt: 0 } }, { orders: { none: { createdAt: { gte: new Date(+now - a.noOrderForDays * DAY) } } } })
  if (a.minSpent) and.push({ totalSpent: { gte: a.minSpent } })
  if (a.district) and.push({ addresses: { some: { city: { equals: a.district, mode: "insensitive" } } } })
  if (a.levelId) and.push({ loyaltyLevelId: a.levelId })
  return { AND: and }
}

/** The message for one person: {name} becomes their first name (or goes, with the space before it). */
export function personalise(body: string, firstName: string | null | undefined, stopUrl?: string) {
  const name = firstName?.trim().split(/\s+/)[0] ?? ""
  const text = (name ? body.replace(/\{name\}/g, name) : body.replace(/ ?\{name\}/g, "")).trim()
  return stopUrl ? `${text}\nStop: ${stopUrl}` : text
}

/** What staff see before sending: the longest likely message (a long name and the stop link). */
export const sampleText = (body: string, stopLink: boolean) => personalise(body, "Mohammad", stopLink ? "https://shop.example.com/s/AbCdEf12" : undefined)
