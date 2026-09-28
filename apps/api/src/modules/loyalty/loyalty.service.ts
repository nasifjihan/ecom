/**
 * LOYALTY SERVICE — settings, levels, each customer's wallet and level, wallet adjustments by
 * staff, referral codes and the referral list. Order hooks live in loyalty.ledger.ts.
 */
import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma, tx } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { loyaltySettings, walletMove } from "./loyalty.ledger"
import { levelFor, nextLevel, referralCode, referralProblem } from "./loyalty.rules"

type T = Prisma.TransactionClient
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const r2 = (v: number) => Math.round(v * 100) / 100
const digits = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10)

export interface SettingsInput {
  walletEnabled?: boolean
  walletMaxPercent?: number
  cashbackEnabled?: boolean
  cashbackPercent?: number
  cashbackMinOrder?: number
  cashbackMaxPerOrder?: number | null
  levelsEnabled?: boolean
  referralEnabled?: boolean
  referrerReward?: number
  refereeReward?: number
  referralMinOrder?: number
}

export interface LevelInput {
  name: string
  minSpend: number
  discountPercent: number
  cashbackPercent: number
  color?: string | null
}

const settingsView = (s: Awaited<ReturnType<typeof loyaltySettings>>) => ({
  walletEnabled: s.walletEnabled,
  walletMaxPercent: n(s.walletMaxPercent),
  cashbackEnabled: s.cashbackEnabled,
  cashbackPercent: n(s.cashbackPercent),
  cashbackMinOrder: n(s.cashbackMinOrder),
  cashbackMaxPerOrder: s.cashbackMaxPerOrder === null ? null : n(s.cashbackMaxPerOrder),
  levelsEnabled: s.levelsEnabled,
  referralEnabled: s.referralEnabled,
  referrerReward: n(s.referrerReward),
  refereeReward: n(s.refereeReward),
  referralMinOrder: n(s.referralMinOrder),
})

const txView = (
  w: Prisma.WalletTransactionGetPayload<object> & { order?: { number: string } | null },
) => ({
  id: String(w.id),
  amount: n(w.amount),
  kind: w.kind,
  note: w.note,
  orderId: w.orderId ? String(w.orderId) : null,
  orderNumber: w.order?.number ?? null,
  balanceAfter: n(w.balanceAfter),
  at: w.createdAt.toISOString(),
})

