/**
 * Payment records written as a side effect of other changes (a parcel delivered, an order
 * delivered or entered as paid). Kept apart from the service so orders and fulfilment can call
 * them without importing it.
 */
import type { Prisma } from "@prisma/client";
import { BadRequestError } from "../../core";
import { isManualCapable, normalizeTrxId } from "./payments.rules";

type T = Prisma.TransactionClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Adds the COD record for a delivered parcel (called inside the parcel's transaction). */
export async function recordParcelCash(
  t: T,
  s: { id: bigint; storeId: bigint; orderId: bigint; codAmount: unknown; providerCode: string; providerName: string },
) {
  if (num(s.codAmount) <= 0) return;
  const exists = await t.paymentRecord.findFirst({ where: { shipmentId: s.id, kind: "cod" } });
  if (exists) return;
  const own = s.providerCode === "own";
  await t.paymentRecord.create({
    data: {
      storeId: s.storeId, orderId: s.orderId, kind: "cod", method: "cod", amount: num(s.codAmount),
      status: own ? "cash_in_hand" : "with_courier", moneyIsWith: own ? "office" : "courier",
      shipmentId: s.id, courierCode: s.providerCode, courierName: s.providerName, submittedBy: "system",
    },
  });
}

/**
 * A cash-on-delivery order marked delivered without a parcel carrying its cash (e.g. handed over at
 * the shop): the whole amount is cash in hand until someone confirms it reached the till.
 */
export async function recordOrderCash(t: T, orderId: bigint) {
  const o = await t.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true, grandTotal: true, refundedTotal: true, paymentGatewayCode: true, shipments: { select: { status: true, codAmount: true } } },
  });
  if (!o || o.paymentGatewayCode !== "cod") return;
  if (o.shipments.some((s) => s.status !== "cancelled" && num(s.codAmount) > 0)) return;
  if (await t.paymentRecord.findFirst({ where: { orderId, kind: "cod" } })) return;
  const amount = r2(num(o.grandTotal) - num(o.refundedTotal));
  if (amount <= 0) return;
  await t.paymentRecord.create({
    data: { storeId: o.storeId, orderId, kind: "cod", method: "cod", amount, status: "cash_in_hand", moneyIsWith: "office", submittedBy: "system" },
  });
}

/** Records the money of an order staff enter as already paid (manual orders). */
export async function recordPaidAtEntry(
  t: T,
  o: { id: bigint; storeId: bigint; grandTotal: unknown; paymentGatewayCode: string; transactionId: string | null },
  adminId: bigint | null,
) {
  const cod = o.paymentGatewayCode === "cod";
  if (!cod && !isManualCapable(o.paymentGatewayCode)) return;
  const trx = o.transactionId && !cod && o.paymentGatewayCode !== "bank_transfer" ? normalizeTrxId(o.transactionId) : o.transactionId;
  if (trx && !cod) {
    const used = await t.paymentRecord.findFirst({
      where: { storeId: o.storeId, method: o.paymentGatewayCode, transactionId: trx, status: { not: "rejected" } },
      include: { order: { select: { number: true } } },
    });
    if (used) throw new BadRequestError(`Transaction ${trx} is already recorded on order ${used.order.number}`, "VALIDATION_FAILED");
  }
  await t.paymentRecord.create({
    data: {
      storeId: o.storeId, orderId: o.id, kind: cod ? "cod" : "transfer", method: cod ? "cash" : o.paymentGatewayCode,
      amount: num(o.grandTotal), transactionId: trx, status: cod ? "received" : "verified",
      moneyIsWith: "office", submittedBy: "staff", checkedById: adminId, checkedAt: new Date(),
      note: cod ? "Paid when the order was entered" : null,
    },
  });
}
