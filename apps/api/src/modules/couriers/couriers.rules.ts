/**
 * Courier rules with no I/O (table-tested in tests/unit/couriers-rules.test.ts): turning each
 * courier's status words into our parcel statuses, walking a parcel there, matching our delivery
 * areas to a courier's, tracking links, and Code 128 barcodes for labels.
 */
import { PARCEL_NEXT, type ParcelStatus } from "../fulfilment/fulfilment.rules"

export const COURIERS = ["steadfast", "pathao", "redx"] as const
export type Courier = (typeof COURIERS)[number]
export const COURIER_NAMES: Record<Courier, string> = {
  steadfast: "Steadfast",
  pathao: "Pathao",
  redx: "RedX",
}
export const isCourier = (c: string): c is Courier => (COURIERS as readonly string[]).includes(c)

/** "Assigned_for_Delivery", "order.assigned-for-delivery", "assigned for delivery" -> "assigned-for-delivery" */
export const normalizeStatus = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^order\./, "")
    .replace(/[\s_]+/g, "-")

/** "assigned-for-delivery" -> "Assigned for delivery" */
export const statusLabel = (raw: string) => {
  const s = normalizeStatus(raw).replace(/-/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Target = ParcelStatus | "cancel_or_return" | null

const STEADFAST: Record<string, Target> = {
  "in-review": "ready",
  pending: "in_transit",
  hold: null,
  "delivered-approval-pending": "delivered",
  "partial-delivered-approval-pending": "delivered",
  delivered: "delivered",
  "partial-delivered": "delivered",
  "cancelled-approval-pending": "cancel_or_return",
  cancelled: "cancel_or_return",
  "unknown-approval-pending": null,
  unknown: null,
}

const PATHAO: Record<string, Target> = {
  created: "ready",
  "order-created": "ready",
  pending: "ready",
  "pickup-requested": "ready",
  "assigned-for-pickup": "ready",
  picked: "picked_up",
  "pickup-failed": null,
  "pickup-cancelled": "cancelled",
  "at-the-sorting-hub": "in_transit",
  "in-transit": "in_transit",
  "received-at-last-mile-hub": "in_transit",
  "assigned-for-delivery": "out_for_delivery",
  delivered: "delivered",
  "partial-delivery": "delivered",
  "delivery-failed": "failed",
  return: "returned",
  returned: "returned",
  "paid-return": "returned",
  "on-hold": null,
  updated: null,
  "order-updated": null,
  paid: null,
  "payment-invoice": null,
  exchange: null,
  exchanged: null,
}

const REDX: Record<string, Target> = {
  "pickup-pending": "ready",
  "ready-for-delivery": "in_transit",
  "delivery-in-progress": "out_for_delivery",
  delivered: "delivered",
  "agent-hold": null,
  "agent-area-change": null,
  "agent-returning": "failed",
  returned: "returned",
  "pickup-cancelled": "cancelled",
  cancelled: "cancel_or_return",
}

const MAPS: Record<Courier, Record<string, Target>> = {
  steadfast: STEADFAST,
  pathao: PATHAO,
  redx: REDX,
}

/**
 * Our parcel status for a courier's status word, or null when it doesn't move the parcel (on hold,
 * unknown, payment events). A cancellation before pickup cancels the parcel; after pickup it's
 * coming back to the shop.
 */
export function mapCourierStatus(
  courier: Courier,
  raw: string,
  current: string,
): ParcelStatus | null {
  const t = MAPS[courier][normalizeStatus(raw)] ?? null
  if (t === "cancel_or_return") return current === "ready" ? "cancelled" : "returned"
  return t
}

/**
 * Steps from one parcel status to another along the allowed moves (empty when already there or
 * unreachable). Couriers can skip steps we track, e.g. report "delivered" for a parcel we still have
 * as ready. Failed and cancelled are never used as stepping stones.
 */
export function parcelPath(from: string, to: string): ParcelStatus[] {
  if (from === to) return []
  const seen = new Set<string>([from])
  const queue: ParcelStatus[][] = [[from as ParcelStatus]]
  while (queue.length) {
    const path = queue.shift()!
    for (const next of PARCEL_NEXT[path[path.length - 1]!] ?? []) {
      if (seen.has(next)) continue
      const p = [...path, next]
      if (next === to) return p.slice(1)
      if (next === "failed" || next === "cancelled") continue
      seen.add(next)
      queue.push(p)
    }
  }
  return []
}

// ------------------------------------------------------------------ area matching

const NOISE =
  /\b(sadar|city|thana|upazila|upozila|zila|district|metro|corporation|pourashava|model)\b/g
/** "Cox's Bazar Sadar" -> "coxsbazar", "Chattogram" / "Chittagong" -> "chattogram" */
export function areaKey(name: string): string {
  const k = name
    .toLowerCase()
    .replace(NOISE, "")
    .replace(/[^a-z0-9]/g, "")
  return ALIASES[k] ?? k
}
/** Old and new spellings couriers still mix. */
const ALIASES: Record<string, string> = {
  chittagong: "chattogram",
  comilla: "cumilla",
  barisal: "barishal",
  jessore: "jashore",
  bogra: "bogura",
  mymensingh: "mymensingh",
  chapainawabganj: "chapainawabganj",
  nawabganj: "chapainawabganj",
}

/**
 * The option whose name matches one of `names` (most specific first): exact after clean-up, then
 * one containing the other. Returns null when nothing is close enough to book without asking.
 */
export function matchArea<T>(
  options: T[],
  nameOf: (o: T) => string,
  names: (string | null | undefined)[],
): T | null {
  const keys = names
    .filter((n): n is string => !!n?.trim())
    .map(areaKey)
    .filter(Boolean)
  for (const k of keys) {
    const exact = options.find((o) => areaKey(nameOf(o)) === k)
    if (exact) return exact
  }
  for (const k of keys) {
    if (k.length < 4) continue
    const loose = options.filter((o) => {
      const ok = areaKey(nameOf(o))
      return ok.length >= 4 && (ok.includes(k) || k.includes(ok))
    })
    if (loose.length === 1) return loose[0]!
  }
  return null
}

// ------------------------------------------------------------------ tracking

export function trackingUrl(
  courier: Courier,
  ref: { consignmentId: string; trackingCode?: string | null; phone?: string | null },
): string {
  switch (courier) {
    case "steadfast":
      return `https://steadfast.com.bd/t/${encodeURIComponent(ref.trackingCode ?? ref.consignmentId)}`
    case "pathao":
      return `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(ref.consignmentId)}${ref.phone ? `&phone=${encodeURIComponent(ref.phone)}` : ""}`
    case "redx":
      return `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(ref.consignmentId)}`
  }
}

/** Couriers want 01XXXXXXXXX; returns null when it isn't a Bangladeshi mobile number. */
export function courierPhone(v: string | null | undefined): string | null {
  if (!v) return null
  const d = v.replace(/[^\d]/g, "").replace(/^(?:00)?880/, "0")
  const n = d.length === 10 && d.startsWith("1") ? `0${d}` : d
  return /^01[3-9]\d{8}$/.test(n) ? n : null
}

// ------------------------------------------------------------------ Code 128 (set B)

/** Bar widths for symbol values 0–106 (each 6 elements: bar, space, … ; 106 = stop, 7 elements). */
const PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
]

/**
 * Module widths (bar, space, bar, …) for `text` in Code 128 set B, with start, check and stop
 * symbols. Characters outside ASCII 32–126 are replaced by "?".
 */
export function code128(text: string): number[] {
  const values = Array.from(text, (c) => {
    const code = c.charCodeAt(0)
    return code >= 32 && code <= 126 ? code - 32 : 31
  })
  const START_B = 104
  let sum = START_B
  values.forEach((v, i) => (sum += v * (i + 1)))
  const symbols = [START_B, ...values, sum % 103, 106]
  return symbols.flatMap((s) => Array.from(PATTERNS[s]!, Number))
}
