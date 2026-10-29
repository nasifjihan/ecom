/**
 * A shopper deleting their own account, and downloading what we hold about them.
 * Orders stay (the shop needs them for its accounts and VAT), but the account is emptied:
 * name, email, phone, password, sign-ins, addresses and wishlist are wiped, and it can't sign in.
 */
import { prisma } from "../../config";
import { BadRequestError, NotFoundError } from "../../core";
import { markPasswordChanged } from "../auth/password-reset";

/** Orders that are still on their way; the account can be deleted once these are done. */
export const OPEN_ORDER_STATUSES = ["PENDING", "PROCESSING", "ON_HOLD", "SHIPPED", "OUT_FOR_DELIVERY"];

export const hasOpenOrders = (statuses: string[]) => statuses.some((s) => OPEN_ORDER_STATUSES.includes(s.toUpperCase()));

export async function deleteMyAccount(storeId: bigint, customerId: bigint) {
  const me = await prisma.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true, email: true } });
  if (!me) throw new NotFoundError("Customer", customerId);
  const orders = await prisma.order.findMany({ where: { storeId, customerId }, select: { status: true } });
  if (hasOpenOrders(orders.map((o) => o.status)))
    throw new BadRequestError("You have an order on its way. You can delete your account once it has arrived.", "VALIDATION_FAILED");
  await prisma.$transaction([
    prisma.customerAddress.deleteMany({ where: { customerId } }),
    prisma.customerIdentity.deleteMany({ where: { customerId } }),
    prisma.wishlistItem.deleteMany({ where: { customerId } }),
    ...(me.email ? [prisma.newsletterSubscriber.deleteMany({ where: { storeId, email: me.email } })] : []),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        // Unique per store, so the address can be used for a new account later.
        email: `deleted-${customerId}@deleted.invalid`,
        passwordHash: null,
        firstName: "Deleted",
        lastName: "customer",
        phone: null,
        avatarUrl: null,
        twoFactorSecret: null,
        acceptMarketing: false,
        status: "deleted",
        lastLoginIp: null,
      },
    }),
  ]);
  // Signs the account out everywhere.
  await markPasswordChanged("customer", customerId);
}

/** Everything the shop holds about the shopper, as one JSON file. */
export async function exportMyData(storeId: bigint, customerId: bigint) {
  const c = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      acceptMarketing: true,
      storeCredit: true,
      loyaltyPoints: true,
      createdAt: true,
      addresses: true,
      wishlistItems: { select: { productId: true, createdAt: true } },
      reviews: { select: { productId: true, rating: true, title: true, body: true, createdAt: true } },
      walletTransactions: { select: { kind: true, amount: true, note: true, createdAt: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          number: true,
          status: true,
          grandTotal: true,
          createdAt: true,
          shippingFirstName: true,
          shippingLastName: true,
          shippingPhone: true,
          shippingAddress1: true,
          shippingCity: true,
          customerNote: true,
          items: { select: { productName: true, quantity: true, unitPrice: true } },
        },
      },
    },
  });
  if (!c) throw new NotFoundError("Customer", customerId);
  return { exportedAt: new Date().toISOString(), account: c };
}
