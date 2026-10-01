import { describe, it, expect } from "vitest"
import { giftFields, GiftProblem, NOT_A_GIFT } from "../../src/modules/orders/gift.rules"

describe("gift orders", () => {
  it("isn't a gift without gift details", () => {
    expect(giftFields(undefined)).toEqual(NOT_A_GIFT)
    expect(giftFields(null)).toEqual(NOT_A_GIFT)
  })

  it("keeps the message's lines, tidies spaces and hides prices by default", () => {
    expect(giftFields({ message: "  Happy   Eid!\r\n\r\n\r\nLove,\u0007 Ayesha  ", from: " Ayesha  & Rahim " })).toEqual({
      isGift: true,
      giftMessage: "Happy Eid!\n\nLove, Ayesha",
      giftFrom: "Ayesha & Rahim",
      giftHidePrices: true,
    })
    expect(giftFields({ hidePrices: false })).toEqual({ isGift: true, giftMessage: null, giftFrom: null, giftHidePrices: false })
  })

  it("refuses a message that won't fit the card", () => {
    expect(() => giftFields({ message: "x".repeat(301) })).toThrow(GiftProblem)
    expect(() => giftFields({ message: Array.from({ length: 9 }, (_, i) => `line ${i}`).join("\n") })).toThrow(/8 lines/)
    expect(() => giftFields({ from: "y".repeat(61) })).toThrow(/60 characters/)
  })

  it("takes the sender on one line", () => {
    expect(() => giftFields({ from: "Ayesha\nRahim" })).toThrow(/one line/)
  })
})
