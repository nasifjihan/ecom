import { describe, it, expect } from "vitest"
import {
  canCancel,
  canEdit,
  canRespond,
  canSend,
  endOfDay,
  isExpired,
  nextQuoteNumber,
  orderBlocker,
  quoteTotals,
  viewStatus,
} from "../../src/modules/wholesale/quotation.rules"

const now = new Date("2026-10-01T06:00:00Z")
const past = new Date("2026-09-30T00:00:00Z")
const later = new Date("2026-10-05T00:00:00Z")

describe("quote status", () => {
  it("reads a sent quote past its date as expired", () => {
    expect(isExpired("SENT", past, now)).toBe(true)
    expect(isExpired("SENT", later, now)).toBe(false)
    expect(isExpired("SENT", null, now)).toBe(false)
    expect(isExpired("ACCEPTED", past, now)).toBe(false)
    expect(viewStatus("SENT", past, now)).toBe("EXPIRED")
    expect(viewStatus("DRAFT", past, now)).toBe("DRAFT")
  })

  it("is valid through the whole last day, Dhaka time", () => {
    expect(endOfDay("2026-09-30").toISOString()).toBe("2026-09-30T17:59:59.999Z")
  })

  it("allows the right moves", () => {
    expect(canEdit("SENT")).toBe(true)
    expect(canEdit("ORDERED")).toBe(false)
    expect(canSend("DRAFT")).toBe(true)
    expect(canSend("ACCEPTED")).toBe(false)
    expect(canCancel("ACCEPTED")).toBe(true)
    expect(canCancel("ORDERED")).toBe(false)
    expect(canRespond("SENT", later, now)).toBe(true)
    expect(canRespond("SENT", past, now)).toBe(false)
    expect(canRespond("DRAFT", later, now)).toBe(false)
  })

  it("says why a quote can't become an order", () => {
    expect(orderBlocker("ACCEPTED", past, now)).toBeNull()
    expect(orderBlocker("SENT", later, now)).toBeNull()
    expect(orderBlocker("SENT", past, now)).toMatch(/expired/)
    expect(orderBlocker("DRAFT", null, now)).toMatch(/Send the quote/)
    expect(orderBlocker("ORDERED", null, now)).toMatch(/already an order/)
    expect(orderBlocker("DECLINED", null, now)).toMatch(/declined/)
  })
})

describe("quote money", () => {
  it("adds up lines, discount and delivery", () => {
    const t = quoteTotals(
      [
        { qty: 10, unitPrice: 3000, listPrice: 3090 },
        { qty: 3, unitPrice: 499.5, listPrice: 499.5 },
      ],
      500,
      150,
    )
    expect(t).toEqual({ subtotal: 31498.5, discount: 500, deliveryFee: 150, total: 31148.5, listTotal: 32398.5, offPercent: 4.3 })
  })

  it("never takes off more than the items cost", () => {
    expect(quoteTotals([{ qty: 1, unitPrice: 100, listPrice: 100 }], 500, 0)).toMatchObject({ discount: 100, total: 0 })
    expect(quoteTotals([], 0, 0)).toMatchObject({ subtotal: 0, total: 0, offPercent: 0 })
  })

  it("numbers quotes in order", () => {
    expect(nextQuoteNumber(null)).toBe("Q-000001")
    expect(nextQuoteNumber("Q-000041")).toBe("Q-000042")
  })
})
