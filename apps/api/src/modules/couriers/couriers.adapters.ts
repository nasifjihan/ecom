/**
 * COURIER ADAPTERS — Steadfast, Pathao and RedX merchant APIs behind one interface.
 *
 * Request shapes follow each courier's merchant API documentation:
 *  - Steadfast: https://portal.packzy.com/api/v1, headers Api-Key / Secret-Key.
 *  - Pathao:    https://api-hermes.pathao.com (sandbox courier-api-sandbox.pathao.com), OAuth
 *               password grant at /aladdin/api/v1/issue-token, then Bearer tokens.
 *  - RedX:      https://openapi.redx.com.bd/v1.0.0-beta (sandbox sandbox.redx.com.bd), header
 *               API-ACCESS-TOKEN: Bearer <token>.
 * Base URLs can be pointed elsewhere with STEADFAST_BASE_URL / PATHAO_API_URL / REDX_API_URL
 * (used for local testing against a mock). `fetch` is injectable for unit tests.
 */
import { env } from "../../config"
import { trackingUrl, type Courier } from "./couriers.rules"

export type Fetch = typeof fetch

export interface BookingInput {
  /** Our parcel code, sent as the courier's invoice / merchant order id. */
  invoice: string
  name: string
  phone: string
  altPhone?: string | null
  address: string
  codAmount: number
  weightKg: number
  itemCount: number
  description: string
  note?: string | null
  /** Pathao needs its own city / zone (and optionally area) ids. */
  pathao?: { cityId: number; zoneId: number; areaId?: number | null }
  /** RedX needs its delivery area id and name. */
  redx?: { areaId: number; areaName: string }
}

export interface Booked {
  consignmentId: string
  trackingCode: string | null
  trackingUrl: string
  status: string
  deliveryFee: number | null
}

export interface CourierState {
  status: string
  message: string | null
}

export class CourierError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

export interface CourierAdapter {
  /** Checks the credentials; returns something to show (balance, store name, …). */
  test(): Promise<string>
  book(input: BookingInput): Promise<Booked>
  status(ref: { consignmentId: string; trackingCode?: string | null }): Promise<CourierState>
}

/** Credentials and options of one account (decrypted). */
export interface AccountConfig {
  courier: Courier
  mode: "sandbox" | "live"
  credentials: Record<string, string>
  settings: Record<string, unknown>
  /** Pathao: cached tokens, and a callback to store refreshed ones. */
  tokens?: { accessToken: string; refreshToken?: string; expiresAt: number } | null
  saveTokens?: (t: {
    accessToken: string
    refreshToken?: string
    expiresAt: number
  }) => Promise<void>
}

const TIMEOUT_MS = 20_000

/** A JSON value as text (ids come back as numbers or strings); "" for anything else. */
const str = (v: unknown): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : ""
/** A configured base URL, or the default when it's unset or blank. */
const baseUrl = (configured: string | undefined, fallback: string) =>
  (configured?.trim() ? configured.trim() : fallback).replace(/\/$/, "")

async function call(
  f: Fetch,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown },
): Promise<{ status: number; json: Record<string, unknown> }> {
  let res: Response
  try {
    res = await f(url, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const err = e as Error
    throw new CourierError(
      err.name === "TimeoutError"
        ? "The courier didn't answer in time"
        : `Couldn't reach the courier (${err.message})`,
    )
  }
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { message: text.slice(0, 200) }
  }
  return { status: res.status, json }
}

/** The most useful error text a courier sent back. */
function errorText(json: Record<string, unknown>, fallback: string): string {
  const errors = json.errors
  if (errors && typeof errors === "object") {
    const first = Object.values(errors as Record<string, unknown>)[0]
    if (Array.isArray(first) && first[0]) return String(first[0])
    if (typeof first === "string") return first
  }
  for (const k of ["message", "error", "error_message"])
    if (typeof json[k] === "string" && json[k]) return json[k]
  return fallback
}

const need = (c: Record<string, string>, keys: string[], courier: string) => {
  const missing = keys.filter((k) => !c[k])
  if (missing.length) throw new CourierError(`${courier} account is missing: ${missing.join(", ")}`)
}

// ================================================================= Steadfast

