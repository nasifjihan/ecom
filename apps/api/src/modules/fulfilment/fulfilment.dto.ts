import { z } from "zod";
import { PARCEL_STATUSES, RETURN_STATUSES } from "./fulfilment.rules";

const text = (max: number) => z.string().trim().max(max);
const money = z.coerce.number().min(0).max(10_000_000).multipleOf(0.01);

export const IdParam = z.object({ id: z.coerce.bigint().positive() });

const Line = z.object({
  orderItemId: z.coerce.bigint().positive(),
  quantity: z.coerce.number().int().min(1).max(10_000),
});

export const CreateParcelDto = z.object({
  /** Leave empty to pack everything that isn't in a parcel yet. */
  items: z.array(Line).max(100).optional(),
  courierCode: text(40).min(2),
  courierName: text(80).min(2),
  trackingNumber: text(80).optional(),
  trackingUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  /** Cash the courier collects; defaults to what's still due on a cash-on-delivery order. */
  codAmount: money.optional(),
  weightKg: z.coerce.number().positive().max(1000).optional(),
  note: text(500).optional(),
});
export type CreateParcelDto = z.infer<typeof CreateParcelDto>;

export const UpdateParcelDto = z.object({
  courierCode: text(40).min(2).optional(),
  courierName: text(80).min(2).optional(),
  trackingNumber: text(80).optional(),
  trackingUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  codAmount: money.optional(),
  note: text(500).optional(),
});
export type UpdateParcelDto = z.infer<typeof UpdateParcelDto>;

export const MoveParcelDto = z.object({
  status: z.enum(PARCEL_STATUSES),
  note: text(500).optional(),
  trackingNumber: text(80).optional(),
});
export type MoveParcelDto = z.infer<typeof MoveParcelDto>;

export const RETURN_REASONS = ["wrong_size", "damaged", "not_as_described", "wrong_item", "changed_mind", "other"] as const;

export const CreateReturnDto = z.object({
  items: z.array(Line.extend({ condition: text(80).optional() })).min(1, "Choose at least one item").max(100),
  reason: z.enum(RETURN_REASONS),
  note: text(1000).optional(),
});
export type CreateReturnDto = z.infer<typeof CreateReturnDto>;

export const MoveReturnDto = z.object({
  status: z.enum(RETURN_STATUSES),
  note: text(1000).optional(),
  /** On "received": false = nothing goes back into stock. */
  restock: z.boolean().optional(),
  /** On "received": items that can't be sold again. */
  noRestockItemIds: z.array(z.coerce.bigint().positive()).max(100).optional(),
});
export type MoveReturnDto = z.infer<typeof MoveReturnDto>;

export const REFUND_METHODS = ["original", "cash", "bkash", "nagad", "bank", "store_credit"] as const;

export const CreateRefundDto = z.object({
  items: z.array(Line).max(100).optional(),
  /** On top of the items, e.g. the delivery charge. */
  extraAmount: money.optional(),
  method: z.enum(REFUND_METHODS).default("original"),
  reason: text(500).min(2, "Say why"),
  note: text(1000).optional(),
  restock: z.boolean().default(true),
  returnRequestId: z.coerce.bigint().positive().optional(),
});
export type CreateRefundDto = z.infer<typeof CreateRefundDto>;

export const ListQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().max(30).optional(),
  search: z.string().max(80).optional(),
});
export type ListQueryDto = z.infer<typeof ListQueryDto>;
