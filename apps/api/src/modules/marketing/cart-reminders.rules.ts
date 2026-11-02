/**
 * When abandoned-cart reminders go out. Kept apart from the job so the timing is easy to test.
 */
export interface ReminderSettings {
  enabled: boolean
  firstDelayMinutes: number
  secondEnabled: boolean
  secondDelayHours: number
  couponCode: string | null
  sms: boolean
  email: boolean
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  firstDelayMinutes: 60,
  secondEnabled: false,
  secondDelayHours: 24,
  couponCode: null,
  sms: true,
  email: true,
}

/** Carts older than this aren't reminded at all (the shopper has moved on). */
export const REMIND_WITHIN_DAYS = 7
/** Saved carts nobody touched for this long are deleted. */
export const KEEP_CARTS_DAYS = 60

/** 10pm–8am in Dhaka: no SMS (they wait until morning). */
export function inQuietHours(now: Date): boolean {
  const hour = (now.getUTCHours() + 6) % 24
  return hour >= 22 || hour < 8
}

/** "Cotton Panjabi" or "Cotton Panjabi and 2 more". */
export function cartSummary(names: string[]): string {
  if (!names.length) return "your items"
  return names.length === 1 ? names[0]! : `${names[0]} and ${names.length - 1} more`
}

/**
 * Whether a reminder can go now: during quiet hours one that would include an SMS waits, so the
 * shopper gets nothing at night (an email-only reminder goes any time).
 */
export function canSendNow(s: Pick<ReminderSettings, "sms" | "email">, contact: { phone: string | null; email: string | null }, now: Date) {
  const sms = s.sms && !!contact.phone
  const email = s.email && !!contact.email
  if (!sms && !email) return { send: false as const, sms, email }
  if (sms && inQuietHours(now)) return { send: false as const, sms, email }
  return { send: true as const, sms, email }
}