export class SteadfastAdapter implements CourierAdapter {
  private readonly base: string
  constructor(
    private readonly cfg: AccountConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["apiKey", "secretKey"], "Steadfast")
    this.base = baseUrl(env.STEADFAST_BASE_URL, "https://portal.packzy.com/api/v1")
  }

  private headers() {
    return {
      "Api-Key": this.cfg.credentials.apiKey!,
      "Secret-Key": this.cfg.credentials.secretKey!,
    }
  }

  async test() {
    const { status, json } = await call(this.f, `${this.base}/get_balance`, {
      headers: this.headers(),
    })
    if (status !== 200 || json.status !== 200)
      throw new CourierError(errorText(json, "Steadfast refused the API key"), status)
    return `Balance ৳${Number(json.current_balance ?? 0).toLocaleString("en-US")}`
  }

  async book(i: BookingInput): Promise<Booked> {
    const body = {
      invoice: i.invoice,
      recipient_name: i.name.slice(0, 100),
      recipient_phone: i.phone,
      ...(i.altPhone ? { alternative_phone: i.altPhone } : {}),
      recipient_address: i.address.slice(0, 250),
      cod_amount: Math.round(i.codAmount),
      note: i.note?.slice(0, 250) ?? "",
      item_description: i.description.slice(0, 250),
      total_lot: i.itemCount,
      delivery_type: 0,
    }
    const { status, json } = await call(this.f, `${this.base}/create_order`, {
      method: "POST",
      headers: this.headers(),
      body,
    })
    const c = json.consignment as Record<string, unknown> | undefined
    if (status !== 200 || json.status !== 200 || !c?.consignment_id)
      throw new CourierError(errorText(json, "Steadfast didn't accept the parcel"), status)
    const trackingCode = c.tracking_code ? str(c.tracking_code) : null
    return {
      consignmentId: str(c.consignment_id),
      trackingCode,
      trackingUrl: trackingUrl("steadfast", { consignmentId: str(c.consignment_id), trackingCode }),
      status: str(c.status ?? "in_review"),
      deliveryFee: null,
    }
  }

  async status(ref: { consignmentId: string }) {
    const { status, json } = await call(
      this.f,
      `${this.base}/status_by_cid/${encodeURIComponent(ref.consignmentId)}`,
      { headers: this.headers() },
    )
    if (status !== 200 || !json.delivery_status)
      throw new CourierError(errorText(json, "Steadfast didn't return the parcel's status"), status)
    return { status: str(json.delivery_status), message: null }
  }
}

// ================================================================= Pathao

interface PathaoPlace {
  id: number
  name: string
}

