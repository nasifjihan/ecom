import { describe, it, expect } from "vitest"
import {
  mergeTranslations,
  normalizeLocale,
  tr,
  translationsFor,
} from "../../src/core/translations"

describe("translations", () => {
  it.each([
    ["bn", "bn"],
    ["bn-BD", "bn"],
    ["BN", "bn"],
    ["en-US,en;q=0.9", "en"],
    ["fr", "en"],
    ["", "en"],
    [undefined, "en"],
  ])("normalizes %s to %s", (raw, want) => {
    expect(normalizeLocale(raw)).toBe(want)
  })

  const row = {
    name: "Jamdani saree",
    description: "Handwoven",
    translations: { bn: { name: "জামদানি শাড়ি", description: "  " } },
  }

  it("uses the translation when there is one and falls back otherwise", () => {
    expect(tr(row, "bn", "name")).toBe("জামদানি শাড়ি")
    expect(tr(row, "bn", "description")).toBe("Handwoven") // blank counts as missing
    expect(tr(row, "en", "name")).toBe("Jamdani saree")
    expect(tr({ name: "X", translations: null }, "bn", "name")).toBe("X")
    expect(tr({ name: "X", translations: ["bad"] }, "bn", "name")).toBe("X")
  })

  it("reads only string texts", () => {
    expect(translationsFor({ bn: { name: "ক", n: 5, empty: "" } }, "bn")).toEqual({ name: "ক" })
    expect(translationsFor("nope", "bn")).toEqual({})
  })

  it("merges edits: sets, trims, removes blanks and drops empty languages", () => {
    const current = { bn: { name: "পুরনো", description: "বিবরণ" }, xx: { name: "?" } }
    expect(mergeTranslations(current, { bn: { name: " নতুন ", description: "" } })).toEqual({
      bn: { name: "নতুন" },
    })
    expect(mergeTranslations(current, { bn: { name: null, description: undefined } })).toEqual({
      bn: { description: "বিবরণ" },
    })
    expect(mergeTranslations(current, { bn: { name: null, description: null } })).toEqual({})
    expect(mergeTranslations(null, { bn: { name: "শাড়ি" }, fr: { name: "Sari" } })).toEqual({
      bn: { name: "শাড়ি" },
    })
  })
})

describe("store languages", () => {
  it("keeps known languages, always English, and a default that's on", async () => {
    const { cleanLanguages } = await import("../../src/modules/settings/languages")
    expect(cleanLanguages(["bn", "xx"], "bn")).toEqual({ enabled: ["en", "bn"], default: "bn" })
    expect(cleanLanguages([], "bn")).toEqual({ enabled: ["en"], default: "en" }) // bn isn't on
    expect(cleanLanguages(null, null)).toEqual({ enabled: ["en"], default: "en" })
    expect(cleanLanguages(["BN-bd"], "fr")).toEqual({ enabled: ["en", "bn"], default: "en" })
  })
})
