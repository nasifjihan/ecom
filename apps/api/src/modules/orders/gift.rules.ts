/**
 * GIFT ORDERS — an order sent to someone else: the shipping address is the recipient, the billing
 * address is the buyer. The card message and the sender's name print on the packing slip, which
 * leaves prices off unless the buyer asked otherwise.
 */

export const GIFT_MESSAGE_MAX = 300
export const GIFT_MESSAGE_LINES = 8
export const GIFT_FROM_MAX = 60

export interface GiftInput {
  message?: string | null
  from?: string | null
  hidePrices?: boolean
}

export interface GiftFields {
  isGift: boolean
  giftMessage: string | null
  giftFrom: string | null
  giftHidePrices: boolean
}

export const NOT_A_GIFT: GiftFields = { isGift: false, giftMessage: null, giftFrom: null, giftHidePrices: true }

/** Line breaks kept (at most 8 lines), other control characters and extra spaces dropped. */
function tidy(label: string, v: string | null | undefined, max: number, lines: number): string | null {
  const text = (v ?? "")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (!text) return null
  if (text.length > max) throw new GiftProblem(`${label}: keep it to ${max} characters`)
  if (text.split("\n").length > lines) throw new GiftProblem(`${label}: ${lines === 1 ? "keep it on one line" : `keep it to ${lines} lines`}`)
  return text
}

export class GiftProblem extends Error {}

/** The gift fields to save, or a GiftProblem saying what's wrong. */
export function giftFields(gift: GiftInput | null | undefined): GiftFields {
  if (!gift) return NOT_A_GIFT
  return {
    isGift: true,
    giftMessage: tidy("Gift message", gift.message, GIFT_MESSAGE_MAX, GIFT_MESSAGE_LINES),
    giftFrom: tidy("From", gift.from, GIFT_FROM_MAX, 1),
    giftHidePrices: gift.hidePrices !== false,
  }
}
