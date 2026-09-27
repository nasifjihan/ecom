"use client";

import { api, fileResponse, toPaginated } from "@ecom/api-client";
import {
  fromApiParcel,
  fromApiRefund,
  fromApiReturn,
  type ApiParcel,
  type ApiRefund,
  type ApiReturn,
  type Parcel,
  type RefundRow,
  type ReturnRequest,
} from "./fulfilment-api-slice";

/** Mirrors the API OrderStatus enum (prisma/schema.prisma). */
export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "ON_HOLD"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "FAILED";

export type PaymentMethod =
  | "STRIPE"
  | "BKASH"
  | "NAGAD"
  | "ROCKET"
  | "SSLCOMMERZ"
  | "COD"
  | "BANK_TRANSFER";

export type ShippingZone = "DHAKA_METRO" | "REST_BD" | "INTERNATIONAL";

/** Display name of the customer group: a store-defined group name (e.g. "VIP"), "Guest", or "No group". */
export type CustomerGroup = string;

export interface CustomerGroupOption {
  id: string;
  name: string;
  discountPercent: number;
  customersCount: number;
}

export type AdjustmentType =
  | "ADD"
  | "DEDUCT"
  | "SET"
  | "INVENTORY_COUNT"
  | "DAMAGE";

export type AdjustmentReason =
  | "DAMAGED"
  | "EXPIRED"
  | "COUNTED"
  | "RECEIVED"
  | "THEFT"
  | "OTHER";

export type TransferStatus = "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";

export interface Address {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  country?: string;
  division?: string;
  district?: string;
  upazila?: string;
  postcode?: string;
  phone?: string;
  email?: string;
}

/** Where an order came from (Order.source on the API). */
export const ORDER_SOURCES = [
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone call" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "Other" },
] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number]["value"];
export const sourceLabel = (s?: string | null) => ORDER_SOURCES.find((x) => x.value === s)?.label ?? s ?? "Website";

export interface OrderLine {
  id: string | number;
  productVariantId: string | number;
  productName: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string | number;
  orderNumber: string;
  customerId?: string | number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus?: "PAID" | "UNPAID" | "PENDING" | "PARTIALLY_PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "FAILED";
  transactionId?: string;
  paidAt?: string;
  shippingMethod?: string;
  shippingZone?: ShippingZone;
  trackingNo?: string;
  carrier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  subtotal: number;
  shippingCost: number;
  vatAmount: number;
  discountAmount: number;
  couponCode?: string;
  grandTotal: number;
  billingAddress?: Address;
  shippingAddress?: Address;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
  assignedToUserId?: string | number;
  itemsCount: number;
  source: string;
  /** Staff member who entered the order by hand. */
  createdByName?: string;
  manualDiscount: number;
  /** From the order's parcels: unfulfilled, partial, packed, shipped, delivered, delivery_failed, returned. */
  fulfillmentStatus: string;
  /** From the newest return: none, requested, approved, received, refunded, rejected. */
  returnStatus: string;
  refundedTotal: number;
}

export interface OrderListFilters {
  status?: OrderStatus;
  customerId?: string | number;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: PaymentMethod;
  minTotal?: number;
  maxTotal?: number;
  coupon?: boolean;
  shippingZone?: ShippingZone;
  search?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderNote {
  id: string | number;
  content: string;
  type: "INTERNAL" | "CUSTOMER";
  userId?: string | number;
  userName?: string;
  createdAt: string;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  userId?: string | number;
}

export interface AuditLogEntry {
  id: string | number;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  userId?: string | number;
  userName?: string;
  createdAt: string;
}

export interface Customer {
  id: string | number;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  phone?: string;
  group: CustomerGroup;
  groupId?: string;
  status?: string;
  storeCredit?: number;
  loyaltyPoints?: number;
  reviewsCount?: number;
  wishlistCount?: number;
  addresses?: (Address & { id: string; label?: string; isDefault?: boolean })[];
  isVerified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl?: string;
  totalSpent: number;
  ordersCount: number;
  ltv?: number;
  aov?: number;
  refundsCount?: number;
  lastOrderAt?: string;
  lastActiveAt?: string;
  createdAt: string;
  billingAddress?: Address;
  shippingAddress?: Address;
}

export interface CustomerFilters {
  search?: string;
  /** Customer group id, or "GUEST" for guest checkouts. */
  groupId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  groupId?: string;
}

interface ApiCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  status: string;
  groupId: string | null;
  group?: { id: string; name: string } | null;
  storeCredit: string;
  loyaltyPoints: number;
  totalSpent: string;
  orderCount: number;
  lastLoginAt: string | null;
  createdAt: string;
  addresses?: {
    id: string;
    type: string;
    label: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    address1: string;
    address2: string | null;
    city: string;
    state: string | null;
    postcode: string | null;
    countryCode: string;
    phone: string | null;
    isDefault: boolean;
  }[];
  _count?: { orders?: number; reviews?: number; wishlistItems?: number };
}

