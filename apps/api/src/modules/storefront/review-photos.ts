/**
 * Photos in reviews: a signed-in shopper uploads up to MAX_REVIEW_PHOTOS (made into WebP, with a
 * small copy), then sends the keys with the review. Keys carry the store and the shopper, so a
 * review can only use photos its own author uploaded. Not added to the shop's media library.
 */
import { BadRequestError, UnsupportedMediaError } from "../../core"
import { getStorageProvider } from "../../services/storage"
import { optimizeImage } from "../../services/images/optimize"
import { randomBytes } from "node:crypto"

export const MAX_REVIEW_PHOTOS = 4
export const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024

const prefixOf = (storeId: bigint, customerId: bigint) => `${storeId}/media/reviews/${customerId}/`

/** A key this shopper's upload made: `<store>/media/reviews/<customer>/<time>-<random>.webp`. */
export function isOwnPhotoKey(key: string, storeId: bigint, customerId: bigint): boolean {
  const prefix = prefixOf(storeId, customerId)
  return key.startsWith(prefix) && /^\d{10,16}-[a-f0-9]{12}\.webp$/.test(key.slice(prefix.length))
}

/** The small copy saved next to each photo. */
export const thumbOf = (url: string) => url.replace(/\.webp$/, "-thumb.webp")

export async function uploadReviewPhoto(storeId: bigint, customerId: bigint, file: { buffer: Uint8Array; mimeType: string }) {
  const optimized = await optimizeImage(file.buffer, file.mimeType)
  if (!optimized) throw new UnsupportedMediaError("Use a JPG, PNG or WebP photo")
  const key = `${prefixOf(storeId, customerId)}${Date.now()}-${randomBytes(6).toString("hex")}.webp`
  const storage = getStorageProvider()
  const [main, thumb] = await Promise.all([
    storage.put(key, optimized.main.buffer, "image/webp"),
    storage.put(key.replace(/\.webp$/, "-thumb.webp"), optimized.thumb.buffer, "image/webp"),
  ])
  return { key, url: main.url, thumbUrl: thumb.url }
}

/** The photo addresses to save on a review, from the keys its author sent. */
export function reviewPhotoUrls(storeId: bigint, customerId: bigint, keys: string[]): string[] {
  const unique = [...new Set(keys)]
  if (unique.length > MAX_REVIEW_PHOTOS) throw new BadRequestError(`Add up to ${MAX_REVIEW_PHOTOS} photos`, "VALIDATION_FAILED")
  if (unique.some((k) => !isOwnPhotoKey(k, storeId, customerId))) throw new BadRequestError("Upload the photos again, please", "VALIDATION_FAILED")
  const storage = getStorageProvider()
  return unique.map((k) => storage.urlOf(k))
}
