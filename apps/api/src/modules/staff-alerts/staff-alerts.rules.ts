/**
 * WHO GETS WHICH MESSAGES: the events the team hears about and the customer messages the
 * shop sends, with their built-in defaults. No database here, so it can be tested on its own.
 */

export const STAFF_EVENTS = [
  "new_order",
  "payment_to_verify",
  "payment_review",
  "return_requested",
  "quote_request",
  "low_stock",
  "lead_assigned",
  "review_waiting",
  "question_waiting",
  "courier_problem",
  "report_failed",
  "job_failed",
] as const
export type StaffEvent = (typeof STAFF_EVENTS)[number]
export const isStaffEvent = (v: string): v is StaffEvent => (STAFF_EVENTS as readonly string[]).includes(v)

export interface StaffEventInfo {
  label: string
  description: string
  inApp: boolean
  email: boolean
  sms: boolean
  /** To staff who turned on WhatsApp alerts on their profile (off by default for every event). */
  whatsapp?: boolean
  /** Goes to the person the thing is given to, not a chosen list. */
  toAssignee?: boolean
  /** Its email is an existing template (wording on Settings → Emails); otherwise the general "Team alert" email. */
  emailTemplate?: "order_new_admin" | "quote_update_admin"
}

export const STAFF_EVENT_INFO: Record<StaffEvent, StaffEventInfo> = {
  new_order: { label: "New order", description: "A customer places an order on the website or a landing page.", inApp: true, email: true, sms: false, emailTemplate: "order_new_admin" },
  payment_to_verify: { label: "Payment to check", description: "A customer sends a bKash, Nagad, Rocket or bank transaction ID.", inApp: true, email: false, sms: false },
  payment_review: { label: "Online payment needs a check", description: "A gateway took money but something didn't match (amount, order or a bank flag), so the order wasn't marked paid.", inApp: true, email: true, sms: false },
  return_requested: { label: "Return asked for", description: "A customer asks to return an order from their account.", inApp: true, email: true, sms: false },
  quote_request: { label: "Quote request or answer", description: "A business customer asks for a quote, or accepts or declines one.", inApp: true, email: true, sms: false, emailTemplate: "quote_update_admin" },
  low_stock: { label: "Low stock", description: "An order takes a product down to its low-stock level (once a day per product).", inApp: true, email: false, sms: false },
  lead_assigned: { label: "Lead given to you", description: "Someone gives you a lead to follow up.", inApp: true, email: false, sms: false, toAssignee: true },
  review_waiting: { label: "Review to approve", description: "A customer who hasn't bought the product writes a review (it waits for approval).", inApp: true, email: false, sms: false },
  question_waiting: { label: "Product question", description: "A customer asks a question on a product page.", inApp: true, email: false, sms: false },
  courier_problem: { label: "Courier problem", description: "Delivery failed, a parcel is coming back, or a booked parcel has had no courier update for 3 days.", inApp: true, email: true, sms: false },
  // Bell only by default: an emailed alert about a failed email could fail the same way.
  job_failed: { label: "Email couldn't be sent", description: "An email to a customer or the team failed after every retry (e.g. the mail provider refused it).", inApp: true, email: false, sms: false },
  report_failed: { label: "Scheduled report stopped", description: "A scheduled report email failed 3 times in a row and was switched off (Reports > Scheduled emails).", inApp: true, email: true, sms: false },
}

export interface StaffSetting {
  inApp: boolean
  email: boolean
  sms: boolean
  whatsapp: boolean
  staffIds: bigint[]
}

/** A stored row over the defaults. */
export function staffSetting(
  event: StaffEvent,
  row: { inApp: boolean; email: boolean; sms: boolean; whatsapp: boolean; staffIds: bigint[] } | null | undefined,
): StaffSetting {
  const d = STAFF_EVENT_INFO[event]
  return row
    ? { inApp: row.inApp, email: row.email, sms: row.sms, whatsapp: row.whatsapp, staffIds: row.staffIds }
    : { inApp: d.inApp, email: d.email, sms: d.sms, whatsapp: d.whatsapp ?? false, staffIds: [] }
}

/** The WhatsApp template team alerts use ({{1}} shop name, {{2}} the alert), made once in WhatsApp Manager. */
export const STAFF_WA_TEMPLATE = { name: "staff_alert", language: "en" } as const

/** Parcels with no courier update for this long get a "courier problem" alert. */
export const PARCEL_STUCK_DAYS = 3

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

/** The customer messages, by order step, and the email template / SMS / WhatsApp event behind each. */
export const CUSTOMER_EVENTS = [
  { key: "order_placed", label: "Order placed", email: "order_new_customer", sms: "order_placed", whatsapp: "order_placed" },
  { key: "order_confirmed", label: "Order confirmed, on hold or out for delivery", email: "order_status_changed", sms: "order_confirmed", whatsapp: "order_confirmed" },
  { key: "order_shipped", label: "Order shipped", email: "order_shipped_customer", sms: "order_shipped", whatsapp: "order_shipped" },
  { key: "order_delivered", label: "Order delivered", email: "order_delivered_customer", sms: "order_delivered", whatsapp: "order_delivered" },
  { key: "order_cancelled", label: "Order cancelled", email: "order_cancelled_customer", sms: "order_cancelled", whatsapp: "order_cancelled" },
  { key: "order_refunded", label: "Order refunded", email: "order_refunded_customer", sms: null, whatsapp: null },
  { key: "customer_welcome", label: "Account created", email: "customer_welcome", sms: null, whatsapp: null },
  { key: "quote_sent", label: "Quote sent to them", email: "quote_sent_customer", sms: null, whatsapp: null },
] as const
