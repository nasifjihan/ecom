/**
 * MANUAL ORDERS — orders staff enter for customers who ordered by phone, Facebook, WhatsApp
 * or in person. They go through the same pricing, stock and coupon code as storefront
 * checkout (StorefrontService.quoteOrder / createOrder); on top of that staff can give a
 * discount (capped by their role), type a delivery fee or choose pickup, and record a payment.
 *
 *   POST /api/admin/orders/manual/quote   price a draft; never saves, lists problems instead of failing
 *   POST /api/admin/orders/manual         create the order
 */
import { leadForOrder, winLead } from "../leads/leads.service";
import { z } from "zod";
import { logger, prisma } from "../../config";
import { BadRequestError, ForbiddenError, NotFoundError, type RequestContext } from "../../core";
import { StorefrontService, type OrderDraft } from "../storefront/storefront.service";
import { assertStaffStorefront, defaultStorefrontId, staffStorefronts } from "../storefronts/storefronts.context";
import { emitOrderPlaced } from "../notifications";
import { orderBlocker } from "../wholesale/quotation.rules";
import { creditOrder } from "../sales/commission.ledger";

export const ORDER_SOURCES = ["website", "phone", "facebook", "instagram", "whatsapp", "messenger", "walk_in", "other"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

const text = (max: number) => z.string().trim().max(max);
const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

const Line = z.object({
  productId: z.coerce.bigint().positive(),
  variantId: z.coerce.bigint().positive().optional().nullable(),
  qty: z.coerce.number().int().min(1).max(1000),
});

const Customer = z.object({
  /** An existing customer of this store; otherwise one is found by phone/email or created. */
  id: z.coerce.bigint().positive().optional().nullable(),
  firstName: text(80).optional(),
  lastName: text(80).optional(),
  phone: text(20).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("")),
});

const Address = z.object({
  firstName: text(80).optional(),
  lastName: text(80).optional(),
  phone: text(20).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default("BD"),
  locationId: z.coerce.bigint().positive().optional().nullable(),
  division: text(64).optional(),
  district: text(64).optional(),
  upazila: text(64).optional(),
  postcode: text(12).optional(),
  addressLine1: text(200).optional(),
  addressLine2: text(200).optional(),
});

const Delivery = z.discriminatedUnion("type", [
  z.object({ type: z.literal("method"), methodId: z.coerce.bigint().positive() }),
  z.object({ type: z.literal("custom"), fee: z.coerce.number().min(0).max(100000), name: text(80).optional() }),
  z.object({ type: z.literal("pickup") }),
]);

const Discount = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().min(0).max(10_000_000),
});

const Base = z.object({
  customer: Customer.default({}),
  items: z.array(Line).max(100).default([]),
  address: Address.default({}),
  delivery: Delivery.default({ type: "pickup" }),
  couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal("")),
  /** The store's automatic promotions (discounts, free gifts, free delivery); on unless staff turn them off. */
  applyPromotions: z.boolean().default(true),
  discount: Discount.optional().nullable(),
  paymentGateway: z.string().trim().toLowerCase().min(2).max(32).default("cod"),
  paid: z.boolean().default(false),
  transactionId: text(100).optional(),
  source: z.enum(ORDER_SOURCES).default("phone"),
  /** The storefront the order is for: its prices, range, promotions and delivery (default: the main one). */
  storefrontId: z.coerce.bigint().positive().optional(),
  status: z.enum(["PENDING", "PROCESSING"]).default("PENDING"),
  customerNote: text(2000).optional(),
  staffNote: text(2000).optional(),
  notifyCustomer: z.boolean().default(true),
  /** Take what the store allows from the customer's wallet (known customers only). */
  useWallet: z.boolean().default(false),
  /** Make the order from this quotation: its customer, lines, agreed prices and discount. */
  quotationId: z.coerce.bigint().positive().optional(),
  /** The salesperson credited (commission); null: nobody. Default: the quote's maker or whoever enters it, if on the sales team. */
  salespersonId: z.coerce.bigint().positive().nullable().optional(),
  /** Made from this CRM lead: the lead is won with the order (default salesperson: whoever follows it). */
  leadId: z.coerce.bigint().positive().optional(),
});