export function fromApiCustomer(c: ApiCustomer): Customer {
  const addresses = (c.addresses ?? []).map((a) => ({
    id: a.id,
    label: a.label ?? undefined,
    isDefault: a.isDefault,
    firstName: a.firstName ?? undefined,
    lastName: a.lastName ?? undefined,
    company: a.company ?? undefined,
    address1: a.address1,
    address2: a.address2 ?? undefined,
    country: a.countryCode,
    division: a.state ?? undefined,
    district: a.city,
    postcode: a.postcode ?? undefined,
    phone: a.phone ?? undefined,
  }));
  // Default address of a type, else the first one of that type.
  const byType = (t: string) => {
    const rows = c.addresses ?? [];
    const i = rows.findIndex((a) => a.type === t && a.isDefault);
    const j = i >= 0 ? i : rows.findIndex((a) => a.type === t);
    return j >= 0 ? addresses[j] : undefined;
  };
  const totalSpent = Number(c.totalSpent);
  const orders = c._count?.orders ?? c.orderCount;
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    phone: c.phone ?? undefined,
    group: c.isGuest ? "Guest" : c.group?.name ?? "No group",
    groupId: c.groupId ?? undefined,
    status: c.status,
    storeCredit: Number(c.storeCredit),
    loyaltyPoints: c.loyaltyPoints,
    reviewsCount: c._count?.reviews,
    wishlistCount: c._count?.wishlistItems,
    addresses,
    // The schema has no verification flags yet; an active, non-guest account is treated as verified.
    isVerified: !c.isGuest && c.status === "ACTIVE",
    emailVerified: false,
    phoneVerified: false,
    avatarUrl: c.avatarUrl ?? undefined,
    totalSpent,
    ordersCount: orders,
    ltv: totalSpent,
    aov: orders > 0 ? Math.round((totalSpent / orders) * 100) / 100 : 0,
    lastActiveAt: c.lastLoginAt ?? undefined,
    createdAt: c.createdAt,
    billingAddress: byType("billing"),
    shippingAddress: byType("shipping"),
  };
}

export interface StockItem {
  id: string | number;
  productId: string;
  /** null for a simple product, whose stock lives on the product row. */
  variantId: string | null;
  productVariantId: string | number;
  productName: string;
  sku: string;
  imageUrl?: string;
  warehouseId: string | number;
  warehouseName: string;
  availableQty: number;
  reservedQty: number;
  physicalQty: number;
  lowStockThreshold: number;
  reorderPoint: number;
  unitCost: number;
  lastAdjustedAt?: string;
  lastAdjustedBy?: string;
}

