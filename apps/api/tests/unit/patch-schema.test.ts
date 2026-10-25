import { describe, expect, it } from "vitest"
import { z } from "zod"
import { patchOf } from "../../src/core/patch-schema"
import { UpdateAdminUserDto } from "../../src/modules/admin-users/users.dto"
import { UpdateProductDto } from "../../src/modules/catalog/catalog.dto"
import { UpdateShippingZoneDto } from "../../src/modules/shipping/shipping.dto"

// Zod 4's .partial() fills .default()s in for fields that weren't sent; an update must not.
describe("patchOf", () => {
  const Create = z.object({
    name: z.string().min(2),
    status: z.enum(["draft", "published"]).default("draft"),
    tags: z.array(z.string()).default([]),
    note: z.string().nullable().default(null),
    codes: z.array(z.string()).default([]).refine((a) => a.every((c) => /^\d{4}$/.test(c)), "Four digits"),
  })
  const Patch = patchOf(Create)

  it("leaves out what wasn't sent", () => expect(Patch.parse({ name: "Silk" })).toEqual({ name: "Silk" }))
  it("keeps the field rules", () => {
    expect(Patch.safeParse({ name: "x" }).success).toBe(false)
    expect(Patch.safeParse({ status: "gone" }).success).toBe(false)
  })
  it("keeps a refine written after the default", () => {
    expect(Patch.safeParse({ codes: ["12"] }).success).toBe(false)
    expect(Patch.parse({ codes: ["1200"] })).toEqual({ codes: ["1200"] })
  })
  it("still takes null where null was allowed", () => expect(Patch.parse({ note: null })).toEqual({ note: null }))

  it.each([
    ["staff", UpdateAdminUserDto, { firstName: "Rahim" }],
    ["product", UpdateProductDto, { name: "Silk saree" }],
    ["delivery zone", UpdateShippingZoneDto, { name: "Dhaka" }],
  ])("a %s update changes only what was sent", (_what, dto, body) => {
    expect((dto as z.ZodType).parse(body)).toEqual(body)
  })
})