export const ManualOrderQuoteDto = Base;
export type ManualOrderQuoteDto = z.infer<typeof ManualOrderQuoteDto>;

export const ManualOrderDto = Base.superRefine((v, ctx) => {
  if (!v.items.length && !v.quotationId) ctx.addIssue({ code: "custom", path: ["items"], message: "Add at least one product" });
  if (!v.quotationId && !v.customer.id && !v.customer.phone && !v.customer.email) {
    ctx.addIssue({ code: "custom", path: ["customer", "phone"], message: "Pick a customer or enter a phone number or email" });
  }
  if (!v.quotationId && !v.customer.id && !v.customer.firstName) {
    ctx.addIssue({ code: "custom", path: ["customer", "firstName"], message: "Enter the customer's name" });
  }
  if (v.delivery.type !== "pickup") {
    if (!v.address.addressLine1 || v.address.addressLine1.length < 3) {
      ctx.addIssue({ code: "custom", path: ["address", "addressLine1"], message: "Enter the delivery address" });
    }
    if (!v.address.locationId && !v.address.district) {
      ctx.addIssue({ code: "custom", path: ["address", "district"], message: "Pick the district" });
    }
  }
  if (v.paid && v.paymentGateway !== "cod" && !v.transactionId) {
    ctx.addIssue({ code: "custom", path: ["transactionId"], message: "Enter the transaction ID of the payment" });
  }
});
export type ManualOrderDto = z.infer<typeof ManualOrderDto>;

/** 01XXXXXXXXX for Bangladeshi mobiles (drops +88 / 88), otherwise the digits as typed. */
export function normalizePhone(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/[\s()-]/g, "");
  if (BD_MOBILE.test(s)) return s.replace(/^\+?88/, "");
  return s;
}

