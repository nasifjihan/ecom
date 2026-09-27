import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const money = z.coerce.number().min(0).max(10_000_000).multipleOf(0.01);

export const IdParam = z.object({ id: z.coerce.bigint().positive() });
export const CodeParam = z.object({ code: z.string().min(2).max(40) });

/** A payment the customer (or staff for them) says was sent. */
export const SubmitTransferDto = z.object({
  /** Defaults to the order's payment method. */
  method: z.enum(["bkash", "nagad", "rocket", "bank_transfer"]).optional(),
  transactionId: text(60).min(4, "Enter the transaction ID"),
  senderNumber: text(40).optional(),
  /** Defaults to what's still due. */
  amount: money.positive().optional(),
  note: text(500).optional(),
});
export type SubmitTransferDto = z.infer<typeof SubmitTransferDto>;

/** Staff record a payment they can already see in the account (verified straight away) or queue it. */
export const StaffTransferDto = SubmitTransferDto.extend({ verified: z.boolean().default(false) });
export type StaffTransferDto = z.infer<typeof StaffTransferDto>;

export const VerifyDto = z.object({
  /** The amount that actually arrived, when it differs from what was reported. */
  amount: money.positive().optional(),
  note: text(500).optional(),
});
export type VerifyDto = z.infer<typeof VerifyDto>;

export const RejectDto = z.object({ reason: text(500).min(3, "Say why, so the customer can fix it") });
export type RejectDto = z.infer<typeof RejectDto>;

export const PaymentListDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  kind: z.enum(["transfer", "cod"]).default("transfer"),
  status: z.string().max(30).optional(),
  method: z.string().max(30).optional(),
  courier: z.string().max(40).optional(),
  search: z.string().max(80).optional(),
});
export type PaymentListDto = z.infer<typeof PaymentListDto>;

export const ConfirmCashDto = z.object({
  ids: z.array(z.coerce.bigint().positive()).min(1).max(200),
  note: text(500).optional(),
});
export type ConfirmCashDto = z.infer<typeof ConfirmCashDto>;

export const NotCollectedDto = z.object({ reason: text(500).min(3, "Say what happened") });
export type NotCollectedDto = z.infer<typeof NotCollectedDto>;

export const CreateSettlementDto = z.object({
  courierCode: text(40).min(2),
  /** Parcels' cash this payout covers; leave empty for everything the courier still owes. */
  recordIds: z.array(z.coerce.bigint().positive()).max(1000).optional(),
  charges: money.default(0),
  receivedAmount: money,
  reference: text(80).optional(),
  paidOn: z.coerce.date(),
  note: text(1000).optional(),
});
export type CreateSettlementDto = z.infer<typeof CreateSettlementDto>;

export const ResolveSettlementDto = z.object({ note: text(1000).min(3, "Say how it was settled") });
export type ResolveSettlementDto = z.infer<typeof ResolveSettlementDto>;

export const SettlementListDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().max(20).optional(),
  courier: z.string().max(40).optional(),
});
export type SettlementListDto = z.infer<typeof SettlementListDto>;

export const ACCOUNT_TYPES = ["personal", "agent", "merchant"] as const;

export const UpdatePaymentMethodDto = z.object({
  enabled: z.boolean().optional(),
  name: text(60).min(2).optional(),
  description: text(200).optional(),
  instructions: text(2000).optional(),
  mode: z.enum(["manual", "online"]).optional(),
  accountNumber: text(60).optional(),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  feeFixed: money.optional(),
  feePercent: z.coerce.number().min(0).max(20).multipleOf(0.01).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100).optional(),
});
export type UpdatePaymentMethodDto = z.infer<typeof UpdatePaymentMethodDto>;
