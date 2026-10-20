/**
 * IMAGE OPTIMISING for uploads: a WebP copy at most 2000px on its longest side (turned the right way
 * up from the camera's EXIF), and a 480px WebP thumbnail for product cards and data-saver mode.
 * GIFs (may be animated) and anything sharp can't read are left as they are (returns null).
 */
import sharp from "sharp"

export const MAX_SIDE = 2000
export const THUMB_SIDE = 480

export interface OptimizedImage {
  main: { buffer: Buffer; width: number; height: number }
  thumb: { buffer: Buffer; width: number; height: number }
}

const CONVERT = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])

export async function optimizeImage(input: Uint8Array, mimeType: string): Promise<OptimizedImage | null> {
  if (!CONVERT.has(mimeType)) return null
  try {
    const source = sharp(input, { failOn: "error" }).rotate()
    const [main, thumb] = await Promise.all([
      source.clone().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      source.clone().resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer({ resolveWithObject: true }),
    ])
    return {
      main: { buffer: main.data, width: main.info.width, height: main.info.height },
      thumb: { buffer: thumb.data, width: thumb.info.width, height: thumb.info.height },
    }
  } catch {
    return null // a broken or unusual file still uploads as it is
  }
}