export interface StockFilters {
  lowStock?: boolean;
  outOfStock?: boolean;
  warehouseIds?: (string | number)[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface InventoryLog {
  id: string | number;
  createdAt: string;
  referenceNo?: string;
  type: AdjustmentType;
  productVariantId: string | number;
  productName: string;
  sku?: string;
  qtyChange: number;
  reason?: AdjustmentReason;
  note?: string;
  userId?: string | number;
  userName?: string;
  warehouseId?: string | number;
  warehouseName?: string;
  newQty: number;
}

export interface StockTransfer {
  id: string | number;
  referenceNo: string;
  fromWarehouseId: string | number;
  fromWarehouseName: string;
  toWarehouseId: string | number;
  toWarehouseName: string;
  productVariantId: string | number;
  productName: string;
  sku?: string;
  quantity: number;
  status: TransferStatus;
  createdAt: string;
  receivedAt?: string;
}

export interface AdjustStockInput {
  productId: string;
  variantId: string | null;
  /** Current on-hand quantity, needed to turn SET / INVENTORY_COUNT into a delta. */
  currentQty: number;
  productVariantId: string | number;
  warehouseId: string | number;
  quantity: number;
  type: AdjustmentType;
  reason?: AdjustmentReason;
  note?: string;
  referenceNo?: string;
  date?: string;
  attachment?: File | string;
}

export interface CreateTransferInput {
  fromWarehouseId: string | number;
  toWarehouseId: string | number;
  productVariantId: string | number;
  quantity: number;
}

const MAIN_WAREHOUSE = { warehouseId: "MAIN", warehouseName: "Main stock" };

interface ApiStockRow {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  imageUrl: string | null;
  physicalQty: number;
  reservedQty: number;
  availableQty: number;
  lowStockThreshold: number;
  unitCost: number;
  lastAdjustedAt: string | null;
}

interface ApiMovement {
  id: string;
  productId: string | null;
  variantId: string | null;
  warehouse: string | null;
  changeQty: number;
  reason: string;
  referenceId: string | null;
  note: string | null;
  qtyAfter: number;
  createdAt: string;
  product?: { name: string; sku: string | null } | null;
  variant?: { sku: string | null; attributeValues: Record<string, string> | null } | null;
}

const REASON_TO_TYPE: Record<string, AdjustmentType> = {
  DAMAGED: "DAMAGE",
  COUNTED: "INVENTORY_COUNT",
};

function fromApiMovement(m: ApiMovement): InventoryLog {
  const label = m.variant?.attributeValues ? Object.values(m.variant.attributeValues).join(" / ") : "";
  const name = m.product?.name ?? "Deleted product";
  return {
    id: m.id,
    createdAt: m.createdAt,
    referenceNo: m.referenceId ?? undefined,
    type: REASON_TO_TYPE[m.reason] ?? (m.changeQty >= 0 ? "ADD" : "DEDUCT"),
    productVariantId: m.variantId ?? m.productId ?? "",
    productName: label ? `${name} (${label})` : name,
    sku: m.variant?.sku ?? m.product?.sku ?? undefined,
    qtyChange: m.changeQty,
    reason: m.reason as AdjustmentReason,
    note: m.note ?? undefined,
    warehouseId: m.warehouse ?? "MAIN",
    warehouseName: !m.warehouse || m.warehouse === "MAIN" ? "Main stock" : m.warehouse,
    newQty: m.qtyAfter,
  };
}

export interface StockSummary {
  totalSkus: number;
  totalStockValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  stockTurnoverRatio?: number;
}

export type CustomerStatusCounts = Partial<Record<OrderStatus, number>>;

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; color: string }
> = {
  STRIPE: { label: "Stripe", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" },
  BKASH: { label: "bKash", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400" },
  NAGAD: { label: "Nagad", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  ROCKET: { label: "Rocket", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
  SSLCOMMERZ: { label: "SSLCommerz", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400" },
  COD: { label: "COD", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  BANK_TRANSFER: { label: "Bank Transfer", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
};

/** Same rules the API enforces in OrdersService (STATUS_TRANSITIONS). */
export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
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

/** Order row as the API returns it (Prisma Order + includes, decimals as strings). */
interface ApiOrder {
  id: string;
  number: string;
  customerId: string | null;
  customer?: { firstName: string; lastName: string; email: string; phone: string | null } | null;
  status: OrderStatus;
  paymentGatewayCode: string;
  paymentStatus: string;
  transactionId: string | null;
  paidAt: string | null;
  shippingMethodName: string | null;
  trackingNumber: string | null;
  itemsSubtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  couponUsed: string | null;
  source?: string;
  manualDiscount?: string;
  createdByAdmin?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  [k: string]: unknown;
  items?: {
    id: string;
    variantId: string | null;
    productId: string | null;
    productName: string;
    productSku: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    variantValues: Record<string, string> | null;
  }[];
  statusHistory?: {
    id: string;
    status: OrderStatus;
    note: string | null;
    createdAt: string;
    admin?: { name: string } | null;
  }[];
  refunds?: ApiRefund[];
  shipments?: ApiParcel[];
  returns?: ApiReturn[];
  fulfillmentStatus?: string;
  returnStatus?: string;
  refundedTotal?: string;
}

const address = (o: ApiOrder, prefix: "billing" | "shipping"): Address => {
  const f = (k: string) => (o[`${prefix}${k}`] as string | null) ?? undefined;
  return {
    firstName: f("FirstName"),
    lastName: f("LastName"),
    company: f("Company"),
    address1: f("Address1"),
    address2: f("Address2"),
    country: f("CountryCode"),
    division: f("State"),
    district: f("City"),
    upazila: f("Upazila"),
    postcode: f("Postcode"),
    phone: f("Phone"),
    email: prefix === "billing" ? f("Email") : undefined,
  };
};

export function fromApiOrder(o: ApiOrder): Order {
  const name =
    [o.billingFirstName, o.billingLastName].filter(Boolean).join(" ") ||
    [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") ||
    "Guest";
  const lines: OrderLine[] = (o.items ?? []).map((i) => ({
    id: i.id,
    productVariantId: i.variantId ?? i.productId ?? "",
    productName: i.variantValues
      ? `${i.productName} (${Object.values(i.variantValues).join(" / ")})`
      : i.productName,
    sku: i.productSku ?? "",
    imageUrl: i.imageUrl ?? undefined,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    lineTotal: Number(i.lineTotal),
  }));
  return {
    id: o.id,
    orderNumber: o.number,
    customerId: o.customerId ?? undefined,
    customerName: name,
    customerEmail: (o.billingEmail as string | null) ?? o.customer?.email ?? undefined,
    customerPhone: (o.billingPhone as string | null) ?? o.customer?.phone ?? undefined,
    status: o.status,
    paymentMethod: o.paymentGatewayCode.toUpperCase() as PaymentMethod,
    paymentStatus: o.paymentStatus.toUpperCase() as Order["paymentStatus"],
    transactionId: o.transactionId ?? undefined,
    paidAt: o.paidAt ?? undefined,
    shippingMethod: o.shippingMethodName ?? undefined,
    trackingNo: o.trackingNumber ?? undefined,
    deliveredAt: o.completedAt ?? undefined,
    subtotal: Number(o.itemsSubtotal),
    shippingCost: Number(o.shippingTotal),
    vatAmount: Number(o.taxTotal),
    discountAmount: Number(o.discountTotal),
    couponCode: o.couponUsed ?? undefined,
    grandTotal: Number(o.grandTotal),
    billingAddress: address(o, "billing"),
    shippingAddress: address(o, "shipping"),
    lines,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    itemsCount: lines.reduce((n, l) => n + l.quantity, 0),
    source: o.source ?? "website",
    createdByName: o.createdByAdmin?.name ?? undefined,
    manualDiscount: Number(o.manualDiscount ?? 0),
    fulfillmentStatus: o.fulfillmentStatus ?? "unfulfilled",
    returnStatus: o.returnStatus ?? "none",
    refundedTotal: Number(o.refundedTotal ?? 0),
  };
}

export const operationsApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrderList: builder.query<
      PaginatedResponse<Order> & { statusCounts: CustomerStatusCounts },
      OrderListFilters
    >({
      // Rows and the per-status tab counts come from two endpoints; fetch both.
      queryFn: async (filters, _api, _extra, baseQuery) => {
        const params = new URLSearchParams();
        if (filters.status) params.set("status", filters.status);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (filters.minTotal !== undefined) params.set("minTotal", String(filters.minTotal));
        if (filters.maxTotal !== undefined) params.set("maxTotal", String(filters.maxTotal));
        if (filters.search) params.set("search", filters.search);
        if (filters.source) params.set("source", filters.source);
        if (filters.customerId !== undefined) params.set("customerId", String(filters.customerId));
        params.set("page", String(filters.page ?? 1));
        params.set("perPage", String(filters.limit ?? 20));
        const [list, stats] = await Promise.all([
          baseQuery(`/admin/orders?${params.toString()}`),
          baseQuery("/admin/orders/dashboard/stats"),
        ]);
        if (list.error) return { error: list.error };
        const page = toPaginated((list.data as ApiOrder[]).map(fromApiOrder), list.meta);
        const statusCounts: CustomerStatusCounts = {};
        for (const r of (stats.data as { byStatus?: { status: OrderStatus; count: number }[] } | undefined)?.byStatus ?? []) {
          statusCounts[r.status] = r.count;
        }
        return { data: { ...page, statusCounts } };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((o) => ({ type: "Order" as const, id: o.id })),
              { type: "Order", id: "LIST" },
            ]
          : [{ type: "Order", id: "LIST" }],
    }),

    getOrder: builder.query<
      Order & {
        notes?: OrderNote[];
        refunds?: RefundRow[];
        parcels?: Parcel[];
        returns?: ReturnRequest[];
        timeline?: OrderTimelineEntry[];
        auditLog?: AuditLogEntry[];
      },
      string | number
    >({
      query: (id) => ({
        url: `/admin/orders/${id}`,
        method: "GET",
      }),
      transformResponse: (o: ApiOrder) => {
        const history = [...(o.statusHistory ?? [])].reverse(); // oldest first
        return {
          ...fromApiOrder(o),
          timeline: history.map((h) => ({ status: h.status, timestamp: h.createdAt, note: h.note ?? undefined })),
          notes: (o.statusHistory ?? [])
            .filter((h) => h.note)
            .map((h) => ({
              id: h.id,
              content: h.note as string,
              type: "INTERNAL" as const,
              userName: h.admin?.name ?? "System",
              createdAt: h.createdAt,
            })),
          refunds: (o.refunds ?? []).map(fromApiRefund),
          parcels: (o.shipments ?? []).map(fromApiParcel),
          returns: (o.returns ?? []).map(fromApiReturn),
          auditLog: history.slice(1).map((h, i) => ({
            id: h.id,
            action: "Status changed",
            field: "status",
            oldValue: history[i]?.status,
            newValue: h.status,
            userName: h.admin?.name ?? "System",
            createdAt: h.createdAt,
          })),
        };
      },
      providesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),

    updateOrderStatus: builder.mutation<
      unknown,
      { id: string | number; status: OrderStatus; note?: string }
    >({
      query: ({ id, status, note }) => ({
        url: `/admin/orders/${id}/status`,
        method: "POST",
        body: { newStatus: status, note },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    // No bulk endpoint on the API: apply the transition order by order and report how many succeeded.
    bulkUpdateOrderStatus: builder.mutation<
      { updated: number; failed: number },
      { ids: (string | number)[]; status: OrderStatus }
    >({
      queryFn: async ({ ids, status }, _api, _extra, baseQuery) => {
        const results = await Promise.all(
          ids.map((id) =>
            baseQuery({ url: `/admin/orders/${id}/status`, method: "POST", body: { newStatus: status } }),
          ),
        );
        const failed = results.filter((r) => r.error).length;
        return { data: { updated: ids.length - failed, failed } };
      },
      invalidatesTags: [{ type: "Order", id: "LIST" }],
    }),

    /** The order's invoice PDF, as an object URL (see openFile in @ecom/api-client). */
    orderInvoice: builder.mutation<string, string | number>({
      query: (id) => ({ url: `/admin/orders/${id}/invoice`, responseHandler: fileResponse }),
    }),
    /** Invoices for several orders in one PDF, one after another. */
    orderInvoices: builder.mutation<string, (string | number)[]>({
      query: (ids) => ({ url: "/admin/orders/invoices", params: { ids: ids.join(",") }, responseHandler: fileResponse }),
    }),

    sendOrderEmail: builder.mutation<{ success: boolean }, string | number>({
      query: (id) => ({
        url: `/admin/orders/${id}/send-email`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),

    createOrderNote: builder.mutation<
      OrderNote,
      { id: string | number; content: string; type: "INTERNAL" | "CUSTOMER" }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/orders/${id}/notes`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Order", id }],
    }),

    // Refunds, parcels and returns: fulfilment-api-slice.ts.

    getCustomers: builder.query<PaginatedResponse<Customer>, CustomerFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.groupId === "GUEST") params.set("isGuest", "true");
        else if (filters.groupId) params.set("groupId", filters.groupId);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        params.set("page", String(filters.page ?? 1));
        params.set("perPage", String(filters.limit ?? 20));
        return {
          url: `/admin/customers?${params.toString()}`,
          method: "GET",
        };
      },
      transformResponse: (items: ApiCustomer[], meta) => toPaginated(items.map(fromApiCustomer), meta),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((c) => ({ type: "Customer" as const, id: c.id })),
              { type: "Customer", id: "LIST" },
            ]
          : [{ type: "Customer", id: "LIST" }],
    }),

    getCustomer: builder.query<Customer, string | number>({
      query: (id) => ({
        url: `/admin/customers/${id}`,
        method: "GET",
      }),
      transformResponse: (c: ApiCustomer) => fromApiCustomer(c),
      providesTags: (_r, _e, id) => [{ type: "Customer", id }],
    }),

    getCustomerGroups: builder.query<CustomerGroupOption[], void>({
      query: () => "/admin/customers/groups",
      transformResponse: (rows: { id: string; name: string; discountPercent: string; _count: { customers: number } }[]) =>
        rows.map((g) => ({
          id: g.id,
          name: g.name,
          discountPercent: Number(g.discountPercent),
          customersCount: g._count.customers,
        })),
      providesTags: [{ type: "Customer", id: "GROUPS" }],
    }),

    createCustomer: builder.mutation<Customer, CreateCustomerInput>({
      query: ({ groupId, phone, ...rest }) => ({
        url: `/admin/customers`,
        method: "POST",
        body: { ...rest, phone: phone || undefined, groupId: groupId || undefined },
      }),
      transformResponse: (c: ApiCustomer) => fromApiCustomer(c),
      invalidatesTags: [{ type: "Customer", id: "LIST" }],
    }),

    updateCustomer: builder.mutation<
      Customer,
      { id: string | number; patch: Partial<Customer> }
    >({
      query: ({ id, patch }) => ({
        url: `/admin/customers/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),

    deleteCustomer: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/customers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Customer", id: "LIST" }],
    }),

    exportCustomers: builder.query<
      Blob,
      { format: "CSV" | "XLSX" | "PDF"; filters?: CustomerFilters }
    >({
      query: ({ format, filters }) => {
        const params = new URLSearchParams();
        params.set("format", format);
        if (filters?.search) params.set("search", filters.search);
        if (filters?.groupId && filters.groupId !== "GUEST") params.set("groupId", filters.groupId);
        return {
          url: `/admin/customers/export?${params.toString()}`,
          method: "GET",
          responseHandler: async (response) => await response.blob(),
        };
      },
    }),

    getStockList: builder.query<
      PaginatedResponse<StockItem> & { summary: StockSummary },
      StockFilters
    >({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.lowStock) params.set("lowStock", "true");
        if (filters.outOfStock) params.set("outOfStock", "true");
        if (filters.search) params.set("search", filters.search);
        params.set("page", String(filters.page ?? 1));
        params.set("perPage", String(filters.limit ?? 50));
        return {
          url: `/admin/inventory/stock?${params.toString()}`,
          method: "GET",
        };
      },
      transformResponse: (res: {
        items: ApiStockRow[];
        summary: StockSummary;
        total: number;
        page: number;
        perPage: number;
        totalPages: number;
      }) => ({
        items: res.items.map((r) => ({
          ...r,
          ...MAIN_WAREHOUSE,
          productVariantId: r.variantId ?? r.productId,
          imageUrl: r.imageUrl ?? undefined,
          reorderPoint: r.lowStockThreshold,
          lastAdjustedAt: r.lastAdjustedAt ?? undefined,
        })),
        summary: res.summary,
        total: res.total,
        page: res.page,
        limit: res.perPage,
        totalPages: res.totalPages,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((s) => ({ type: "Product" as const, id: s.productId })),
              { type: "Product", id: "STOCK_LIST" },
            ]
          : [{ type: "Product", id: "STOCK_LIST" }],
    }),

    adjustStock: builder.mutation<unknown, AdjustStockInput>({
      query: ({ productId, variantId, currentQty, quantity, type, reason, note }) => {
        const delta =
          type === "SET" || type === "INVENTORY_COUNT"
            ? quantity - currentQty
            : type === "DEDUCT" || type === "DAMAGE"
              ? -Math.abs(quantity)
              : Math.abs(quantity);
        return {
          url: `/admin/inventory/adjust`,
          method: "POST",
          body: {
            lines: [
              {
                ...(variantId ? { variantId } : { productId }),
                delta,
                reason: reason ?? (type === "DAMAGE" ? "DAMAGED" : undefined),
                note: note || undefined,
              },
            ],
          },
        };
      },
      invalidatesTags: [
        { type: "Product", id: "STOCK_LIST" },
        { type: "Product", id: "INVENTORY_LOGS" },
      ],
    }),

    updateStockThreshold: builder.mutation<unknown, { productId: string; variantId: string | null; threshold: number }>({
      query: ({ productId, variantId, threshold }) => ({
        url: variantId ? `/admin/products/variants/${variantId}` : `/admin/products/${productId}`,
        method: "PATCH",
        body: { lowStockThreshold: threshold },
      }),
      invalidatesTags: [{ type: "Product", id: "STOCK_LIST" }],
    }),

    // Stock is a single pool per SKU (no warehouse model yet), so there is nothing to transfer between.
    createTransfer: builder.mutation<StockTransfer, CreateTransferInput>({
      queryFn: async () => ({
        error: { status: 400, data: "Transfers need multiple warehouses, which the store does not have yet." },
      }),
    }),

    getInventoryLogs: builder.query<
      PaginatedResponse<InventoryLog>,
      { productId?: string | number; page?: number; limit?: number }
    >({
      query: ({ productId, page, limit }) => {
        const params = new URLSearchParams();
        if (productId) params.set("productId", String(productId));
        params.set("page", String(page ?? 1));
        params.set("perPage", String(limit ?? 50));
        return {
          url: `/admin/inventory/movements?${params.toString()}`,
          method: "GET",
        };
      },
      transformResponse: (items: ApiMovement[], meta) => toPaginated(items.map(fromApiMovement), meta),
      providesTags: [{ type: "Product", id: "INVENTORY_LOGS" }],
    }),

    getStockTransfers: builder.query<
      PaginatedResponse<StockTransfer>,
      { page?: number; limit?: number }
    >({
      queryFn: async () => ({ data: { items: [], total: 0, page: 1, limit: 0, totalPages: 1 } }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOrderListQuery,
  useGetOrderQuery,
  useUpdateOrderStatusMutation,
  useBulkUpdateOrderStatusMutation,
  useOrderInvoiceMutation,
  useOrderInvoicesMutation,
  useSendOrderEmailMutation,
  useCreateOrderNoteMutation,
  useGetCustomersQuery,
  useGetCustomerGroupsQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useLazyExportCustomersQuery,
  useGetStockListQuery,
  useAdjustStockMutation,
  useUpdateStockThresholdMutation,
  useCreateTransferMutation,
  useGetInventoryLogsQuery,
  useGetStockTransfersQuery,
} = operationsApiSlice;