export class PathaoAdapter implements CourierAdapter {
  private readonly base: string
  constructor(
    private readonly cfg: AccountConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["clientId", "clientSecret", "username", "password"], "Pathao")
    this.base = baseUrl(
      env.PATHAO_API_URL,
      cfg.mode === "sandbox"
        ? "https://courier-api-sandbox.pathao.com"
        : "https://api-hermes.pathao.com",
    )
  }

  private async issue(grant: Record<string, string>) {
    const { status, json } = await call(this.f, `${this.base}/aladdin/api/v1/issue-token`, {
      method: "POST",
      body: {
        client_id: this.cfg.credentials.clientId,
        client_secret: this.cfg.credentials.clientSecret,
        ...grant,
      },
    })
    if (status !== 200 || !json.access_token)
      throw new CourierError(errorText(json, "Pathao refused the credentials"), status)
    const t = {
      accessToken: str(json.access_token),
      refreshToken: json.refresh_token ? str(json.refresh_token) : undefined,
      expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    }
    this.cfg.tokens = t
    await this.cfg.saveTokens?.(t)
    return t.accessToken
  }

  /** A valid access token: the cached one, a refreshed one, or a new login. */
  private async token(): Promise<string> {
    const t = this.cfg.tokens
    if (t && t.expiresAt - 60_000 > Date.now()) return t.accessToken
    if (t?.refreshToken) {
      try {
        return await this.issue({ grant_type: "refresh_token", refresh_token: t.refreshToken })
      } catch {
        // fall through to a fresh login
      }
    }
    return this.issue({
      grant_type: "password",
      username: this.cfg.credentials.username!,
      password: this.cfg.credentials.password!,
    })
  }

  private async get(path: string) {
    const r = await call(this.f, `${this.base}${path}`, {
      headers: { Authorization: `Bearer ${await this.token()}` },
    })
    if (r.status === 401) {
      this.cfg.tokens = null
      return call(this.f, `${this.base}${path}`, {
        headers: { Authorization: `Bearer ${await this.token()}` },
      })
    }
    return r
  }

  private list(json: Record<string, unknown>): Record<string, unknown>[] {
    const d = json.data as { data?: unknown } | undefined
    return Array.isArray(d?.data) ? (d.data as Record<string, unknown>[]) : []
  }

  async stores(): Promise<{ id: number; name: string; isDefault: boolean }[]> {
    const { status, json } = await this.get("/aladdin/api/v1/stores")
    if (status !== 200)
      throw new CourierError(errorText(json, "Pathao didn't list your stores"), status)
    return this.list(json).map((s) => ({
      id: Number(s.store_id),
      name: str(s.store_name),
      isDefault: !!s.is_default_store,
    }))
  }

  async cities(): Promise<PathaoPlace[]> {
    const { status, json } = await this.get("/aladdin/api/v1/city-list")
    if (status !== 200)
      throw new CourierError(errorText(json, "Pathao didn't list its cities"), status)
    return this.list(json).map((c) => ({ id: Number(c.city_id), name: str(c.city_name) }))
  }

  async zones(cityId: number): Promise<PathaoPlace[]> {
    const { status, json } = await this.get(`/aladdin/api/v1/cities/${cityId}/zone-list`)
    if (status !== 200)
      throw new CourierError(errorText(json, "Pathao didn't list the zones"), status)
    return this.list(json).map((z) => ({ id: Number(z.zone_id), name: str(z.zone_name) }))
  }

  async areas(zoneId: number): Promise<PathaoPlace[]> {
    const { status, json } = await this.get(`/aladdin/api/v1/zones/${zoneId}/area-list`)
    if (status !== 200)
      throw new CourierError(errorText(json, "Pathao didn't list the areas"), status)
    return this.list(json).map((a) => ({ id: Number(a.area_id), name: str(a.area_name) }))
  }

  async test() {
    const stores = await this.stores()
    const chosen =
      stores.find((s) => s.id === Number(this.cfg.settings.storeId)) ??
      stores.find((s) => s.isDefault) ??
      stores[0]
    if (!chosen)
      throw new CourierError(
        "Your Pathao account has no store yet; add one in the Pathao merchant panel",
      )
    return `Connected, pickup store "${chosen.name}" (${chosen.id})`
  }

  async book(i: BookingInput): Promise<Booked> {
    if (!i.pathao) throw new CourierError("Choose the Pathao city and zone for this address")
    let storeId = Number(this.cfg.settings.storeId)
    if (!storeId) {
      const stores = await this.stores()
      storeId = (stores.find((s) => s.isDefault) ?? stores[0])?.id ?? 0
      if (!storeId) throw new CourierError("Your Pathao account has no store yet")
    }
    const body = {
      store_id: storeId,
      merchant_order_id: i.invoice,
      recipient_name: i.name.slice(0, 100),
      recipient_phone: i.phone,
      ...(i.altPhone ? { recipient_secondary_phone: i.altPhone } : {}),
      recipient_address: i.address.padEnd(10, " ").slice(0, 220),
      recipient_city: i.pathao.cityId,
      recipient_zone: i.pathao.zoneId,
      ...(i.pathao.areaId ? { recipient_area: i.pathao.areaId } : {}),
      delivery_type: Number(this.cfg.settings.deliveryType ?? 48),
      item_type: Number(this.cfg.settings.itemType ?? 2),
      special_instruction: i.note?.slice(0, 250) ?? "",
      item_quantity: i.itemCount,
      item_weight: Math.min(10, Math.max(0.5, Math.round(i.weightKg * 10) / 10)),
      item_description: i.description.slice(0, 250),
      amount_to_collect: Math.round(i.codAmount),
    }
    const r = await call(this.f, `${this.base}/aladdin/api/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.token()}` },
      body,
    })
    const d = r.json.data as Record<string, unknown> | undefined
    if (r.status !== 200 || !d?.consignment_id)
      throw new CourierError(errorText(r.json, "Pathao didn't accept the parcel"), r.status)
    const consignmentId = str(d.consignment_id)
    return {
      consignmentId,
      trackingCode: consignmentId,
      trackingUrl: trackingUrl("pathao", { consignmentId, phone: i.phone }),
      status: str(d.order_status ?? "Pending"),
      deliveryFee: d.delivery_fee !== undefined ? Number(d.delivery_fee) : null,
    }
  }

  async status(ref: { consignmentId: string }) {
    const { status, json } = await this.get(
      `/aladdin/api/v1/orders/${encodeURIComponent(ref.consignmentId)}/info`,
    )
    const d = json.data as Record<string, unknown> | undefined
    if (status !== 200 || !d?.order_status)
      throw new CourierError(errorText(json, "Pathao didn't return the parcel's status"), status)
    return { status: str(d.order_status), message: null }
  }
}