/** The most a staff member may knock off by hand, as % of the items subtotal. */
export async function manualDiscountCap(ctx: RequestContext): Promise<number> {
  if (ctx.admin?.permissions.includes("*")) return 100;
  if (!ctx.admin || ctx.storeId === undefined) return 0;
  const admin = await prisma.adminUser.findFirst({
    where: { id: ctx.admin.id, storeId: ctx.storeId },
    select: { role: { select: { maxManualDiscountPct: true } } },
  });
  return Number(admin?.role?.maxManualDiscountPct ?? 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class ManualOrderService {
  constructor(private readonly ctx: RequestContext) {}

  /** Checkout for the order's storefront (staff limited to some storefronts: one of theirs). */
  private async shopFor(storefrontId: bigint | undefined): Promise<StorefrontService> {
    const allowed = staffStorefronts(this.ctx);
    const id = storefrontId ?? allowed?.[0] ?? (await defaultStorefrontId(this.storeId));
    assertStaffStorefront(this.ctx, id);
    if (!(await prisma.storefront.findFirst({ where: { id, storeId: this.storeId }, select: { id: true } }))) {
      throw new NotFoundError("Storefront");
    }
    return new StorefrontService({ ...this.ctx, storefrontId: id });
  }

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    return this.ctx.storeId;
  }

  /** An existing customer by id, else by phone, else by email. */
  private async findCustomer(c: ManualOrderQuoteDto["customer"]) {
    const storeId = this.storeId;
    if (c.id) {
      const row = await prisma.customer.findFirst({ where: { id: c.id, storeId } });
      if (!row) throw new NotFoundError("Customer", String(c.id));
      return row;
    }
    const phone = normalizePhone(c.phone);
    if (phone) {
      const forms = BD_MOBILE.test(phone) ? [phone, `+88${phone}`, `88${phone}`] : [phone];
      const row = await prisma.customer.findFirst({ where: { storeId, phone: { in: forms } }, orderBy: { id: "asc" } });
      if (row) return row;
    }
    if (c.email) {
      return prisma.customer.findUnique({ where: { storeId_email: { storeId, email: c.email } } });
    }
    return null;
  }

  /** The quotation an order is made from, and why it can't become one (if so). */
  private async quotation(id: bigint) {
    const q = await prisma.quotation.findFirst({ where: { id, storeId: this.storeId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    if (!q) throw new NotFoundError("Quotation", String(id));
    return { q, blocker: orderBlocker(q.status, q.validUntil) };
  }

  private async draft(dto: ManualOrderQuoteDto, strict: boolean) {
    // From a quotation: its customer, storefront, lines at the agreed prices and its discount.
    const found = dto.quotationId ? await this.quotation(dto.quotationId) : null;
    // Creating fails; the form's live pricing lists it as a problem instead.
    if (found?.blocker && strict) throw new BadRequestError(found.blocker, "ORDER_STATUS_INVALID_TRANSITION");
    const fromQuote = found?.q ?? null;
    if (fromQuote) {
      dto = {
        ...dto,
        customer: { id: fromQuote.customerId },
        storefrontId: fromQuote.storefrontId ?? dto.storefrontId,
        items: fromQuote.items
          .filter((i) => i.productId)
          .map((i) => ({ productId: i.productId!, variantId: i.variantId, qty: i.qty })),
        discount: Number(fromQuote.discount) > 0 ? { type: "fixed", value: Number(fromQuote.discount) } : null,
        couponCode: "",
        applyPromotions: false,
      };
    }
    const customer = await this.findCustomer(dto.customer).catch((e) => {
      if (strict) throw e;
      return null;
    });
    const firstName = dto.address.firstName || dto.customer.firstName || customer?.firstName || "";
    const lastName = dto.address.lastName || dto.customer.lastName || customer?.lastName || "";
    const phone = normalizePhone(dto.address.phone || dto.customer.phone || customer?.phone) || "";
    const email = dto.customer.email || customer?.email || null;
    const pickup = dto.delivery.type === "pickup";

    const input: OrderDraft = {
      strict,
      items: dto.items.map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, qty: l.qty })),
      email,
      shippingAddress: {
        firstName,
        lastName,
        country: dto.address.country,
        locationId: dto.address.locationId ?? null,
        division: dto.address.division ?? "",
        district: dto.address.district ?? "",
        upazila: dto.address.upazila ?? "",
        postcode: dto.address.postcode ?? "",
        addressLine1: dto.address.addressLine1 || (pickup ? "Collected from the shop" : ""),
        addressLine2: dto.address.addressLine2 ?? "",
        phone,
        email: email ?? undefined,
      },
      billingSameAsShipping: true,
      delivery:
        dto.delivery.type === "method"
          ? { methodId: dto.delivery.methodId }
          : dto.delivery.type === "custom"
            ? { customFee: dto.delivery.fee, name: dto.delivery.name }
            : { pickup: true },
      // The form shows the zone's options as soon as an area is picked, whatever is selected yet.
      listShippingOptions: !!dto.address.locationId || !!dto.address.district,
      couponCode: dto.couponCode || undefined,
      applyPromotions: dto.applyPromotions,
      manualDiscount: dto.discount && dto.discount.value > 0 ? dto.discount : undefined,
      paymentGateway: dto.paymentGateway,
      // Staff may record any payment method the store has set up, even ones not offered online.
      requireEnabledGateway: false,
      applyGatewayFee: false,
      // A known customer gets their loyalty level's discount; staff can take payment from their wallet.
      customerId: customer?.id ?? null,
      useWallet: dto.useWallet && !!customer,
      unitPrices: fromQuote
        ? new Map(fromQuote.items.filter((i) => i.productId).map((i) => [`${i.productId}:${i.variantId ?? ""}`, Number(i.unitPrice)]))
        : undefined,
    };
    const shop = await this.shopFor(dto.storefrontId);
    const quote = await shop.quoteOrder(input);

    if (found?.blocker) quote.problems.push(found.blocker);
    const cap = await manualDiscountCap(this.ctx);
    const { itemsSubtotal, manualDiscount } = quote.totals;
    const pct = itemsSubtotal > 0 ? (manualDiscount / itemsSubtotal) * 100 : 0;
    // A quotation's discount was agreed when it was made (and checked against the maker's limit then).
    const overCap = !fromQuote && manualDiscount > 0 && pct > cap + 1e-9;
    if (overCap) {
      const msg = `Your role can give at most ${cap}% off (৳${round2((itemsSubtotal * cap) / 100)} on this order)`;
      if (strict) throw new ForbiddenError(msg, "DISCOUNT_OVER_LIMIT");
      quote.problems.push(msg);
    }
    return { quote, customer, email, phone, cap, shop, fromQuote };
  }

  async quote(dto: ManualOrderQuoteDto) {
    const { quote, customer, cap } = await this.draft(dto, false);
    const gateways = await prisma.paymentGatewayConfig.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ enabled: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { code: true, name: true, enabled: true },
    });
    return {
      paymentMethods: gateways,
      customer: customer
        ? {
            id: String(customer.id),
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            phone: customer.phone,
            email: customer.email,
            orderCount: customer.orderCount,
          }
        : null,
      lines: quote.quotedLines.map((q) => ({
        productId: String(q.line.productId),
        variantId: q.line.variantId ? String(q.line.variantId) : null,
        qty: q.line.qty,
        name: q.priced?.product.name ?? null,
        sku: q.priced ? q.priced.variant?.sku ?? q.priced.product.sku : null,
        unitPrice: q.priced?.unitPrice ?? null,
        compareAtPrice: q.priced?.compareAtPrice ?? null,
        flashSale: q.priced?.flash?.name ?? null,
        bulk: q.priced?.tier ? { minQty: q.priced.tier.minQty, business: !q.priced.tier.forEveryone } : null,
        lineSubtotal: q.priced?.lineSubtotal ?? null,
        problem: q.problem?.message ?? null,
      })),
      shippingOptions: quote.shippingOptions,
      delivery: quote.delivery,
      coupon: quote.coupon ? { code: quote.coupon.code as string } : null,
      couponError: quote.couponError,
      promotions: quote.promotions,
      discountCapPct: cap,
      member: quote.member,
      wallet: quote.wallet,
      totals: quote.totals,
      problems: quote.problems,
    };
  }

  async create(dto: ManualOrderDto) {
    const { quote, customer: found, email, phone, shop, fromQuote } = await this.draft(dto, true);
    const storeId = this.storeId;
    const lead = dto.leadId ? await leadForOrder(storeId, dto.leadId) : null;

    // Keep a customer record for the order (no login until they register on the storefront).
    let customer = found;
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          storeId,
          firstName: dto.customer.firstName || quote.ship.firstName || "Customer",
          lastName: dto.customer.lastName || quote.ship.lastName || "",
          phone: phone || null,
          email,
          isGuest: false,
          status: "active",
        },
      });
    } else if (!customer.phone && phone) {
      customer = await prisma.customer.update({ where: { id: customer.id }, data: { phone } });
    }

    // Claim the quotation first, so two people can't both turn it into an order.
    if (fromQuote) {
      const claimed = await prisma.quotation.updateMany({
        where: { id: fromQuote.id, status: fromQuote.status, orderId: null },
        data: { status: "ORDERED" },
      });
      if (!claimed.count) throw new BadRequestError("This quote was just changed or made into an order. Reload it.", "ORDER_STATUS_INVALID_TRANSITION");
    }
    const adminId = await this.adminUserId();
    const who = await this.staffName(adminId);
    const sourceLabel = dto.source.replace("_", "-");
    const order = await shop
      .createOrder(quote, {
        customerId: customer.id,
        customerNote: dto.customerNote || null,
        source: dto.source,
        createdByAdminId: adminId,
        status: dto.status,
        paid: dto.paid,
        transactionId: dto.transactionId || null,
        notifyCustomer: dto.notifyCustomer,
        historyNote: [
          `Order entered by ${who} (${sourceLabel} order)`,
          fromQuote ? `From quotation ${fromQuote.number}` : null,
          dto.staffNote,
        ]
          .filter(Boolean)
          .join(". "),
      })
      .catch(async (e: unknown) => {
        // Give the quotation back if the order couldn't be made (stock ran out, etc.).
        if (fromQuote) await prisma.quotation.update({ where: { id: fromQuote.id }, data: { status: fromQuote.status } });
        throw e;
      });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { orderCount: { increment: 1 }, totalSpent: { increment: quote.totals.grandTotal } },
    });

    if (fromQuote) {
      await prisma.quotation.update({ where: { id: fromQuote.id }, data: { orderId: order.id } });
    }
    await this.credit(order.id, dto.salespersonId, lead?.ownerId ?? fromQuote?.createdById ?? adminId);
    if (lead) await winLead(storeId, lead.id, { id: order.id, number: order.number, customerId: customer.id }, { id: adminId, name: who });
    emitOrderPlaced({ storeId: String(storeId), orderId: String(order.id), notifyCustomer: dto.notifyCustomer, notifyStaff: false });
    return {
      id: String(order.id),
      number: order.number,
      orderKey: order.orderKey,
      grandTotal: quote.totals.grandTotal,
      customerId: String(customer.id),
    };
  }

  // ---------------------------------------------------------------- pickers
  // The order form's own searches, so staff who may take orders don't also need full
  // catalog or customer access.

  async pickProducts(search: string) {
    const q = search.trim();
    const rows = await prisma.product.findMany({
      where: {
        storeId: this.storeId,
        status: "published",
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
      },
      select: {
        id: true, name: true, sku: true, type: true, regularPrice: true, salePrice: true,
        stockQty: true, reservedStock: true, manageStock: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
        _count: { select: { variants: { where: { status: "active" } } } },
      },
      orderBy: [{ saleCount: "desc" }, { id: "desc" }],
      take: 8,
    });
    return rows.map((p) => ({
      id: String(p.id),
      name: p.name,
      sku: p.sku,
      type: p.type,
      price: Number(p.salePrice ?? p.regularPrice ?? 0) || Number(p.regularPrice ?? 0),
      // Free to sell: on hand less what open orders hold.
      stockQty: p.stockQty === null ? null : p.stockQty - p.reservedStock,
      manageStock: p.manageStock,
      variantCount: p._count.variants,
      imageUrl: p.images[0]?.imageUrl ?? null,
    }));
  }

  async pickVariants(productId: bigint) {
    const rows = await prisma.productVariant.findMany({
      where: { productId, status: "active", product: { storeId: this.storeId } },
      orderBy: { id: "asc" },
    });
    return rows.map((v) => ({
      id: String(v.id),
      label: Object.values((v.attributeValues as Record<string, string>) ?? {}).join(" / ") || v.sku || `#${v.id}`,
      sku: v.sku,
      price: Number(v.salePrice ?? v.regularPrice ?? 0) || Number(v.regularPrice ?? 0),
      stockQty: v.stockQty === null ? null : v.stockQty - v.reservedStock,
      manageStock: v.manageStock,
    }));
  }

  async pickCustomers(search: string) {
    const q = search.trim();
    const phone = normalizePhone(q);
    const rows = await prisma.customer.findMany({
      where: {
        storeId: this.storeId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: phone || q } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, orderCount: true },
      orderBy: [{ orderCount: "desc" }, { id: "desc" }],
      take: 6,
    });
    return rows.map((c) => ({
      id: String(c.id),
      name: `${c.firstName} ${c.lastName}`.trim() || "Customer",
      phone: c.phone,
      email: c.email,
      orderCount: c.orderCount,
    }));
  }

  /**
   * Credits the order to a salesperson: the one picked, else `fallback` (the quote's maker or whoever
   * entered it) when they're on the sales team. Never blocks the order.
   */
  private async credit(orderId: bigint, picked: bigint | null | undefined, fallback: bigint | null) {
    try {
      let id = picked;
      if (id === undefined) {
        const f = fallback ? await prisma.adminUser.findFirst({ where: { id: fallback, storeId: this.storeId, isSalesperson: true }, select: { id: true } }) : null;
        id = f?.id ?? null;
      }
      if (id) await creditOrder(prisma, this.storeId, orderId, id);
    } catch (err) {
      logger.warn({ err, orderId: String(orderId) }, "Could not credit the order to a salesperson");
    }
  }

  /** The store admin behind this session; null for a platform admin (not an AdminUser row). */
  private async adminUserId(): Promise<bigint | null> {
    if (!this.ctx.admin || this.ctx.admin.role === "SUPER") return null;
    const row = await prisma.adminUser.findFirst({ where: { id: this.ctx.admin.id, storeId: this.storeId }, select: { id: true } });
    return row?.id ?? null;
  }

  private async staffName(adminId: bigint | null): Promise<string> {
    if (!adminId) return "the platform team";
    const a = await prisma.adminUser.findUnique({ where: { id: adminId }, select: { name: true, email: true } });
    return a?.name || a?.email || "staff";
  }
}
