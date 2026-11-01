import { describe, expect, it } from "vitest"
import { countOptions, keysFor, parseOptions, type FilterAttribute } from "../../src/modules/storefront/product-options"

const size: FilterAttribute = {
  slug: "size",
  name: "Size",
  type: "select",
  terms: ["S", "M", "L", "XL"].map((name, sortOrder) => ({ name, value: name, sortOrder })),
}
const colour: FilterAttribute = {
  slug: "color",
  name: "Colour",
  type: "color",
  terms: [
    { name: "Red", value: "#dc2626", sortOrder: 0 },
    { name: "Blue", value: "#2563eb", sortOrder: 1 },
  ],
}
const v = (productId: number, attributeValues: Record<string, string>) => ({ productId: BigInt(productId), attributeValues })

describe("product option filters", () => {
  it("reads size:M|L;color:Red and ignores junk", () => {
    expect(parseOptions("Size:M|L| ;color:Red")).toEqual({ size: ["M", "L"], color: ["Red"] })
    expect(parseOptions(":x;nocolon;size:")).toEqual({})
    expect(parseOptions(undefined)).toEqual({})
  })

  it("matches variant keys by slug or name, either case", () => {
    expect(keysFor(colour)).toEqual(["color", "Color", "Colour", "colour"])
  })

  it("counts products (not variants) per value, in the attribute's order, with colour codes", () => {
    const variants = [v(1, { size: "M", color: "Red" }), v(1, { size: "L", color: "Red" }), v(2, { Size: "M", Colour: "Blue" }), v(3, { size: "XXL" })]
    const [sizes, colours] = countOptions([size, colour], variants, {})
    expect(sizes!.values).toEqual([
      { value: "M", count: 2 },
      { value: "L", count: 1 },
      { value: "XXL", count: 1 },
    ])
    expect(colours!.values).toEqual([
      { value: "Red", count: 1, color: "#dc2626" },
      { value: "Blue", count: 1, color: "#2563eb" },
    ])
  })

  it("counts other groups within the chosen options, but not its own group", () => {
    const variants = [v(1, { size: "M", color: "Red" }), v(2, { size: "L", color: "Blue" }), v(3, { size: "M", color: "Blue" })]
    const [sizes, colours] = countOptions([size, colour], variants, { color: ["Blue"] })
    // Only blue variants count for sizes; colours still offer red.
    expect(sizes!.values).toEqual([
      { value: "M", count: 1 },
      { value: "L", count: 1 },
    ])
    expect(colours!.values.map((x) => x.value)).toEqual(["Red", "Blue"])
  })
})
