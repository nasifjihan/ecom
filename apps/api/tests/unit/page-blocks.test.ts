import { describe, expect, it } from "vitest"
import { HomepageDto } from "../../src/modules/content/content.dto"

const ok = (sections: unknown[]) => HomepageDto.safeParse({ sections }).success
const firstError = (sections: unknown[]) => {
  const r = HomepageDto.safeParse({ sections })
  return r.success ? null : r.error.issues[0]!.message
}

describe("page blocks (Batch 38)", () => {
  it("accepts each new block in its default shape", () => {
    expect(
      ok([
        { type: "video", enabled: true, config: { heading: "", url: "https://youtu.be/dQw4w9WgXcQ", caption: "" } },
        { type: "gallery", enabled: true, config: { heading: "Eid looks", columns: 3, images: [{ url: "https://cdn.example.com/a.webp", alt: "Red panjabi", link: "/products" }] } },
        {
          type: "columns",
          enabled: true,
          config: { heading: "", columns: [{ imageUrl: null, heading: "A", text: "x" }, { imageUrl: null, heading: "B", text: "y" }] },
        },
        { type: "button", enabled: true, config: { text: "Shop now", href: "/products", style: "solid", align: "center" } },
        { type: "quote", enabled: true, config: { text: "Fast delivery!", author: "Nusrat", role: "Customer" } },
        {
          type: "product_rail",
          enabled: true,
          config: { heading: "Picked", subheading: "", source: "products", products: [{ id: "12", name: "Panjabi" }], categoryId: null, tag: "", sort: "popular", limit: 8 },
        },
        { type: "category_tiles", enabled: true, config: { heading: "", categoryIds: ["3", "7"] } },
      ]),
    ).toBe(true)
  })

  it("refuses incomplete or unsafe blocks with a message the admin can show", () => {
    expect(firstError([{ type: "video", enabled: true, config: { heading: "", url: "https://example.com/watch", caption: "" } }])).toMatch(/YouTube, Vimeo or Facebook/)
    expect(firstError([{ type: "video", enabled: true, config: { heading: "", url: "javascript:alert(1)", caption: "" } }])).toBeTruthy()
    expect(firstError([{ type: "gallery", enabled: true, config: { heading: "", columns: 3, images: [] } }])).toBe("Add at least one image")
    expect(firstError([{ type: "gallery", enabled: true, config: { heading: "", columns: 5, images: [{ url: "/a.jpg", alt: "", link: null }] } }])).toBeTruthy()
    expect(firstError([{ type: "columns", enabled: true, config: { heading: "", columns: [{ imageUrl: null, heading: "A", text: "" }] } }])).toBeTruthy()
    expect(firstError([{ type: "button", enabled: true, config: { text: "Go", href: "", style: "solid", align: "left" } }])).toBe("Add the button link")
    expect(firstError([{ type: "quote", enabled: true, config: { text: " ", author: "", role: "" } }])).toBe("Add the quote")
    expect(firstError([{ type: "category_tiles", enabled: true, config: { heading: "", categoryIds: [] } }])).toBe("Choose at least one category")
    expect(
      firstError([
        { type: "product_rail", enabled: true, config: { heading: "", subheading: "", source: "products", products: [{ id: "1; drop", name: "x" }], categoryId: null, tag: "", sort: "popular", limit: 8 } },
      ]),
    ).toBeTruthy()
  })
})
