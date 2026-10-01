/**
 * WHO GETS WHICH MESSAGES: the events the team hears about and the customer messages the
 * shop sends, with their built-in defaults. No database here, so it can be tested on its own.
 */

export const STAFF_EVENTS = ["new_order", "payment_to_verify", "return_requested", "quote_request", "low_stock", "lead_assigned"] as const
export type StaffEvent = (typeof STAFF_EVENTS)[number]
export const isStaffEvent = (v: string): v is StaffEvent => (STAFF_EVENTS as readonly string[]).includes(v)

export interface StaffEventInfo {
  label: string
  description: string
  inApp: boolean
  email: boolean
  sms: boolean
  /** Goes to the person the thing is given to, not a chosen list. */
  toAssignee?: boolean
  /** Its email is an existing template (wording on Settings → Emails); otherwise the general "Team alert" email. */
  emailTemplate?: "order_new_admin" | "quote_update_admin"
}

export const STAFF_EVENT_INFO: Record<StaffEvent, StaffEventInfo> = {
  new_order: { label: "New order", description: "A customer places an order on the website or a landing page.", inApp: true, email: true, sms: false, emailTemplate: "order_new_admin" },
  payment_to_verify: { label: "Payment to check", description: "A customer sends a bKash, Nagad, Rocket or bank transaction ID.", inApp: true, email: false, sms: false },
  return_requested: { label: "Return asked for", description: "A customer asks to return an order from their account.", inApp: true, email: true, sms: false },
  quote_request: { label: "Quote request or answer", description: "A business customer asks for a quote, or accepts or declines one.", inApp: true, email: true, sms: false, emailTemplate: "quote_update_admin" },
  low_stock: { label: "Low stock", description: "An order takes a product down to its low-stock level (once a day per product).", inApp: true, email: false, sms: false },
  lead_assigned: { label: "Lead given to you", description: "Someone gives you a lead to follow up.", inApp: true, email: false, sms: false, toAssignee: true },
}

export interface StaffSetting {
  inApp: boolean
  email: boolean
  sms: boolean
  staffIds: bigint[]
}

/** A stored row over the defaults. */
export function staffSetting(event: StaffEvent, row: { inApp: boolean; email: boolean; sms: boolean; staffIds: bigint[] } | null | undefined): StaffSetting {
  const d = STAFF_EVENT_INFO[event]
  return row ? { inApp: row.inApp, email: row.email, sms: row.sms, staffIds: row.staffIds } : { inApp: d.inApp, email: d.email, sms: d.sms, staffIds: [] }
}

/** The staff event whose recipients a staff email template follows. */
export const TEMPLATE_EVENT: Record<string, StaffEvent> = { order_new_admin: "new_order", quote_update_admin: "quote_request" }

/**
 * Who gets an alert: the follower for "given to you" events (unless they did it themselves),
 * the chosen people, or the owners when nobody is chosen. Only active staff.
 */
export function alertRecipients(
  event: StaffEvent,
  setting: StaffSetting,
  staff: { id: bigint; active: boolean; owner: boolean }[],
  opts: { assigneeId?: bigint | null; byId?: bigint | null } = {},
): bigint[] {
  const active = staff.filter((s) => s.active)
  if (STAFF_EVENT_INFO[event].toAssignee) {
    const a = opts.assigneeId
    if (a === undefined || a === null || a === opts.byId) return []
    return active.some((s) => s.id === a) ? [a] : []
  }
  const chosen = setting.staffIds.length ? active.filter((s) => setting.staffIds.includes(s.id)) : active.filter((s) => s.owner)
  return chosen.map((s) => s.id)
}

/** A staff SMS: short, plain letters only, with the store name in front. */
export function staffSmsText(store: string, title: string): string {
  const plain = `${store}: ${title}`
    .replace(/৳\s?/g, "Tk ")
    .replace(/[·–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain
}

// ------------------------------------------------------------------ customers

/** The customer messages, by order step, and the email template / SMS event behind each. */
export const CUSTOMER_EVENTS = [
  { key: "order_placed", label: "Order placed", email: "order_new_customer", sms: "order_placed" },
  { key: "order_confirmed", label: "Order confirmed, on hold or out for delivery", email: "order_status_changed", sms: "order_confirmed" },
  { key: "order_shipped", label: "Order shipped", email: "order_shipped_customer", sms: "order_shipped" },
  { key: "order_delivered", label: "Order delivered", email: "order_delivered_customer", sms: "order_delivered" },
  { key: "order_cancelled", label: "Order cancelled", email: "order_cancelled_customer", sms: "order_cancelled" },
  { key: "order_refunded", label: "Order refunded", email: "order_refunded_customer", sms: null },
  { key: "customer_welcome", label: "Account created", email: "customer_welcome", sms: null },
  { key: "quote_sent", label: "Quote sent to them", email: "quote_sent_customer", sms: null },
] as const
