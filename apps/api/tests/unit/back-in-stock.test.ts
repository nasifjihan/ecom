import { describe, expect, it } from "vitest"
import { contactOf } from "../../src/modules/stock/back-in-stock"

describe("notify me: who to tell", () => {
  it("takes a Bangladeshi mobile in any common form, as 01XXXXXXXXX", () => {
    expect(contactOf("01711-000101")).toBe("01711000101")
    expect(contactOf("+8801711000101")).toBe("01711000101")
  })

  it("takes an email in lower case", () => {
    expect(contactOf("  Rina@Example.COM ")).toBe("rina@example.com")
  })

  it("refuses anything else", () => {
    expect(contactOf("12345")).toBeNull()
    expect(contactOf("rina@")).toBeNull()
    expect(contactOf("<script>@x.y")).toBeNull()
  })
})