// ================================================================= RedX

export class RedxAdapter implements CourierAdapter {
  private readonly base: string
  constructor(
    private readonly cfg: AccountConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["accessToken"], "RedX")
    this.base = baseUrl(
      env.REDX_API_URL,
      cfg.mode === "sandbox"
        ? "https://sandbox.redx.com.bd/v1.0.0-beta"
        : "https://openapi.redx.com.bd/v1.0.0-beta",
    )
  }

  private headers() {
    const t = this.cfg.credentials.accessToken!.replace(/^Bearer\s+/i, "")
    return { "API-ACCESS-TOKEN": `Bearer ${t}` }
  }

  async areas(
    q: { district?: string; postCode?: string } = {},
  ): Promise<{ id: number; name: string; district: string | null }[]> {
    const qs = q.postCode
      ? `?post_code=${encodeURIComponent(q.postCode)}`
      : q.district
        ? `?district_name=${encodeURIComponent(q.district)}`
        : ""
    const { status, json } = await call(this.f, `${this.base}/areas${qs}`, {
      headers: this.headers(),
    })
    if (status !== 200 || !Array.isArray(json.areas))
      throw new CourierError(errorText(json, "RedX didn't list its areas"), status)
    return (json.areas as Record<string, unknown>[]).map((a) => ({
      id: Number(a.id),
      name: str(a.name),
      district: a.district_name ? str(a.district_name) : null,
    }))
  }

  async test() {
    const areas = await this.areas({ district: "Dhaka" })
    return `Connected (${areas.length} Dhaka delivery areas)`
  }

  async book(i: BookingInput): Promise<Booked> {
    if (!i.redx) throw new CourierError("Choose the RedX delivery area for this address")
    const body = {
      customer_name: i.name.slice(0, 100),
      customer_phone: i.phone,
      delivery_area: i.redx.areaName,
      delivery_area_id: i.redx.areaId,
      customer_address: i.address.slice(0, 250),
      merchant_invoice_id: i.invoice,
      cash_collection_amount: String(Math.round(i.codAmount)),
      parcel_weight: Math.max(1, Math.round(i.weightKg * 1000)),
      instruction: i.note?.slice(0, 250) ?? "",
      value: Math.round(i.codAmount),
      ...(this.cfg.settings.pickupStoreId
        ? { pickup_store_id: Number(this.cfg.settings.pickupStoreId) }
        : {}),
      parcel_details_json: [
        { name: i.description.slice(0, 100), category: "general", value: Math.round(i.codAmount) },
      ],
    }
    const { status, json } = await call(this.f, `${this.base}/parcel`, {
      method: "POST",
      headers: this.headers(),
      body,
    })
    if ((status !== 200 && status !== 201) || !json.tracking_id)
      throw new CourierError(errorText(json, "RedX didn't accept the parcel"), status)
    const id = str(json.tracking_id)
    return {
      consignmentId: id,
      trackingCode: id,
      trackingUrl: trackingUrl("redx", { consignmentId: id }),
      status: "pickup-pending",
      deliveryFee: null,
    }
  }

  async status(ref: { consignmentId: string }) {
    const { status, json } = await call(
      this.f,
      `${this.base}/parcel/info/${encodeURIComponent(ref.consignmentId)}`,
      { headers: this.headers() },
    )
    const p = json.parcel as Record<string, unknown> | undefined
    if (status !== 200 || !p?.status)
      throw new CourierError(errorText(json, "RedX didn't return the parcel's status"), status)
    return { status: str(p.status), message: null }
  }
}

export function adapterFor(cfg: AccountConfig, f: Fetch = fetch): CourierAdapter {
  switch (cfg.courier) {
    case "steadfast":
      return new SteadfastAdapter(cfg, f)
    case "pathao":
      return new PathaoAdapter(cfg, f)
    case "redx":
      return new RedxAdapter(cfg, f)
  }
}
