import { describe, expect, it } from "vitest"
import { HomepageSectionDto } from "../../src/modules/content/content.dto"
import { fillSliders } from "../../src/modules/content/sliders"

const slide = (title: string) => ({
  badge: "",
  title,
  subtitle: "",
  ctaText: "Shop",
  ctaHref: "/products",
  imageUrl: null,
  gradient: "violet" as const,
  alignment: "left" as const,
})

describe("hero block", () => {
  it("takes its own slides or a saved slider, but not neither", () => {
    expect(
      HomepageSectionDto.safeParse({
        type: "hero",
        enabled: true,
        config: { slides: [slide("A")] },
      }).success,
    ).toBe(true)
    expect(
      HomepageSectionDto.safeParse({ type: "hero", enabled: true, config: { sliderId: "4" } })
        .success,
    ).toBe(true)
    expect(
      HomepageSectionDto.safeParse({ type: "hero", enabled: true, config: { slides: [] } }).success,
    ).toBe(false)
    expect(
      HomepageSectionDto.safeParse({ type: "hero", enabled: true, config: { sliderId: "x" } })
        .success,
    ).toBe(false)
  })
})

describe("fillSliders", () => {
  const sliders = new Map([["4", [slide("Eid"), slide("Puja")]]])
  it("puts the slider's slides into blocks that use it and leaves the rest alone", () => {
    const out = fillSliders(
      [
        { type: "hero", config: { slides: [], sliderId: "4" } },
        { type: "hero", config: { slides: [slide("Own")] } },
        { type: "features", config: { items: [] } },
      ],
      sliders,
    )
    expect(
      out.map((s) => (s.config as { slides?: { title: string }[] }).slides?.map((x) => x.title)),
    ).toEqual([["Eid", "Puja"], ["Own"], undefined])
  })
  it("leaves out a block whose slider is gone", () => {
    expect(fillSliders([{ type: "hero", config: { slides: [], sliderId: "9" } }], sliders)).toEqual(
      [],
    )
  })
})
