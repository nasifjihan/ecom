import { describe, expect, it } from "vitest"
import { MAX_REVIEW_PHOTOS, isOwnPhotoKey, reviewPhotoUrls, thumbOf } from "../../src/modules/storefront/review-photos"

const key = (store: number, customer: number, name = "1793500000000-a1b2c3d4e5f6.webp") => `${store}/media/reviews/${customer}/${name}`

describe("review photos", () => {
  it("only takes photos this shopper uploaded to this store", () => {
    expect(isOwnPhotoKey(key(1, 7), 1n, 7n)).toBe(true)
    expect(isOwnPhotoKey(key(1, 8), 1n, 7n)).toBe(false) // another shopper's
    expect(isOwnPhotoKey(key(2, 7), 1n, 7n)).toBe(false) // another store
    expect(isOwnPhotoKey(key(1, 7, "../../products/x.webp"), 1n, 7n)).toBe(false)
    expect(isOwnPhotoKey(key(1, 7, "1793500000000-a1b2c3d4e5f6.svg"), 1n, 7n)).toBe(false)
  })

  it("turns keys into addresses, refusing too many or foreign ones", () => {
    const urls = reviewPhotoUrls(1n, 7n, [key(1, 7), key(1, 7)])
    expect(urls).toHaveLength(1)
    expect(urls[0]).toMatch(/\/1\/media\/reviews\/7\/1793500000000-a1b2c3d4e5f6\.webp$/)
    expect(() => reviewPhotoUrls(1n, 7n, [key(1, 8)])).toThrow()
    const many = Array.from({ length: MAX_REVIEW_PHOTOS + 1 }, (_, i) => key(1, 7, `179350000000${i}-a1b2c3d4e5f6.webp`))
    expect(() => reviewPhotoUrls(1n, 7n, many)).toThrow()
  })

  it("finds the small copy next to a photo", () => {
    expect(thumbOf("https://cdn.example/1/media/reviews/7/a.webp")).toBe("https://cdn.example/1/media/reviews/7/a-thumb.webp")
  })
})
