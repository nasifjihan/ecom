import { z } from "zod"

const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)
const text = (max: number) => z.string().trim().max(max).refine(noXss, "No HTML please")
const id = z.coerce.bigint().positive()
const money = z.coerce.number().min(0).max(100_000_000)

export const IdParam = z.object({ id })
export const DomainIdParam = z.object({ domainId: id })
export const ProductIdParam = z.object({ productId: id })

export const StorefrontDto = z.object({
  name: text(80).pipe(z.string().min(2, "Name the storefront")),
  code: text(20).nullish(),
  isActive: z.boolean().optional(),
  priceAdjustPercent: z.coerce.number().min(-90).max(500).optional(),
  includeNewProducts: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  /** Payment methods offered here (gateway codes); empty: every enabled one. */
  paymentGateways: z.array(z.string().trim().toLowerCase().min(2).max(32)).max(30).optional(),
  /** Courier account suggested for this storefront's parcels. */
  courierAccountId: id.nullish(),
})
export const UpdateStorefrontDto = StorefrontDto.partial()

export const AddDomainDto = z.object({ hostname: text(255).pipe(z.string().min(3, "Type the web address")) })
export const MoveDomainDto = z.object({ storefrontId: id.nullable() })

export const ProductStorefrontsDto = z.object({
  storefronts: z
    .array(
      z.object({
        storefrontId: id,
        listed: z.boolean(),
        regularPrice: money.nullish(),
        salePrice: money.nullish(),
        /** Own prices per option here; an option left out (or without a price) uses the product's. */
        options: z
          .array(z.object({ variantId: id, regularPrice: money.nullish(), salePrice: money.nullish() }))
          .max(500)
          .optional(),
      }),
    )
    .max(50),
})

export const StorefrontProductsDto = z.object({
  productIds: z.array(id).min(1).max(500),
  listed: z.boolean(),
})

/** `?storefrontId=` on the content editors (theme, home page, menus). */
export const StorefrontQuery = z.object({ storefrontId: id.optional() })

export type StorefrontInput = z.infer<typeof StorefrontDto>
export type ProductStorefrontsInput = z.infer<typeof ProductStorefrontsDto>
