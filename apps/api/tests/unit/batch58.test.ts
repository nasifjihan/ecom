import { describe, expect, it } from "vitest"
import { cleanSocial, withOtherName } from "../../src/modules/customers/customer.rules"
import { codStillDue, prepaidOf } from "../../src/modules/payments/payments.rules"
import { describe as describeRoute } from "../../src/modules/team/audit"

describe("customer names and profile links", () => {
  const rina = { firstName: "Rina", lastName: "Akter", otherNames: ["Karim Uddin"] }
  it("adds a new name ordered with the phone, but not their own name or one already kept", () => {
    expect(withOtherName(rina, "  Salma   Begum ")).toEqual(["Karim Uddin", "Salma Begum"])
    expect(withOtherName(rina, "rina akter")).toBeNull()
    expect(withOtherName(rina, "Rina")).toBeNull()
    expect(withOtherName(rina, "KARIM UDDIN")).toBeNull()
    expect(withOtherName(rina, " ")).toBeNull()
  })
  it("keeps the last 10 names", () => {
    const many = { ...rina, otherNames: Array.from({ length: 10 }, (_, i) => `Name ${i}`) }
    const out = withOtherName(many, "Newest")!
    expect(out).toHaveLength(10)
    expect(out[9]).toBe("Newest")
  })
  it("drops empty profile links", () => {
    expect(cleanSocial({ facebook: " facebook.com/rina ", instagram: "", tiktok: "  " })).toEqual({ facebook: "facebook.com/rina" })
    expect(cleanSocial({ website: "" })).toBeNull()
  })
})

describe("split payment", () => {
  it("counts checked transfers, online payments and cash as paid before delivery", () => {
    const records = [
      { kind: "transfer", status: "verified", amount: "500" },
      { kind: "cash", status: "verified", amount: 1000 },
      { kind: "transfer", status: "to_verify", amount: 300 },
      { kind: "cod", status: "received", amount: 200 },
    ]
    expect(prepaidOf(records)).toBe(1500)
  })
  it("leaves the courier only what is still due", () => {
    expect(codStillDue(2560, 1500, 0)).toBe(1060)
    expect(codStillDue(2560, 1500, 1060)).toBe(0)
    expect(codStillDue(1000, 1200, 0)).toBe(0)
  })
})

describe("activity log", () => {
  it("names platform team actions like store admin ones", () => {
    expect(describeRoute("POST", "/api/super/stores/:id/impersonate")).toEqual({ action: "stores.impersonate", objectType: "stores" })
    expect(describeRoute("PATCH", "/api/admin/products/:id")).toEqual({ action: "products.update", objectType: "products" })
  })
})
