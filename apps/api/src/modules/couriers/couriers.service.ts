/**
 * COURIERS — a store's Steadfast / Pathao / RedX accounts, booking parcels with them, and keeping
 * parcel statuses in step with the courier.
 *
 *  - Credentials, webhook secrets and access tokens are stored encrypted and never sent back.
 *  - Booking a ready parcel sends it to the courier and saves the consignment and tracking link.
 *    Pathao needs its city / zone ids and RedX its delivery area id: they are matched from the
 *    order's district and upazila, or chosen by staff when there's no clear match.
 *  - Statuses come back two ways: courier webhooks (which only say "look again": the parcel's
 *    status is always re-read from the courier's API, because a webhook body can't be trusted),
 *    and a scheduled sync of booked parcels (startCourierSync). Each courier status is mapped to our
 *    parcel status and the parcel is walked there, which moves the order and records COD cash.
 */
import { randomBytes, timingSafeEqual } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { decrypt, encrypt, env, logger, prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { FulfilmentService } from "../fulfilment/fulfilment.service"
import {
  COURIER_NAMES,
  courierPhone,
  isCourier,
  mapCourierStatus,
  matchArea,
  parcelPath,
  statusLabel,
  type Courier,
} from "./couriers.rules"
import {
  CourierError,
  type PathaoAdapter,
  type RedxAdapter,
  adapterFor,
  type AccountConfig,
  type BookingInput,
  type CourierAdapter,
} from "./couriers.adapters"
import type { BookParcelDto, BulkBookDto, CreateAccountDto, UpdateAccountDto } from "./couriers.dto"

type Account = Prisma.CourierAccountGetPayload<object>
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const FINAL = ["delivered", "returned", "cancelled"]
/** Parcels checked by one scheduled run, across stores. */
const SYNC_BATCH = 200

/** Which credential fields each courier needs (the settings form asks for these). */
export const CREDENTIAL_FIELDS: Record<Courier, string[]> = {
  steadfast: ["apiKey", "secretKey"],
  pathao: ["clientId", "clientSecret", "username", "password"],
  redx: ["accessToken"],
}

const mask = (v: string) => (v.length <= 4 ? "••••" : `••••${v.slice(-4)}`)
const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
const readJson = <T>(enc: string | null): T | null => {
  if (!enc) return null
  try {
    return JSON.parse(decrypt(enc) ?? "null") as T
  } catch {
    return null
  }
}

export const webhookUrl = (a: { courier: string; webhookToken: string }) =>
  `${env.API_BASE_URL.replace(/\/$/, "")}/api/webhooks/couriers/${a.courier}/${a.webhookToken}`

/** Turns a courier failure into a message staff can act on. */
function courierFail(e: unknown, courier: string): never {
  if (e instanceof CourierError)
    throw new BadRequestError(`${courier}: ${e.message}`, "VALIDATION_FAILED")
  throw e
}

export class CouriersService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  // ================================================================ accounts

  private async account(id: bigint): Promise<Account> {
    const a = await prisma.courierAccount.findFirst({ where: { id, storeId: this.storeId } })
    if (!a) throw new NotFoundError("Courier account", String(id))
    return a
  }

  /** The account as the adapter needs it; refreshed Pathao tokens are saved back (encrypted). */
  private config(a: Account): AccountConfig {
    const credentials = readJson<Record<string, string>>(a.credentials) ?? {}
    return {
      courier: a.courier as Courier,
      mode: a.mode === "sandbox" ? "sandbox" : "live",
      credentials,
      settings: (a.settings as Record<string, unknown> | null) ?? {},
      tokens: readJson(a.tokenCache),
      saveTokens: async (t) => {
        await prisma.courierAccount.update({
          where: { id: a.id },
          data: { tokenCache: encrypt(JSON.stringify(t)) },
        })
      },
    }
  }

  private adapter(a: Account): CourierAdapter {
    try {
      return adapterFor(this.config(a))
    } catch (e) {
      courierFail(e, a.label)
    }
  }

  /** What the settings page shows: never a credential, only its last 4 characters. */
  private view(a: Account, booked = 0) {
    const credentials = readJson<Record<string, string>>(a.credentials) ?? {}
    return {
      id: a.id,
      courier: a.courier,
      courierName: COURIER_NAMES[a.courier as Courier] ?? a.courier,
      label: a.label,
      enabled: a.enabled,
      mode: a.mode,
      settings: a.settings ?? {},
      credentialHints: Object.fromEntries(
        CREDENTIAL_FIELDS[a.courier as Courier].map((k) => [
          k,
          credentials[k] ? mask(credentials[k]) : null,
        ]),
      ),
      webhookUrl: webhookUrl(a),
      webhookSecret: decrypt(a.webhookSecret),
      lastCheckedAt: a.lastCheckedAt,
      lastError: a.lastError,
      activeParcels: booked,
      createdAt: a.createdAt,
    }
  }

  async listAccounts() {
    const rows = await prisma.courierAccount.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ courier: "asc" }, { id: "asc" }],
    })
    const counts = await prisma.shipment.groupBy({
      by: ["courierAccountId"],
      where: {
        storeId: this.storeId,
        courierAccountId: { in: rows.map((r) => r.id) },
        status: { notIn: FINAL },
      },
      _count: { _all: true },
    })
    return rows.map((r) =>
      this.view(r, counts.find((c) => c.courierAccountId === r.id)?._count._all ?? 0),
    )
  }

  /** Enabled accounts for booking dialogs (no secrets, no webhook details). */
  async activeAccounts() {
    const rows = await prisma.courierAccount.findMany({
      where: { storeId: this.storeId, enabled: true },
      orderBy: [{ courier: "asc" }, { id: "asc" }],
    })
    return rows.map((a) => ({
      id: a.id,
      courier: a.courier,
      courierName: COURIER_NAMES[a.courier as Courier],
      label: a.label,
      mode: a.mode,
    }))
  }

  private credentialsFrom(
    courier: Courier,
    given: Record<string, string | undefined>,
    previous: Record<string, string> = {},
  ) {
    const out: Record<string, string> = {}
    for (const k of CREDENTIAL_FIELDS[courier]) {
      const v = given[k]?.trim()
      if (v) out[k] = v
      else out[k] = previous[k] ?? ""
    }
    const missing = CREDENTIAL_FIELDS[courier].filter((k) => !out[k])
    if (missing.length)
      throw new BadRequestError(
        `Enter the ${COURIER_NAMES[courier]} ${missing.join(", ")}`,
        "VALIDATION_FAILED",
      )
    return out
  }

  async createAccount(dto: CreateAccountDto) {
    if (!isCourier(dto.courier)) throw new BadRequestError("Unknown courier", "VALIDATION_FAILED")
    const credentials = this.credentialsFrom(dto.courier, dto.credentials)
    const a = await prisma.courierAccount.create({
      data: {
        storeId: this.storeId,
        courier: dto.courier,
        label: dto.label?.trim().length ? dto.label.trim() : COURIER_NAMES[dto.courier],
        mode: dto.mode,
        enabled: dto.enabled,
        credentials: encrypt(JSON.stringify(credentials))!,
        settings: dto.settings ?? {},
        webhookToken: randomBytes(18).toString("base64url"),
        webhookSecret: encrypt(randomBytes(24).toString("base64url"))!,
      },
    })
    return this.view(a)
  }

  async updateAccount(id: bigint, dto: UpdateAccountDto) {
    const a = await this.account(id)
    const courier = a.courier as Courier
    const credentials = dto.credentials
      ? this.credentialsFrom(courier, dto.credentials, readJson(a.credentials) ?? {})
      : null
    const updated = await prisma.courierAccount.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() || COURIER_NAMES[courier] } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode, tokenCache: null } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.settings !== undefined
          ? {
              settings: {
                ...((a.settings as object) ?? {}),
                ...dto.settings,
              },
            }
          : {}),
        // New credentials: old tokens belong to the old login.
        ...(credentials
          ? {
              credentials: encrypt(JSON.stringify(credentials))!,
              tokenCache: null,
              lastError: null,
            }
          : {}),
      },
    })
    return this.view(updated)
  }

  async deleteAccount(id: bigint) {
    await this.account(id)
    const active = await prisma.shipment.count({
      where: { courierAccountId: id, status: { notIn: FINAL } },
    })
    if (active)
      throw new ConflictError(
        `${active} parcel(s) booked with this account are still on the way; turn it off instead`,
        "VALIDATION_FAILED",
      )
    await prisma.courierAccount.delete({ where: { id } })
    return { deleted: true }
  }

  /** New webhook URL and secret (the old ones stop working). */
  async rotateWebhook(id: bigint) {
    await this.account(id)
    const a = await prisma.courierAccount.update({
      where: { id },
      data: {
        webhookToken: randomBytes(18).toString("base64url"),
        webhookSecret: encrypt(randomBytes(24).toString("base64url"))!,
      },
    })
    return this.view(a)
  }

  async testAccount(id: bigint) {
    const a = await this.account(id)
    let result: string
    try {
      result = await this.adapter(a).test()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await prisma.courierAccount.update({
        where: { id },
        data: { lastCheckedAt: new Date(), lastError: message },
      })
      return { ok: false, message }
    }
    await prisma.courierAccount.update({
      where: { id },
      data: { lastCheckedAt: new Date(), lastError: null },
    })
    return { ok: true, message: result }
  }

  // ================================================================ courier areas

  private async pathao(id: bigint) {
    const a = await this.account(id)
    if (a.courier !== "pathao")
      throw new BadRequestError("Not a Pathao account", "VALIDATION_FAILED")
    return this.adapter(a) as PathaoAdapter
  }

  private async redx(id: bigint) {
    const a = await this.account(id)
    if (a.courier !== "redx") throw new BadRequestError("Not a RedX account", "VALIDATION_FAILED")
    return this.adapter(a) as RedxAdapter
  }

  async pathaoCities(id: bigint) {
    return (await this.pathao(id)).cities().catch((e) => courierFail(e, "Pathao"))
  }
  async pathaoZones(id: bigint, cityId: number) {
    return (await this.pathao(id)).zones(cityId).catch((e) => courierFail(e, "Pathao"))
  }
  async pathaoAreas(id: bigint, zoneId: number) {
    return (await this.pathao(id)).areas(zoneId).catch((e) => courierFail(e, "Pathao"))
  }
  async redxAreas(id: bigint, district?: string) {
    return (await this.redx(id)).areas({ district }).catch((e) => courierFail(e, "RedX"))
  }

  /**
   * The courier's area for an order's address, matched by name (upazila / thana first, then
   * district). null when the courier needs staff to choose.
   */
  async suggestArea(
    accountId: bigint,
    address: { district: string | null; upazila: string | null; division?: string | null },
  ) {
    const a = await this.account(accountId)
    try {
      if (a.courier === "pathao") {
        const api = this.adapter(a) as PathaoAdapter
        const city = matchArea(await api.cities(), (c) => c.name, [
          address.district,
          address.division,
        ])
        if (!city) return { pathao: null }
        const zone = matchArea(await api.zones(city.id), (z) => z.name, [
          address.upazila,
          address.district,
        ])
        return {
          pathao: zone
            ? { cityId: city.id, cityName: city.name, zoneId: zone.id, zoneName: zone.name }
            : { cityId: city.id, cityName: city.name, zoneId: null, zoneName: null },
        }
      }
      if (a.courier === "redx") {
        const api = this.adapter(a) as RedxAdapter
        const areas = await api.areas({ district: address.district ?? undefined })
        const area = matchArea(areas, (x) => x.name, [address.upazila, address.district])
        return { redx: area ? { areaId: area.id, areaName: area.name } : null }
      }
    } catch (e) {
      courierFail(e, a.label)
    }
    return {}
  }

  // ================================================================ booking

  private async parcelForBooking(parcelId: bigint) {
    const s = await prisma.shipment.findFirst({
      where: { id: parcelId, storeId: this.storeId },
      include: {
        items: { include: { orderItem: { select: { productName: true } } } },
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            customerNote: true,
            shippingFirstName: true,
            shippingLastName: true,
            shippingAddress1: true,
            shippingAddress2: true,
            shippingCity: true,
            shippingUpazila: true,
            shippingState: true,
            shippingPhone: true,
            billingPhone: true,
            billingFirstName: true,
            billingLastName: true,
          },
        },
      },
    })
    if (!s) throw new NotFoundError("Parcel", String(parcelId))
    return s
  }

  /** Booking details for a parcel (address, phone, cash, items) before adding the courier's area. */
  private bookingInput(
    s: Awaited<ReturnType<CouriersService["parcelForBooking"]>>,
    a: Account,
    dto: { weightKg?: number; note?: string },
  ): BookingInput {
    const o = s.order
    const phone = courierPhone(o.shippingPhone) ?? courierPhone(o.billingPhone)
    if (!phone)
      throw new BadRequestError(
        `Order ${o.number} has no Bangladeshi mobile number for the courier`,
        "VALIDATION_FAILED",
      )
    const other = courierPhone(o.billingPhone)
    const name = [
      o.shippingFirstName ?? o.billingFirstName,
      o.shippingLastName ?? o.billingLastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
    const address = [o.shippingAddress1, o.shippingAddress2, o.shippingUpazila, o.shippingCity]
      .filter(Boolean)
      .join(", ")
    if (address.length < 10)
      throw new BadRequestError(
        `Order ${o.number} needs a fuller delivery address`,
        "VALIDATION_FAILED",
      )
    const settings = (a.settings as Record<string, unknown> | null) ?? {}
    const qty = s.items.reduce((n, i) => n + i.quantity, 0)
    return {
      invoice: s.code,
      name: name || "Customer",
      phone,
      altPhone: other && other !== phone ? other : null,
      address,
      codAmount: num(s.codAmount),
      weightKg:
        dto.weightKg ?? (s.weightKg ? num(s.weightKg) : Number(settings.defaultWeightKg ?? 0.5)),
      itemCount: Math.max(1, qty),
      description: s.items
        .map((i) => `${i.quantity} x ${i.orderItem.productName}`)
        .join(", ")
        .slice(0, 250),
      note: dto.note ?? s.notes ?? o.customerNote ?? null,
    }
  }

  async bookParcel(parcelId: bigint, dto: BookParcelDto) {
    const a = await this.account(dto.accountId)
    if (!a.enabled) throw new BadRequestError(`${a.label} is turned off`, "VALIDATION_FAILED")
    const s = await this.parcelForBooking(parcelId)
    if (s.consignmentId)
      throw new ConflictError(
        `Parcel ${s.code} is already booked (${s.providerName} ${s.consignmentId})`,
        "VALIDATION_FAILED",
      )
    if (s.status !== "ready")
      throw new ConflictError(
        `Parcel ${s.code} is ${s.status.replace(/_/g, " ")}; only parcels ready to ship can be booked`,
        "VALIDATION_FAILED",
      )
    if (["CANCELLED", "FAILED", "REFUNDED"].includes(s.order.status))
      throw new ConflictError(
        `Order ${s.order.number} is ${s.order.status.toLowerCase()}`,
        "VALIDATION_FAILED",
      )

    const input = this.bookingInput(s, a, dto)
    if (a.courier === "pathao") {
      let p = dto.pathao
      if (!p) {
        const hit = (
          await this.suggestArea(a.id, {
            district: s.order.shippingCity,
            upazila: s.order.shippingUpazila,
            division: s.order.shippingState,
          })
        ).pathao
        if (!hit?.zoneId)
          throw new BadRequestError(
            `Choose the Pathao city and zone for order ${s.order.number}`,
            "VALIDATION_FAILED",
          )
        p = { cityId: hit.cityId, zoneId: hit.zoneId }
      }
      input.pathao = p
    }
    if (a.courier === "redx") {
      let r = dto.redx
      if (!r) {
        const hit = (
          await this.suggestArea(a.id, {
            district: s.order.shippingCity,
            upazila: s.order.shippingUpazila,
          })
        ).redx
        if (!hit)
          throw new BadRequestError(
            `Choose the RedX delivery area for order ${s.order.number}`,
            "VALIDATION_FAILED",
          )
        r = hit
      }
      input.redx = r
    }

    const booked = await this.adapter(a)
      .book(input)
      .catch((e) => courierFail(e, a.label))
    const name = COURIER_NAMES[a.courier as Courier]
    await prisma.$transaction([
      prisma.shipment.update({
        where: { id: s.id },
        data: {
          courierAccountId: a.id,
          providerCode: a.courier,
          providerName: name,
          consignmentId: booked.consignmentId,
          trackingNumber: booked.trackingCode ?? booked.consignmentId,
          trackingUrl: booked.trackingUrl,
          courierStatus: booked.status,
          courierMessage: null,
          bookedAt: new Date(),
          lastSyncedAt: new Date(),
          ...(booked.deliveryFee !== null ? { deliveryFee: booked.deliveryFee } : {}),
          ...(dto.weightKg ? { weightKg: dto.weightKg } : {}),
        },
      }),
      prisma.shipmentEvent.create({
        data: {
          shipmentId: s.id,
          status: s.status,
          note: `Booked with ${name} (${booked.consignmentId})`,
          adminId: this.ctx.admin?.id ?? null,
        },
      }),
    ])
    return new FulfilmentService(this.ctx).getParcel(s.id)
  }

  /**
   * Books many orders with one courier: each order's unbooked ready parcel, or a new parcel with
   * everything not packed yet. One order failing doesn't stop the rest.
   */
  async bulkBook(dto: BulkBookDto) {
    const a = await this.account(dto.accountId)
    const fulfil = new FulfilmentService(this.ctx)
    const results: {
      orderId: string
      number: string
      ok: boolean
      parcel?: string
      consignmentId?: string
      error?: string
    }[] = []
    for (const orderId of dto.orderIds) {
      const o = await prisma.order.findFirst({
        where: { id: orderId, storeId: this.storeId },
        select: { id: true, number: true, shipments: true },
      })
      if (!o) {
        results.push({ orderId: String(orderId), number: "?", ok: false, error: "Order not found" })
        continue
      }
      try {
        let parcel = o.shipments.find((s) => s.status === "ready" && !s.consignmentId)
        const onTheWay = o.shipments.find((s) => s.consignmentId && !FINAL.includes(s.status))
        if (!parcel && onTheWay) {
          const unpacked = await prisma.orderItem.aggregate({
            where: { orderId: o.id },
            _sum: { quantity: true },
          })
          const packed = await prisma.shipmentItem.aggregate({
            where: { shipment: { orderId: o.id, status: { notIn: ["cancelled", "returned"] } } },
            _sum: { quantity: true },
          })
          if ((packed._sum.quantity ?? 0) >= (unpacked._sum.quantity ?? 0)) {
            throw new ConflictError(
              `Already booked with ${onTheWay.providerName} (${onTheWay.consignmentId})`,
              "VALIDATION_FAILED",
            )
          }
        }
        if (!parcel) {
          const created = await fulfil.createParcel(o.id, {
            courierCode: a.courier,
            courierName: COURIER_NAMES[a.courier as Courier],
          })
          parcel = created
        }
        const booked = await this.bookParcel(parcel.id, { accountId: a.id })
        results.push({
          orderId: String(o.id),
          number: o.number,
          ok: true,
          parcel: booked.code,
          consignmentId: booked.consignmentId ?? undefined,
        })
      } catch (e) {
        results.push({
          orderId: String(o.id),
          number: o.number,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
    return {
      booked: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }
  }

  // ================================================================ status sync

  /**
   * Reads a booked parcel's status from its courier and walks the parcel there. Returns what
   * changed; courier errors are recorded on the parcel and returned, not thrown.
   */
  async syncParcel(parcelId: bigint) {
    const s = await prisma.shipment.findFirst({
      where: { id: parcelId, storeId: this.storeId },
      include: { courierAccount: true },
    })
    if (!s) throw new NotFoundError("Parcel", String(parcelId))
    if (!s.consignmentId || !s.courierAccount)
      throw new BadRequestError(`Parcel ${s.code} isn't booked with a courier`, "VALIDATION_FAILED")
    const a = s.courierAccount
    const courier = a.courier as Courier
    let state
    try {
      state = await adapterFor(this.config(a)).status({
        consignmentId: s.consignmentId,
        trackingCode: s.trackingNumber,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await prisma.shipment.update({
        where: { id: s.id },
        data: { lastSyncedAt: new Date(), courierMessage: message },
      })
      return { parcel: s.code, ok: false, error: message }
    }
    const label = statusLabel(state.status)
    await prisma.shipment.update({
      where: { id: s.id },
      data: {
        courierStatus: state.status,
        courierMessage: state.message,
        lastSyncedAt: new Date(),
      },
    })
    const target = mapCourierStatus(courier, state.status, s.status)
    const steps = target && !FINAL.includes(s.status) ? parcelPath(s.status, target) : []
    const fulfil = new FulfilmentService(this.ctx)
    const moved: string[] = []
    for (const step of steps) {
      try {
        await fulfil.moveParcel(s.id, {
          status: step,
          note: `${COURIER_NAMES[courier]}: ${label}${state.message ? ` — ${state.message}` : ""}`,
        })
        moved.push(step)
      } catch (e) {
        logger.warn(
          { err: (e as Error).message, parcel: s.code, step },
          "Parcel not moved with its courier status",
        )
        break
      }
    }
    if (!steps.length && s.courierStatus !== state.status) {
      // A courier status we don't move the parcel for (on hold, …) still goes in its history.
      await prisma.shipmentEvent.create({
        data: { shipmentId: s.id, status: s.status, note: `${COURIER_NAMES[courier]}: ${label}` },
      })
    }
    return { parcel: s.code, ok: true, courierStatus: state.status, moved }
  }

  /** Syncs this store's booked parcels that are still on the way. */
  async syncStore() {
    const rows = await prisma.shipment.findMany({
      where: {
        storeId: this.storeId,
        consignmentId: { not: null },
        courierAccount: { enabled: true },
        status: { notIn: FINAL },
      },
      select: { id: true },
      orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
      take: SYNC_BATCH,
    })
    const results = []
    for (const r of rows) results.push(await this.syncParcel(r.id))
    return {
      checked: results.length,
      moved: results.filter((r) => r.ok && r.moved?.length).length,
      errors: results.filter((r) => !r.ok).length,
      results,
    }
  }

  /** Scheduled run across every store: parcels not checked in the last `minutes`. */
  static async syncDue(minutes: number) {
    const before = new Date(Date.now() - minutes * 60_000)
    const rows = await prisma.shipment.findMany({
      where: {
        consignmentId: { not: null },
        courierAccount: { enabled: true },
        status: { notIn: FINAL },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: before } }],
      },
      select: { id: true, storeId: true },
      orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
      take: SYNC_BATCH,
    })
    let moved = 0
    let errors = 0
    for (const r of rows) {
      try {
        const out = await new CouriersService({ storeId: r.storeId } as RequestContext).syncParcel(
          r.id,
        )
        if (!out.ok) errors++
        else if (out.moved?.length) moved++
      } catch (e) {
        errors++
        logger.warn({ err: (e as Error).message, parcelId: String(r.id) }, "Courier sync failed")
      }
    }
    return { checked: rows.length, moved, errors }
  }

  // ================================================================ webhooks

  /**
   * A courier says something changed. The URL token picks the account; the courier's own secret
   * (Steadfast: Bearer token; Pathao: X-PATHAO-Signature) is checked when it sends one. The body
   * only tells us which parcel: its status is re-read from the courier before anything moves.
   */
  static async webhook(
    courier: string,
    token: string,
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
  ) {
    const a = await prisma.courierAccount.findUnique({ where: { webhookToken: token } })
    if (a?.courier !== courier) throw new NotFoundError("Webhook")
    const secret = decrypt(a.webhookSecret) ?? ""
    const header = (k: string) => {
      const v = headers[k.toLowerCase()]
      return Array.isArray(v) ? (v[0] ?? "") : (v ?? "")
    }
    if (courier === "steadfast") {
      const auth = header("authorization").replace(/^Bearer\s+/i, "")
      if (!auth || !same(auth, secret)) throw new NotFoundError("Webhook")
    }
    if (courier === "pathao") {
      const sig = header("x-pathao-signature")
      if (!sig || !same(sig, secret)) throw new NotFoundError("Webhook")
    }
    const raw = body.consignment_id ?? body.tracking_number ?? body.tracking_id
    const ref = (typeof raw === "string" || typeof raw === "number" ? String(raw) : "").trim()
    if (!ref || !a.enabled) return { handled: false }
    const s = await prisma.shipment.findFirst({
      where: { courierAccountId: a.id, consignmentId: ref },
      select: { id: true },
    })
    if (!s) return { handled: false }
    const out = await new CouriersService({ storeId: a.storeId } as RequestContext).syncParcel(s.id)
    return { handled: true, ...out }
  }
}
