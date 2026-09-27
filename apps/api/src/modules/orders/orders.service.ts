import { prisma, tx, cacheGet, cacheSet, cacheDel, CACHE_KEYS } from "../../config";
import { recordOrderCash } from "../payments/payments.records";
import { BaseService, ConflictError, NotFoundError, BadRequestError, ForbiddenError, type RequestContext } from "../../core";
import { getPaymentProvider, PAYMENT_METHODS } from "../../services/payments";
import type { PaymentMethod, PaymentStatus } from "../../services/payments/types";
import { OrderRepository, CartRepository, RefundRepository, CouponRepository, InventoryLogRepository, ShippingRepository } from "./orders.repository";
import type { CreateOrderFromCartDto, TransitionStatusDto, OrderSearchQueryDto, CreateCartDto, PaymentInitiateDto, PaymentConfirmDto, ExportOrdersDto } from "./orders.dto";
import { newId, slugify } from "@ecom/utils";
import { Prisma } from "@prisma/client";
import { emitOrderStatusChanged } from "../notifications";

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "ON_HOLD", "CANCELLED"],
  PROCESSING: ["ON_HOLD", "SHIPPED", "CANCELLED"],
  ON_HOLD: ["PROCESSING", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "REFUNDED", "FAILED"],
  COMPLETED: ["REFUNDED", "FAILED"],
  CANCELLED: [],
  REFUNDED: [],
  FAILED: ["PENDING"],
};

/** A cancelled order gives its flash-sale units back, so others can buy them at the sale price. */
async function releaseFlashSaleUnits(t: Prisma.TransactionClient, items: { quantity: number; meta: Prisma.JsonValue }[]) {
  for (const oi of items) {
    const meta = oi.meta as { flashSale?: { itemId?: string | null } } | null;
    const itemId = meta?.flashSale?.itemId;
    if (!itemId) continue;
    await t.flashSaleItem.updateMany({
      where: { id: BigInt(itemId), soldCount: { gte: oi.quantity } },
      data: { soldCount: { decrement: oi.quantity } },
    });
  }
}

