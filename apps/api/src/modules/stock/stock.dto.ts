import { z } from "zod"

const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)
const text = (max: number) => z.string().trim().max(max).refine(noXss, "No HTML please")
const id = z.coerce.bigint().positive()

export const IdParam = z.object({ id })
export const OrderIdParam = z.object({ orderId: id })

export const WarehouseDto = z.object({
  name: text(80).pipe(z.string().min(2, "Name the warehouse")),
  code: text(20).nullish(),
  address: text(300).nullish(),
  phone: text(30).nullish(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
})
export const UpdateWarehouseDto = WarehouseDto.partial()

export const StockQuery = z.object({
  search: z.string().trim().max(80).optional(),
  warehouseId: id.optional(),
  inStockOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
})

export const TransfersQuery = z.object({
  status: z.enum(["in_transit", "received", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const TransferDto = z.object({
  fromWarehouseId: id,
  toWarehouseId: id,
  items: z
    .array(
      z.object({
        productId: id,
        variantId: id.nullish(),
        qty: z.coerce.number().int().min(1).max(1_000_000),
      }),
    )
    .min(1, "Add at least one item")
    .max(200),
  note: text(500).nullish(),
})

export const ReceiveDto = z.object({
  items: z
    .array(z.object({ id, qty: z.coerce.number().int().min(0).max(1_000_000) }))
    .max(200)
    .optional(),
  note: text(500).nullish(),
})

export const MoveOrderDto = z.object({ warehouseId: id })
