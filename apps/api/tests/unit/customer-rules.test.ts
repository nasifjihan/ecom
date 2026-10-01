import { describe, it, expect } from "vitest"
import { csvCell, isBanned, maskEmail, maySubscribe, newsletterEmail, newsletterToken } from "../../src/modules/customers/customer.rules"

describe("customer rules", () => {
  it("treats banned and suspended customers alike, whatever the case", () => {
    expect(isBanned("BANNED")).toBe(true)
    expect(isBanned("banned")).toBe(true)
    expect(isBanned("SUSPENDED")).toBe(true)
    expect(isBanned("ACTIVE")).toBe(false)
    expect(isBanned("active")).toBe(false)
    expect(isBanned(null)).toBe(false)
  })

  it("cleans newsletter emails", () => {
    expect(newsletterEmail("  Ayesha@Gmail.COM ")).toBe("ayesha@gmail.com")
    expect(newsletterEmail("not-an-email")).toBeNull()
    expect(newsletterEmail("a@b")).toBeNull()
    expect(newsletterEmail("")).toBeNull()
  })

  it("lets only the person bring back an address that unsubscribed", () => {
    expect(maySubscribe(null, "admin")).toEqual({ ok: true })
    expect(maySubscribe({ status: "subscribed" }, "footer")).toEqual({ ok: true })
    expect(maySubscribe({ status: "unsubscribed" }, "footer")).toEqual({ ok: true })
    expect(maySubscribe({ status: "unsubscribed" }, "checkout")).toEqual({ ok: true })
    expect(maySubscribe({ status: "unsubscribed" }, "admin")).toMatchObject({ ok: false })
    expect(maySubscribe({ status: "unsubscribed" }, "import")).toMatchObject({ ok: false })
  })

  it("masks emails, makes unguessable tokens and safe CSV cells", () => {
    expect(maskEmail("ayesha@gmail.com")).toBe("ay***@gmail.com")
    expect(newsletterToken()).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(newsletterToken()).not.toBe(newsletterToken())
    expect(csvCell("Rahman, Ayesha")).toBe('"Rahman, Ayesha"')
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)")
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe("")
  })
})
