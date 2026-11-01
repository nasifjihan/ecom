import { describe, expect, it } from "vitest"
import { SearchWordsDto, expandQuery } from "../../src/modules/search/shop-search"

const groups = [
  ["panjabi", "punjabi"],
  ["saree", "sari", "শাড়ি"],
]

describe("shop search words", () => {
  it("tries the whole search and each word's same-meaning words", () => {
    expect(expandQuery("  Punjabi ", groups)).toEqual(["punjabi", "panjabi"])
    expect(expandQuery("red   punjabi", groups)).toEqual(["red punjabi", "red panjabi"])
    expect(expandQuery("sari", groups)).toEqual(["sari", "saree", "শাড়ি"])
    expect(expandQuery("kurta", groups)).toEqual(["kurta"])
  })

  it("never tries more than 12 versions", () => {
    const big = [Array.from({ length: 20 }, (_, i) => `w${i}`)]
    expect(expandQuery("w0", big)).toHaveLength(12)
  })

  it("cleans the saved groups and refuses ones with a single word", () => {
    const ok = SearchWordsDto.parse({ groups: [[" Panjabi", "PUNJABI ", "panjabi"]] })
    expect(ok.groups).toEqual([["panjabi", "punjabi"]])
    expect(SearchWordsDto.safeParse({ groups: [["saree", "Saree"]] }).success).toBe(false)
  })
})
