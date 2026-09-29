import { z } from "zod"
import { COURIERS } from "./couriers.rules"

const text = (max: number) => z.string().trim().max(max)

export const IdParam = z.object({ id: z.coerce.bigint().positive() })
export const WebhookParams = z.object({
  courier: z.enum(COURIERS),
  token: z.string().min(10).max(80),
})

const Settings = z
  .object({
    /** Pathao: pickup store id (defaults to the account's default store). */
    storeId: z.coerce.number().int().positive().optional(),
    /** Pathao: 48 = normal, 12 = on demand. */
    deliveryType: z.coerce
      .number()
      .int()
      .refine((v) => v === 48 || v === 12, "48 (normal) or 12 (on demand)")
      .optional(),
    /** Pathao: 1 = document, 2 = parcel. */
    itemType: z.coerce.number().int().min(1).max(2).optional(),
    /** RedX: pickup store id. */
    pickupStoreId: z.coerce.number().int().positive().optional(),
    /** Weight to send when a parcel has none. */
    defaultWeightKg: z.coerce.number().positive().max(50).optional(),
  })
  .strict()

const Credentials = z.record(z.string(), text(500).optional())

export const CreateAccountDto = z.object({
  courier: z.enum(COURIERS),
  label: text(60).optional(),
  mode: z.enum(["sandbox", "live"]).default("live"),
  enabled: z.boolean().default(true),
  credentials: Credentials,
  settings: Settings.optional(),
})
export type CreateAccountDto = z.infer<typeof CreateAccountDto>

export const UpdateAccountDto = z.object({
  label: text(60).optional(),
  mode: z.enum(["sandbox", "live"]).optional(),
  enabled: z.boolean().optional(),
  /** Leave a field empty to keep the saved value. */
  credentials: Credentials.optional(),
  settings: Settings.optional(),
})
export type UpdateAccountDto = z.infer<typeof UpdateAccountDto>

export const BookParcelDto = z.object({
  accountId: z.coerce.bigint().positive(),
  pathao: z
    .object({
      cityId: z.coerce.number().int().positive(),
      zoneId: z.coerce.number().int().positive(),
      areaId: z.coerce.number().int().positive().optional(),
    })
    .optional(),
  redx: z
    .object({ areaId: z.coerce.number().int().positive(), areaName: text(120).min(1) })
    .optional(),
  weightKg: z.coerce.number().positive().max(50).optional(),
  note: text(250).optional(),
})
export type BookParcelDto = z.infer<typeof BookParcelDto>

export const BulkBookDto = z.object({
  /** Left out: each order goes to its storefront's courier. */
  accountId: z.coerce.bigint().positive().optional(),
  orderIds: z.array(z.coerce.bigint().positive()).min(1).max(100),
})
export type BulkBookDto = z.infer<typeof BulkBookDto>

export const SuggestQuery = z.object({ accountId: z.coerce.bigint().positive() })
export const ZonesQuery = z.object({ cityId: z.coerce.number().int().positive() })
export const AreasQuery = z.object({ zoneId: z.coerce.number().int().positive() })
export const RedxAreasQuery = z.object({ district: text(80).optional() })
export const LabelsQuery = z.object({
  ids: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.coerce.bigint().positive()).min(1).max(200)),
})
