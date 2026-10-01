/**
 * ORDER NUMBERS — the day's date and a 6-digit count (20261001000001), with the store's prefix in
 * front when it has one (FBD-20261001000001). Set under Settings → VAT & invoices.
 */

/** 1–6 letters or digits; stored in capitals without the dash. */
export const ORDER_PREFIX_RE = /^[A-Z0-9]{1,6}$/

/** "fbd-" → "FBD"; "" → null. Anything else that isn't 1–6 letters/digits → undefined (invalid). */
export function cleanOrderPrefix(raw: string | null | undefined): string | null | undefined {
  const v = (raw ?? "").trim().toUpperCase().replace(/-+$/, "")
  if (!v) return null
  return ORDER_PREFIX_RE.test(v) ? v : undefined
}

/** The part every number of that day starts with: "FBD-20261001" or "20261001". */
export function orderNumberStem(prefix: string | null | undefined, day: Date): string {
  const date = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`
  return prefix ? `${prefix}-${date}` : date
}

/** The next number after the day's last one (null when it's the day's first). */
export function nextOrderNumber(stem: string, last: string | null): string {
  const n = last ? Number(last.slice(stem.length)) || 0 : 0
  return `${stem}${String(n + 1).padStart(6, "0")}`
}
