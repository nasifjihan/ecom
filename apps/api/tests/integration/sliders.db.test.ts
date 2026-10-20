/**
 * Saved sliders used by hero blocks, against a real Postgres. RUN_DB_TESTS=1 only.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("sliders (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Content: typeof import("../../src/modules/content/content.service").ContentService
  let Sliders: typeof import("../../src/modules/content/sliders").SliderService
  let storeId: bigint | undefined
  let ctx: RequestContext
  let sliderId: string
  const suffix = Date.now().toString(36)
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
  const heroTitles = (sections: { type: string; config: unknown }[]) =>
    sections
      .filter((s) => s.type === "hero")
      .map((s) => (s.config as { slides: { title: string }[] }).slides.map((x) => x.title))

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ ContentService: Content } = await import("../../src/modules/content/content.service"))
    ;({ SliderService: Sliders } = await import("../../src/modules/content/sliders"))
    storeId = (
      await prisma.store.create({ data: { name: "Slider Test", slug: `slider-${suffix}` } })
    ).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    sliderId = (
      await new Sliders(storeId).create({ name: "Eid banner", slides: [slide("Eid sale")] })
    ).id
    await new Content(ctx).saveHomepage([
      { type: "hero", enabled: true, config: { slides: [], sliderId } },
      { type: "hero", enabled: true, config: { slides: [slide("Own slide")] } },
    ])
    await prisma.cmsPage.create({
      data: {
        storeId,
        title: "Eid offers",
        slug: `eid-${suffix}`,
        template: "sections",
        sections: [{ type: "hero", enabled: true, config: { slides: [], sliderId } }],
      },
    })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("serves the slider's slides where a hero uses it, next to blocks with their own", async () => {
    expect(heroTitles(await new Content(ctx).publicHomepage())).toEqual([
      ["Eid sale"],
      ["Own slide"],
    ])
    const page = await new Content(ctx).publicPage(`eid-${suffix}`)
    expect(heroTitles(page.sections)).toEqual([["Eid sale"]])
  })

  it("an edit shows everywhere, and the list says where it's used", async () => {
    await new Sliders(storeId!).update(BigInt(sliderId), {
      name: "Eid banner",
      slides: [slide("Eid sale"), slide("Free delivery")],
    })
    expect(heroTitles(await new Content(ctx).publicHomepage())[0]).toEqual([
      "Eid sale",
      "Free delivery",
    ])
    const [s] = await new Sliders(storeId!).list()
    expect(s!.usedOn.sort()).toEqual(["Homepage", "Page: Eid offers"])
  })

  it("can't be deleted while used; once it's gone the hero is left out", async () => {
    await expect(new Sliders(storeId!).remove(BigInt(sliderId))).rejects.toThrow(/used on/)
    await prisma.slider.delete({ where: { id: BigInt(sliderId) } })
    expect(heroTitles(await new Content(ctx).publicHomepage())).toEqual([["Own slide"]])
  })
})