export class LoyaltyService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : BigInt(this.ctx.admin.id)
  }

  // ================================================================ settings and levels

  async overview() {
    const settings = await tx((t: T) => loyaltySettings(t, this.storeId))
    const [levels, perLevel, wallets, kinds, referrals] = await Promise.all([
      prisma.loyaltyLevel.findMany({
        where: { storeId: this.storeId },
        orderBy: { minSpend: "asc" },
      }),
      prisma.customer.groupBy({
        by: ["loyaltyLevelId"],
        where: { storeId: this.storeId },
        _count: { _all: true },
      }),
      prisma.customer.aggregate({
        where: { storeId: this.storeId, storeCredit: { gt: 0 } },
        _sum: { storeCredit: true },
        _count: { _all: true },
      }),
      prisma.walletTransaction.groupBy({
        by: ["kind"],
        where: { storeId: this.storeId },
        _sum: { amount: true },
      }),
      prisma.affiliateReferral.groupBy({
        by: ["status"],
        where: { affiliate: { storeId: this.storeId } },
        _count: { _all: true },
      }),
    ])
    const sumOf = (k: string) => n(kinds.find((x) => x.kind === k)?._sum.amount)
    return {
      settings: settingsView(settings),
      levels: levels.map((l) => ({
        id: String(l.id),
        name: l.name,
        minSpend: n(l.minSpend),
        discountPercent: n(l.discountPercent),
        cashbackPercent: n(l.cashbackPercent),
        color: l.color,
        customers: perLevel.find((p) => p.loyaltyLevelId === l.id)?._count._all ?? 0,
      })),
      stats: {
        walletBalance: r2(n(wallets._sum.storeCredit)),
        customersWithBalance: wallets._count._all,
        cashbackGiven: r2(sumOf("cashback") + sumOf("cashback_reversed")),
        referralRewards: r2(sumOf("referral")),
        spentFromWallets: r2(-(sumOf("order_payment") + sumOf("order_payment_returned"))),
        referrals: Object.fromEntries(referrals.map((r) => [r.status, r._count._all])),
      },
    }
  }

  async updateSettings(d: SettingsInput) {
    if (
      d.cashbackMaxPerOrder !== undefined &&
      d.cashbackMaxPerOrder !== null &&
      d.cashbackMaxPerOrder <= 0
    )
      throw new BadRequestError("Leave the cashback limit empty for no limit", "VALIDATION_FAILED")
    await tx(async (t: T) => {
      await loyaltySettings(t, this.storeId)
      await t.loyaltySettings.update({ where: { storeId: this.storeId }, data: d })
    })
    return this.overview()
  }

  /** Every customer's level again, after levels changed. */
  private async relevelAll(t: T) {
    await t.$executeRaw`
      UPDATE "Customer" c
      SET "loyaltyLevelId" = (
        SELECT l."id" FROM "LoyaltyLevel" l
        WHERE l."storeId" = c."storeId" AND l."minSpend" <= c."qualifyingSpend"
        ORDER BY l."minSpend" DESC LIMIT 1)
      WHERE c."storeId" = ${this.storeId}`
  }

  async saveLevel(id: bigint | null, d: LevelInput) {
    if (d.discountPercent > 50)
      throw new BadRequestError(
        "A level discount above 50% is almost certainly a typo",
        "VALIDATION_FAILED",
      )
    try {
      await tx(async (t: T) => {
        const data = {
          name: d.name.trim(),
          minSpend: d.minSpend,
          discountPercent: d.discountPercent,
          cashbackPercent: d.cashbackPercent,
          color: d.color ?? null,
        }
        if (id) {
          const found = await t.loyaltyLevel.findFirst({
            where: { id, storeId: this.storeId },
            select: { id: true },
          })
          if (!found) throw new NotFoundError("Level")
          await t.loyaltyLevel.update({ where: { id }, data })
        } else {
          await t.loyaltyLevel.create({ data: { storeId: this.storeId, ...data } })
        }
        await this.relevelAll(t)
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictError(`There's already a level called "${d.name.trim()}"`, "CONFLICT")
      throw e
    }
    return this.overview()
  }

  async deleteLevel(id: bigint) {
    await tx(async (t: T) => {
      await t.loyaltyLevel.deleteMany({ where: { id, storeId: this.storeId } })
      await this.relevelAll(t)
    })
    return this.overview()
  }

  // ================================================================ a customer's wallet and level

  private async customer(customerId: bigint) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, storeId: this.storeId },
      include: {
        loyaltyLevel: true,
        affiliateProfile: {
          select: {
            referralCode: true,
            totalEarned: true,
            _count: { select: { referrals: true } },
          },
        },
        referredByAffiliate: {
          select: {
            referralCode: true,
            customer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    })
    if (!c) throw new NotFoundError("Customer")
    return c
  }

  /** Balance, history, level and referral details of one customer (admin and storefront). */
  async customerLoyalty(customerId: bigint, historyLimit = 50) {
    const [c, settings, levels, history] = await Promise.all([
      this.customer(customerId),
      tx((t: T) => loyaltySettings(t, this.storeId)),
      prisma.loyaltyLevel.findMany({
        where: { storeId: this.storeId },
        orderBy: { minSpend: "asc" },
      }),
      prisma.walletTransaction.findMany({
        where: { customerId },
        orderBy: { id: "desc" },
        take: historyLimit,
      }),
    ])
    const orderIds = [...new Set(history.flatMap((h) => (h.orderId ? [h.orderId] : [])))]
    const orders = orderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, number: true },
        })
      : []
    const spend = n(c.qualifyingSpend)
    const lv = levels.map((l) => ({ ...l, minSpend: n(l.minSpend) }))
    const level = levelFor(spend, lv)
    const next = nextLevel(spend, lv)
    return {
      balance: n(c.storeCredit),
      spend,
      level: level
        ? {
            name: level.name,
            color: level.color,
            discountPercent: n(level.discountPercent),
            cashbackPercent: n(level.cashbackPercent),
          }
        : null,
      next: next
        ? { name: next.level.name, needed: next.needed, minSpend: next.level.minSpend }
        : null,
      levelsEnabled: settings.levelsEnabled,
      referral: {
        code: c.affiliateProfile?.referralCode ?? null,
        earned: n(c.affiliateProfile?.totalEarned),
        friends: c.affiliateProfile?._count.referrals ?? 0,
        referredBy: c.referredByAffiliate
          ? {
              code: c.referredByAffiliate.referralCode,
              customerId: String(c.referredByAffiliate.customer.id),
              name: `${c.referredByAffiliate.customer.firstName} ${c.referredByAffiliate.customer.lastName}`.trim(),
            }
          : null,
      },
      history: history.map((h) =>
        txView({ ...h, order: orders.find((o) => o.id === h.orderId) ?? null }),
      ),
    }
  }

  /** Staff add to or take from a wallet, with a reason. */
  async adjustWallet(customerId: bigint, amount: number, note: string) {
    const c = await this.customer(customerId)
    if (!amount) throw new BadRequestError("Enter an amount", "VALIDATION_FAILED")
    await tx((t: T) =>
      walletMove(t, {
        storeId: this.storeId,
        customerId: c.id,
        amount,
        kind: "adjustment",
        note: note.trim(),
        adminId: this.adminId,
      }),
    )
    return this.customerLoyalty(customerId)
  }

  // ================================================================ referrals

  /** The customer's referral code, made the first time they ask. */
  async myReferral(customerId: bigint) {
    const c = await this.customer(customerId)
    if (!c.affiliateProfile) {
      for (let i = 0; i < 5; i++) {
        const code = referralCode(c.firstName, randomBytes(4).toString("base64url"))
        const clash = await prisma.affiliate.findFirst({
          where: { referralCode: code },
          select: { id: true },
        })
        if (clash) continue
        await prisma.affiliate.create({
          data: {
            storeId: this.storeId,
            customerId: c.id,
            referralCode: code,
            referralUrl: `/?ref=${code}`,
            commissionType: "fixed",
            commissionRate: 0,
          },
        })
        break
      }
    }
    const settings = settingsView(await tx((t: T) => loyaltySettings(t, this.storeId)))
    const [mine, friends] = await Promise.all([
      prisma.affiliate.findUnique({ where: { customerId: c.id } }),
      prisma.affiliateReferral.findMany({
        where: { affiliate: { customerId: c.id } },
        include: { referredCustomer: { select: { firstName: true } } },
        orderBy: { id: "desc" },
        take: 50,
      }),
    ])
    return {
      enabled: settings.referralEnabled,
      code: mine?.referralCode ?? null,
      youGet: settings.referrerReward,
      friendGets: settings.refereeReward,
      minOrder: settings.referralMinOrder,
      earned: n(mine?.totalEarned),
      friends: friends.map((f) => ({
        name: f.referredCustomer?.firstName ?? "A friend",
        status: f.status,
        reward: n(f.commission),
        at: f.createdAt.toISOString(),
      })),
    }
  }

  /** A signed-in customer using a friend's code (from a shared link). */
  async claimReferral(customerId: bigint, rawCode: string) {
    const code = rawCode.trim().toUpperCase()
    const [c, settings, owner, orders] = await Promise.all([
      this.customer(customerId),
      tx((t: T) => loyaltySettings(t, this.storeId)),
      prisma.affiliate.findFirst({
        where: { storeId: this.storeId, referralCode: code, status: "active" },
        include: { customer: { select: { id: true, phone: true } } },
      }),
      prisma.order.count({
        where: { storeId: this.storeId, customerId, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
    ])
    const problem = referralProblem({
      enabled: settings.referralEnabled,
      ownerCustomerId: owner?.customerId ?? null,
      customerId: c.id,
      alreadyReferred: !!c.referredByAffiliateId,
      earlierOrders: orders,
      samePhone:
        !!c.phone && !!owner?.customer.phone && digits(c.phone) === digits(owner.customer.phone),
    })
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
    await tx(async (t: T) => {
      await t.customer.update({ where: { id: c.id }, data: { referredByAffiliateId: owner!.id } })
      await t.affiliateReferral.create({
        data: { affiliateId: owner!.id, referredCustomerId: c.id, status: "signed_up" },
      })
    })
    return {
      ok: true,
      friendGets: n(settings.refereeReward),
      minOrder: n(settings.referralMinOrder),
    }
  }

  async referrals(q: { status?: string; page: number; perPage: number }) {
    const where: Prisma.AffiliateReferralWhereInput = {
      affiliate: { storeId: this.storeId },
      ...(q.status ? { status: q.status } : {}),
    }
    const [total, rows] = await Promise.all([
      prisma.affiliateReferral.count({ where }),
      prisma.affiliateReferral.findMany({
        where,
        include: {
          affiliate: {
            select: {
              referralCode: true,
              customer: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          referredCustomer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          order: { select: { id: true, number: true, status: true } },
        },
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    const name = (c: { firstName: string; lastName: string } | null) =>
      c ? `${c.firstName} ${c.lastName}`.trim() : "—"
    return {
      items: rows.map((r) => ({
        id: String(r.id),
        code: r.affiliate.referralCode,
        referrer: { id: String(r.affiliate.customer.id), name: name(r.affiliate.customer) },
        friend: r.referredCustomer
          ? {
              id: String(r.referredCustomer.id),
              name: name(r.referredCustomer),
              phone: r.referredCustomer.phone,
            }
          : null,
        order: r.order
          ? { id: String(r.order.id), number: r.order.number, status: r.order.status }
          : null,
        status: r.status,
        reward: n(r.commission),
        at: r.createdAt.toISOString(),
        rewardedAt: r.convertedAt?.toISOString() ?? null,
      })),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
      },
    }
  }

  // ================================================================ storefront

  /** The signed-in customer's wallet, level and cashback (account pages and checkout). */
  async forCustomer(customerId: bigint) {
    const [view, settings] = await Promise.all([
      this.customerLoyalty(customerId, 30),
      tx((t: T) => loyaltySettings(t, this.storeId)),
    ])
    const s = settingsView(settings)
    return {
      wallet: { enabled: s.walletEnabled, balance: view.balance, maxPercent: s.walletMaxPercent },
      cashback: {
        enabled: s.cashbackEnabled,
        percent: r2(s.cashbackPercent + (s.levelsEnabled ? (view.level?.cashbackPercent ?? 0) : 0)),
        minOrder: s.cashbackMinOrder,
        maxPerOrder: s.cashbackMaxPerOrder,
      },
      level: s.levelsEnabled ? view.level : null,
      next: s.levelsEnabled ? view.next : null,
      spend: view.spend,
      referral: {
        enabled: s.referralEnabled,
        code: view.referral.code,
        friendGets: s.refereeReward,
        youGet: s.referrerReward,
        referredBy: !!view.referral.referredBy,
      },
      history: view.history,
    }
  }
}