export class OrdersService extends BaseService {
  private orders: OrderRepository;
  private carts: CartRepository;
  private refunds: RefundRepository;
  private coupons: CouponRepository;
  private inventory: InventoryLogRepository;
  private shipping: ShippingRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.orders = new OrderRepository();
    this.carts = new CartRepository();
    this.refunds = new RefundRepository();
    this.coupons = new CouponRepository();
    this.inventory = new InventoryLogRepository();
    this.shipping = new ShippingRepository();
  }

  async createOrderFromCart(dto: CreateOrderFromCartDto) {
    return tx(async (t: Prisma.TransactionClient) => {
      const cart = await t.cart.findFirst({
        where: { id: BigInt(dto.cartId) },
        include: {
          items: {
            include: {
              product: {
                include: {
                  taxClass: {
                    include: {
                      rates: true,
                    },
                  },
                },
              },
              variant: true,
            },
          },
        },
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestError("Cart is empty or not found", "CART_EMPTY");
      }

      const cartItems = cart.items as unknown as Array<{
        id: bigint;
        productId: bigint;
        variantId: bigint | null;
        quantity: number;
        unitPrice: Prisma.Decimal | number;
        product: {
          name: string;
          sku: string | null;
          imageUrl?: string | null;
          taxClass?: {
            rates?: Array<{ rate: number; countryCode: string }>;
          } | null;
        };
        variant?: {
          id: bigint;
          attributeValues: Record<string, unknown> | null;
          sku: string | null;
        } | null;
      }>;

      let coupon: any = null;
      let couponDiscountAmount = 0;
      if (dto.couponCode && dto.couponCode.trim().length > 0) {
        coupon = await this.coupons.findByCode(dto.couponCode.toUpperCase(), this.ctx);
        if (!coupon) {
          throw new BadRequestError("Invalid coupon code", "COUPON_INVALID");
        }
        if (!coupon.isActive) {
          throw new BadRequestError("Coupon is not active", "BAD_REQUEST");
        }
        const now = new Date();
        if (coupon.startsAt && new Date(coupon.startsAt) > now) {
          throw new BadRequestError("Coupon not yet valid", "BAD_REQUEST");
        }
        if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
          throw new BadRequestError("Coupon has expired", "COUPON_EXPIRED");
        }
      }

      let itemsSubtotal = 0;
      let taxTotal = 0;
      const billingCountryCode = dto.billingAddress?.countryCode ?? dto.shippingAddress.countryCode ?? "BD";
      const orderLines = cartItems.map((cartItem) => {
        const itemUnitPrice = Number(cartItem.unitPrice);
        const qty = cartItem.quantity;
        const lineSubtotal = itemUnitPrice * qty;
        itemsSubtotal += lineSubtotal;

        let taxRate = 15;
        const taxRates = cartItem.product?.taxClass?.rates ?? [];
        const matchedRate = taxRates.find((r) => r.countryCode === billingCountryCode);
        if (matchedRate) {
          taxRate = matchedRate.rate;
        }
        const lineTax = (lineSubtotal * taxRate) / 100;
        taxTotal += lineTax;

        return {
          cartItem,
          itemUnitPrice,
          qty,
          lineSubtotal,
          lineTax,
        };
      });

      if (coupon) {
        if (coupon.minSubtotal !== null && coupon.minSubtotal !== undefined && itemsSubtotal < Number(coupon.minSubtotal)) {
          throw new BadRequestError(`Coupon requires minimum subtotal of ${coupon.minSubtotal}`, "COUPON_MIN_AMOUNT_NOT_REACHED");
        }
        if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && (coupon.usageCount ?? 0) >= coupon.usageLimit) {
          throw new BadRequestError("Coupon usage limit reached", "COUPON_ALREADY_USED");
        }
        if (coupon.perCustomerLimit !== null && coupon.perCustomerLimit !== undefined && this.ctx.customer?.id) {
          const customerUsage = await prisma.order.count({
            where: {
              customerId: BigInt(this.ctx.customer.id),
              couponId: BigInt(coupon.id),
            },
          });
          if (customerUsage >= coupon.perCustomerLimit) {
            throw new BadRequestError("Coupon per-customer limit reached", "BAD_REQUEST");
          }
        }
        if (coupon.discountType === "PERCENT") {
          couponDiscountAmount = Math.min(itemsSubtotal, (itemsSubtotal * Number(coupon.discountValue)) / 100);
        } else {
          couponDiscountAmount = Math.min(itemsSubtotal, Number(coupon.discountValue));
        }
        if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined) {
          couponDiscountAmount = Math.min(couponDiscountAmount, Number(coupon.maxDiscountAmount));
        }
        couponDiscountAmount = Math.round(couponDiscountAmount * 100) / 100;
      }

      const shippingZone = await this.shipping.matchZoneByAddress(
        dto.shippingAddress.countryCode,
        dto.shippingAddress.state ?? null,
        dto.shippingAddress.postcode ?? null,
        this.ctx,
      );
      if (!shippingZone) {
        throw new BadRequestError("No shipping zone matches the provided address", "SHIPPING_RATE_NOT_FOUND");
      }
      const shippingZoneId = (shippingZone as { id: bigint }).id;
      const zoneMethods = await this.shipping.methodsForZone(shippingZoneId);
      const shippingMethod = zoneMethods.find((m: any) => m.code === dto.shippingMethodCode);
      if (!shippingMethod) {
        throw new BadRequestError(`Shipping method ${dto.shippingMethodCode} not available for this zone`, "SHIPPING_UNAVAILABLE_FOR_ZONE");
      }
      const itemCount = orderLines.reduce((sum, l) => sum + l.qty, 0);
      const shippingTotal = this.shipping.flatRateCalc(shippingMethod as any, itemsSubtotal, itemCount, 0);
      const shippingMethodName = (shippingMethod as { name: string }).name;

      const discountTotal = couponDiscountAmount;
      const feeTotal = 0;
      const grandTotal = itemsSubtotal + shippingTotal + taxTotal - discountTotal + feeTotal;
      const currencyCode = "BDT";

      for (const line of orderLines) {
        await this.inventory.deductStock(
          line.cartItem.productId,
          line.cartItem.variantId ?? null,
          line.qty,
          "ORDER_CREATE",
          "order-temp",
          undefined,
          undefined,
          this.ctx,
        );
      }

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const datePart = `${yyyy}${mm}${dd}`;
      const seqQuery = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as cnt FROM "Order"
        WHERE "number" LIKE '${datePart}%'
      `) as Array<{ cnt: number }>;
      const nextSeq = (seqQuery[0]?.cnt ?? 0) + 1;
      const seqPart = String(nextSeq).padStart(6, "0");
      const orderNumber = `${datePart}${seqPart}`;
      const orderKey = newId("ok");

      const shippingAddr = dto.shippingAddress;
      const billingAddr = dto.billingAddress ?? dto.shippingAddress;
      const customerId = this.ctx.customer?.id ? BigInt(this.ctx.customer.id) : null;
      const isGuest = customerId === null;
      const ipAddress = (this.ctx as any).req?.ip ?? null;
      const userAgent = (this.ctx as any).req?.headers?.["user-agent"] ?? null;

      const orderData: Record<string, unknown> = {
        ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}),
        number: orderNumber,
        orderKey,
        status: "PENDING",
        currencyCode,
        customerId,
        customerNote: dto.customerNote ?? null,
        isGuest,
        ipAddress,
        userAgent,
        billingFirstName: billingAddr.firstName,
        billingLastName: billingAddr.lastName,
        billingCompany: billingAddr.company ?? null,
        billingAddress1: billingAddr.address1,
        billingAddress2: billingAddr.address2 ?? null,
        billingCity: billingAddr.city,
        billingState: billingAddr.state ?? null,
        billingPostcode: billingAddr.postcode ?? null,
        billingCountryCode: billingAddr.countryCode,
        billingEmail: billingAddr.email,
        billingPhone: billingAddr.phone ?? null,
        shippingSameAsBilling: dto.billingAddress === undefined,
        shippingFirstName: shippingAddr.firstName,
        shippingLastName: shippingAddr.lastName,
        shippingCompany: shippingAddr.company ?? null,
        shippingAddress1: shippingAddr.address1,
        shippingAddress2: shippingAddr.address2 ?? null,
        shippingCity: shippingAddr.city,
        shippingState: shippingAddr.state ?? null,
        shippingPostcode: shippingAddr.postcode ?? null,
        shippingCountryCode: shippingAddr.countryCode,
        shippingEmail: shippingAddr.email,
        shippingPhone: shippingAddr.phone ?? null,
        shippingZoneId: shippingZoneId,
        shippingMethodCode: dto.shippingMethodCode,
        shippingMethodName,
        itemsSubtotal,
        discountTotal,
        shippingTotal,
        taxTotal,
        feeTotal,
        grandTotal,
        couponUsed: coupon ? (coupon.code as string) : null,
        couponId: coupon ? BigInt(coupon.id) : null,
        couponDiscountAmount,
        paymentGatewayCode: dto.paymentGatewayCode,
        paymentStatus: "unpaid" as PaymentStatus,
      };

      if (coupon) {
        await this.coupons.incrementUsage(BigInt(coupon.id), this.ctx);
      }

      const createdOrder = await t.order.create({ data: orderData as any });
      const orderId = BigInt(createdOrder.id);

      const discountRatio = discountTotal > 0 && itemsSubtotal > 0 ? discountTotal / itemsSubtotal : 0;
      const orderItemInserts = orderLines.map((line) => {
        const lineDiscount = Math.round(line.lineSubtotal * discountRatio * 100) / 100;
        const lineTotal = line.lineSubtotal + line.lineTax - lineDiscount;
        const product = line.cartItem.product;
        const variant = line.cartItem.variant;
        const productName = product?.name ?? "";
        const productSku = product?.sku ?? null;
        const imageUrl = product?.imageUrl ?? null;
        const variantValues = variant?.attributeValues ?? null;
        return {
          orderId,
          productId: line.cartItem.productId,
          variantId: line.cartItem.variantId ?? null,
          productName,
          productSku,
          variantValues: variantValues as any,
          imageUrl,
          quantity: line.qty,
          unitPrice: line.itemUnitPrice,
          lineSubtotal: line.lineSubtotal,
          lineTax: line.lineTax,
          lineDiscount,
          lineTotal,
        };
      });

      await t.orderItem.createMany({ data: orderItemInserts as any });

      await t.orderStatusLog.create({
        data: {
          orderId,
          status: "PENDING",
          note: "Order created from cart",
          notifyCustomer: true,
          adminId: null,
        } as any,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await t.cartItem.deleteMany({ where: { cartId: BigInt(dto.cartId) } });
      await t.cart.update({
        where: { id: BigInt(dto.cartId) },
        data: { expiresAt } as any,
      });

      let nextStep: string;
      let redirectUrl: string | undefined;
      if (dto.paymentGatewayCode === "cod") {
        nextStep = "COD_AWAITING_CONFIRM";
      } else {
        nextStep = "INITIATE_PAYMENT";
        try {
          const provider = getPaymentProvider(dto.paymentGatewayCode as PaymentMethod);
          const initiateResult = await provider.initiate({
            orderId,
            orderNumber,
            amount: grandTotal,
            currencyCode,
            customerEmail: billingAddr.email,
            customerName: `${billingAddr.firstName} ${billingAddr.lastName}`,
            customerPhone: billingAddr.phone,
            redirectUrl: "",
            ipnUrl: "",
            metadata: { orderKey },
          });
          redirectUrl = initiateResult.redirectUrl;
        } catch {
          redirectUrl = undefined;
        }
      }

      const fullOrder = await this.orders.findById(this.ctx, orderId);
      return { order: fullOrder, nextStep, redirectUrl };
    });
  }

  async transitionStatus(orderId: bigint, dto: TransitionStatusDto) {
    const oid = BigInt(orderId);
    const order = await this.orders.findById(this.ctx, oid);
    if (!order) throw new NotFoundError("order", oid);

    const currentStatus = (order as { status: string }).status;
    const newStatus = dto.newStatus;
    const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(
        `Cannot transition ${currentStatus} → ${newStatus}`,
        "ORDER_STATUS_INVALID_TRANSITION",
      );
    }

    const result = await tx(async (t: Prisma.TransactionClient) => {
      if (newStatus === "CANCELLED" || newStatus === "REFUNDED") {
        const orderItems = await t.orderItem.findMany({ where: { orderId: oid } });
        for (const oi of orderItems as Array<{ productId: bigint; variantId: bigint | null; quantity: number }>) {
          await this.inventory.restock(
            oi.productId,
            oi.variantId ?? null,
            oi.quantity,
            `ORDER_${newStatus}`,
            String(oid),
            undefined,
            this.ctx,
          );
        }
        if (newStatus === "CANCELLED") await releaseFlashSaleUnits(t, orderItems);
      }

      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "DELIVERED") {
        (updateData as any).completedAt = new Date();
        // Cash on delivery is collected when the parcel is handed over.
        const o = order as { paymentGatewayCode?: string; paymentStatus?: string };
        if (o.paymentGatewayCode === "cod" && o.paymentStatus === "unpaid") {
          updateData.paymentStatus = "paid";
          updateData.paidAt = new Date();
        }
      }
      if (newStatus === "CANCELLED") {
        (updateData as any).cancelledAt = new Date();
      }

      await t.order.update({ where: { id: oid }, data: updateData as any });
      // Cash on delivery handed over without a parcel carrying it: count it as cash in hand.
      if (newStatus === "DELIVERED") await recordOrderCash(t, oid);

      await t.orderStatusLog.create({
        data: {
          orderId: oid,
          status: newStatus,
          note: dto.note ?? null,
          notifyCustomer: dto.notifyCustomer ?? false,
          adminId: this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null,
        } as any,
      });

      return t.order.findFirst({ where: { id: oid } });
    });

    emitOrderStatusChanged({
      storeId: String((order as { storeId: bigint }).storeId),
      orderId: String(oid),
      status: newStatus,
      // Only a note written by the shop goes in the customer's email.
      note: this.ctx.admin ? (dto.note ?? null) : null,
      notify: dto.notifyCustomer !== false,
    });

    return result;
  }

  async listOrders(filters: OrderSearchQueryDto) {
    return this.orders.listWithJoins(this.ctx, filters);
  }

  async getOrderById(id: bigint) {
    const order = await this.orders.findDetailById(BigInt(id), this.ctx);
    if (!order) throw new NotFoundError("order", id);
    return order;
  }

  async getOrderByNumber(number: string) {
    const order = await this.orders.findByNumber(number, this.ctx);
    if (!order) throw new NotFoundError("order", number);
    return order;
  }

  async initiatePayment(dto: PaymentInitiateDto, order: any) {
    const provider = getPaymentProvider(dto.method as PaymentMethod);
    const customer = {
      email: (order as any).billingEmail,
      name: `${(order as any).billingFirstName ?? ""} ${(order as any).billingLastName ?? ""}`.trim(),
      phone: (order as any).billingPhone,
    };
    return provider.initiate({
      orderId: BigInt(dto.orderId),
      orderNumber: (order as any).number,
      amount: dto.amount,
      currencyCode: dto.currencyCode,
      customerEmail: customer.email,
      customerName: customer.name,
      customerPhone: customer.phone,
      redirectUrl: dto.redirectUrl,
      ipnUrl: dto.ipnUrl,
      metadata: { orderKey: (order as any).orderKey },
    });
  }

  async confirmPayment(dto: PaymentConfirmDto) {
    const provider = getPaymentProvider(dto.method as PaymentMethod);
    const confirmResult = await provider.confirm({
      gatewayTxnId: dto.gatewayTxnId,
      payload: dto.rawPayload,
      signature: dto.ipnSignature ?? undefined,
    } as any);

    if (!confirmResult.success) {
      throw new BadRequestError(
        confirmResult.errorMessage ?? "Payment confirmation failed",
        "PAYMENT_FAILED",
      );
    }

    const orderNumber = (confirmResult as any).orderNumber;
    let order: any;
    if (orderNumber) {
      order = await this.orders.findByNumber(orderNumber, this.ctx);
    }
    if (!order && (confirmResult as any).orderId) {
      order = await this.orders.findById(this.ctx, BigInt((confirmResult as any).orderId));
    }
    if (!order) {
      throw new NotFoundError("order", "for payment txn " + dto.gatewayTxnId);
    }

    const oid = BigInt((order as any).id);
    await prisma.order.update({
      where: { id: oid },
      data: {
        paymentStatus: confirmResult.status,
        paidAt: confirmResult.paidAt ?? new Date(),
        transactionId: confirmResult.transactionId ?? dto.gatewayTxnId,
      } as any,
    });

    return { order, confirmResult };
  }

  async parsePaymentIpn(
    provider: PaymentMethod,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    query: Record<string, unknown>,
  ) {
    const prov = getPaymentProvider(provider);
    const ipnResult = await prov.parseIpn({
      rawBody,
      headers,
      query,
      provider,
    });

    if (!ipnResult.verified) {
      throw new BadRequestError("IPN signature verification failed", "BAD_REQUEST");
    }

    let order: any = null;
    if (ipnResult.orderNumber) {
      order = await this.orders.findByNumber(ipnResult.orderNumber, this.ctx);
    }

    if (ipnResult.status === "paid" && order) {
      const confirmResult = await prov.confirm({
        orderId: BigInt((order as any).id),
        gatewayTxnId: ipnResult.transactionId,
      } as any);
      const oid = BigInt((order as any).id);
      await prisma.order.update({
        where: { id: oid },
        data: {
          paymentStatus: confirmResult.status ?? "paid",
          paidAt: confirmResult.paidAt ?? new Date(),
          transactionId: ipnResult.transactionId,
        } as any,
      });
    }

    return { verified: true, ipnResult, order };
  }

  async createGuestCart(dto: CreateCartDto & { items?: Array<{ productId: bigint; variantId?: bigint | null; quantity: number; unitPrice?: number | null }> }) {
    const token = newId("cart");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const result = await tx(async (t: Prisma.TransactionClient) => {
      const cart = await t.cart.create({
        data: {
          ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}),
          token,
          customerId: dto.customerId ? BigInt(dto.customerId) : null,
          currencyCode: dto.currencyCode ?? "BDT",
          appliedCouponCode: dto.appliedCouponCode ?? null,
          expiresAt,
        } as any,
      });
      const cartId = BigInt((cart as any).id);

      const insertedItems: any[] = [];
      if (dto.items && dto.items.length > 0) {
        const seen = new Set<string>();
        for (const item of dto.items) {
          const key = `${String(item.productId)}:${item.variantId ? String(item.variantId) : "null"}`;
          if (seen.has(key)) {
            throw new BadRequestError("Duplicate product+variant in cart items", "CART_INVALID");
          }
          seen.add(key);
          const unitPrice = item.unitPrice ?? 0;
          const qty = item.quantity;
          const created = await t.cartItem.create({
            data: {
              cartId,
              productId: BigInt(item.productId),
              variantId: item.variantId ? BigInt(item.variantId) : null,
              quantity: qty,
              unitPrice,
              lineTotal: unitPrice * qty,
              lineTax: 0,
            } as any,
          });
          insertedItems.push(created);
        }
      }

      return { cart, items: insertedItems };
    });

    return { token, ...result };
  }

  async addCartItem(
    cartId: bigint,
    productId: bigint,
    variantId: bigint | null | undefined,
    qty: number,
    unitPrice?: number,
  ) {
    const cid = BigInt(cartId);
    const pid = BigInt(productId);
    const vid = variantId ? BigInt(variantId) : null;
    const price = unitPrice ?? 0;
    return this.carts.upsertItem(cid, pid, vid, qty, price, price * qty, 0);
  }

  async exportOrders(_format: "csv" | "xlsx" | "pdf", _filters: ExportOrdersDto) {
    const format = _format ?? "csv";
    return {
      url: `/tmp-exports/order-${Date.now()}.${format}`,
      filename: `orders-${new Date().toISOString().slice(0, 10)}.${format}`,
      rows: 10,
    };
  }

  async aggregateStats(filters?: {
    status?: string[];
    paymentStatus?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    return this.orders.aggregateStats(this.ctx, filters ?? {});
  }

  async customerScopedGetMyOrders(customerId: bigint, filters: OrderSearchQueryDto) {
    const cid = BigInt(customerId);
    const scopedFilters = { ...filters, customerId: cid };
    return this.orders.listWithJoins(this.ctx, scopedFilters);
  }
}
