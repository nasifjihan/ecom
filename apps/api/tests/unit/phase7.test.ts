import { describe, expect, it } from "vitest"
import { audienceWhere, personalise } from "../../src/modules/marketing/sms-campaigns.rules"
import { chatButtonOf } from "../../src/modules/storefronts/storefronts.rules"
import { contactProblem } from "../../src/modules/content/contact-messages"
import { smsParts } from "../../src/modules/sms/sms.rules"

describe("SMS campaigns", () => {
  it("puts in the first name, or drops {name} neatly when there is none", () => {
    expect(personalise("Hi {name}, Eid sale is on!", "Rina Akter")).toBe("Hi Rina, Eid sale is on!")
    expect(personalise("Hi {name}, Eid sale is on!", null)).toBe("Hi, Eid sale is on!")
    expect(personalise("Eid sale!", "Rina", "https://shop.test/s/abc")).toBe("Eid sale!\nStop: https://shop.test/s/abc")
  })
  it("keeps a short English offer to one SMS, stop link included", () => {
    expect(smsParts(personalise("Hi {name}, 20% off all panjabis till Friday. Shop: https://shop.test", "Mohammad", "https://shop.test/s/AbCdEf12")).parts).toBe(1)
  })
  it("narrows the customers by each filter given", () => {
    const now = new Date("2026-11-16T05:00:00Z")
    const w = audienceWhere(1n, { lastOrderWithinDays: 30, minSpent: 5000, district: "Dhaka" }, now) as { AND: object[] }
    expect(w.AND).toHaveLength(5)
    expect(w.AND).toContainEqual({ orders: { some: { createdAt: { gte: new Date("2026-10-17T05:00:00Z") } } } })
    expect((audienceWhere(1n, {}, now) as { AND: object[] }).AND).toHaveLength(2)
  })
})

describe("chat button", () => {
  it("keeps a WhatsApp number in wa.me form and a page name from a link", () => {
    expect(chatButtonOf({ enabled: true, whatsapp: "+880 1711-000111", messenger: "https://facebook.com/rinasboutique/", side: "left" })).toEqual({
      enabled: true,
      whatsapp: "8801711000111",
      messenger: "rinasboutique",
      side: "left",
    })
  })
  it("stays off without a usable number or page", () => {
    expect(chatButtonOf({ enabled: true, whatsapp: "12345", messenger: "" }).enabled).toBe(false)
    expect(chatButtonOf(null)).toMatchObject({ enabled: false, side: "right" })
  })
})

describe("contact form", () => {
  it("asks for what each kind of message needs", () => {
    expect(contactProblem({ kind: "question", email: "rina@x.test" })).toBeNull()
    expect(contactProblem({ kind: "question" })).toMatch(/phone or email/)
    expect(contactProblem({ kind: "callback", email: "rina@x.test" })).toMatch(/phone number to call/)
    expect(contactProblem({ kind: "order_problem", phone: "01711000111" })).toMatch(/order number/)
    expect(contactProblem({ kind: "callback", phone: "12345" })).toMatch(/mobile number/)
  })
})
