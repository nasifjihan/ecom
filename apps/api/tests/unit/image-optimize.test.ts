import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { optimizeImage } from "../../src/services/images/optimize"

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#c0392b" } }).png().toBuffer()

describe("image optimising", () => {
  it("makes a WebP at most 2000px and a 480px thumbnail, keeping the shape", async () => {
    const out = await optimizeImage(await png(3000, 1500), "image/png")
    expect(out).not.toBeNull()
    expect([out!.main.width, out!.main.height]).toEqual([2000, 1000])
    expect([out!.thumb.width, out!.thumb.height]).toEqual([480, 240])
    expect((await sharp(out!.main.buffer).metadata()).format).toBe("webp")
    expect((await sharp(out!.thumb.buffer).metadata()).format).toBe("webp")
  })

  it("never enlarges a small picture", async () => {
    const out = await optimizeImage(await png(300, 400), "image/png")
    expect([out!.main.width, out!.main.height]).toEqual([300, 400])
    expect([out!.thumb.width, out!.thumb.height]).toEqual([300, 400])
  })

  it("leaves GIFs and unreadable files alone", async () => {
    expect(await optimizeImage(await png(10, 10), "image/gif")).toBeNull()
    expect(await optimizeImage(new Uint8Array([1, 2, 3, 4]), "image/jpeg")).toBeNull()
  })
})
