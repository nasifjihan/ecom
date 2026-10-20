/**
 * SLIDERS: saved sets of hero slides. A hero block on the homepage, a page or a landing page can
 * use one (config.sliderId) instead of its own slides; the slider's slides are filled in when the
 * page is served, so editing a slider changes every page that uses it.
 */
import { z } from "zod"
import { prisma } from "../../config"
import { ConflictError, NotFoundError } from "../../core"
import { HeroSlideDto } from "./content.dto"

export const SliderDto = z.object({
  name: z.string().trim().min(1, "Give the slider a name").max(80),
  slides: z.array(HeroSlideDto).min(1, "Add at least one slide").max(8),
})
export type SliderDto = z.infer<typeof SliderDto>
type Slide = z.infer<typeof HeroSlideDto>

interface HeroLike {
  type: string
  config: unknown
}
const sliderIdOf = (s: HeroLike): string | null => {
  if (s.type !== "hero" || !s.config || typeof s.config !== "object") return null
  const id = (s.config as { sliderId?: unknown }).sliderId
  return typeof id === "string" && /^\d+$/.test(id) ? id : null
}

/**
 * Hero blocks that use a slider get its slides. A block whose slider is gone (or has no valid
 * slides) is left out, rather than shown empty.
 */
export function fillSliders<T extends HeroLike>(sections: T[], sliders: Map<string, Slide[]>): T[] {
  return sections.flatMap((s) => {
    const id = sliderIdOf(s)
    if (id === null) return [s]
    const slides = sliders.get(id)
    return slides?.length ? [{ ...s, config: { ...(s.config as object), slides } }] : []
  })
}

/** The slides of every slider these sections use, by id (only valid slides). */
export async function slidersFor(storeId: bigint, sections: HeroLike[]) {
  const ids = [...new Set(sections.map(sliderIdOf).filter((x): x is string => x !== null))]
  if (!ids.length) return new Map<string, Slide[]>()
  const rows = await prisma.slider.findMany({
    where: { storeId, id: { in: ids.map(BigInt) } },
    select: { id: true, slides: true },
  })
  return new Map(
    rows.map((r) => {
      const ok = z.array(HeroSlideDto).safeParse(r.slides)
      return [String(r.id), ok.success ? ok.data : []]
    }),
  )
}

/** fillSliders with the store's sliders loaded. */
export async function withSliders<T extends HeroLike>(
  storeId: bigint,
  sections: T[],
): Promise<T[]> {
  return fillSliders(sections, await slidersFor(storeId, sections))
}

export class SliderService {
  constructor(private readonly storeId: bigint) {}

  /** Where each slider is used: "Homepage", "Homepage (KIDS)", "Page: About us", "Landing page: Eid offer". */
  private async usage(): Promise<Map<string, string[]>> {
    const [home, pages, landings] = await Promise.all([
      prisma.homepageSection.findMany({
        where: { storeId: this.storeId, type: "hero" },
        select: { config: true, storefront: { select: { code: true } } },
      }),
      prisma.cmsPage.findMany({
        where: { storeId: this.storeId, template: "sections" },
        select: { title: true, sections: true },
      }),
      prisma.landingPage.findMany({
        where: { storeId: this.storeId },
        select: { title: true, sections: true },
      }),
    ])
    const used = new Map<string, string[]>()
    const add = (id: string | null, where: string) => {
      if (id === null) return
      const list = used.get(id) ?? []
      if (!list.includes(where)) used.set(id, [...list, where])
    }
    for (const h of home)
      add(
        sliderIdOf({ type: "hero", config: h.config }),
        h.storefront ? `Homepage (${h.storefront.code})` : "Homepage",
      )
    const blocks = (raw: unknown): HeroLike[] => (Array.isArray(raw) ? (raw as HeroLike[]) : [])
    for (const p of pages)
      for (const b of blocks(p.sections)) add(sliderIdOf(b), `Page: ${p.title}`)
    for (const l of landings)
      for (const b of blocks(l.sections)) add(sliderIdOf(b), `Landing page: ${l.title}`)
    return used
  }

  async list() {
    const [rows, used] = await Promise.all([
      prisma.slider.findMany({ where: { storeId: this.storeId }, orderBy: { name: "asc" } }),
      this.usage(),
    ])
    return rows.map((r) => this.view(r, used.get(String(r.id)) ?? []))
  }

  async get(id: bigint) {
    const r = await prisma.slider.findFirst({ where: { id, storeId: this.storeId } })
    if (!r) throw new NotFoundError("Slider")
    return this.view(r, (await this.usage()).get(String(id)) ?? [])
  }

  async create(d: SliderDto) {
    const r = await prisma.slider.create({
      data: { storeId: this.storeId, name: d.name, slides: d.slides },
    })
    return this.view(r, [])
  }

  async update(id: bigint, d: SliderDto) {
    await this.get(id)
    await prisma.slider.update({ where: { id }, data: { name: d.name, slides: d.slides } })
    return this.get(id)
  }

  /** Refused while a page uses it, so no hero disappears by surprise. */
  async remove(id: bigint) {
    const s = await this.get(id)
    if (s.usedOn.length)
      throw new ConflictError(
        `This slider is used on ${s.usedOn.join(", ")}. Change those blocks first.`,
      )
    await prisma.slider.delete({ where: { id } })
  }

  private view(
    r: { id: bigint; name: string; slides: unknown; updatedAt: Date },
    usedOn: string[],
  ) {
    const ok = z.array(HeroSlideDto).safeParse(r.slides)
    return {
      id: String(r.id),
      name: r.name,
      slides: ok.success ? ok.data : [],
      usedOn,
      updatedAt: r.updatedAt.toISOString(),
    }
  }
}
