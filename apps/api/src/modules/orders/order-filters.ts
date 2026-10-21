/**
 * The orders page's extra filters (payment method, coupon, who made it, delivery zone, total),
 * shared by the order list and the orders export so both pick the same orders.
 */
import type { Prisma } from "@prisma/client";

export interface OrderExtraFilters {
  /** Payment gateway code, e.g. "cod", "bkash". */
  paymentGateway?: string;
  /** true = only orders with a coupon, false = only orders without one. */
  hasCoupon?: boolean;
  /** Staff member who made the order by hand. */
  createdByAdminId?: bigint;
  shippingZoneId?: bigint;
  minTotal?: number;
  maxTotal?: number;
}

export function orderExtraWhere(f: OrderExtraFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (f.paymentGateway) where.paymentGatewayCode = { equals: f.paymentGateway, mode: "insensitive" };
  if (f.hasCoupon === true) where.couponUsed = { not: null };
  if (f.hasCoupon === false) where.couponUsed = null;
  if (f.createdByAdminId !== undefined) where.createdByAdminId = f.createdByAdminId;
  if (f.shippingZoneId !== undefined) where.shippingZoneId = f.shippingZoneId;
  if (f.minTotal !== undefined || f.maxTotal !== undefined) {
    where.grandTotal = {
      ...(f.minTotal !== undefined ? { gte: f.minTotal } : {}),
      ...(f.maxTotal !== undefined ? { lte: f.maxTotal } : {}),
    };
  }
  return where;
}
