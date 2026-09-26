"use client";

import { api, toPaginated } from "@ecom/api-client";

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

export type CustomerGroup = "WHOLESALE" | "RETAIL" | "VIP" | "GUEST";

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
  postcode?: string;
  phone?: string;
  email?: string;
}

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
  paymentStatus?: "PAID" | "UNPAID" | "PARTIALLY_PAID" | "REFUNDED";
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
}

export interface OrderListFilters {
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: PaymentMethod;
  minTotal?: number;
  maxTotal?: number;
  coupon?: boolean;
  shippingZone?: ShippingZone;
  search?: string;
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

export interface RefundLine {
  orderLineId: string | number;
  quantity: number;
  amount: number;
}

export interface Refund {
  id: string | number;
  orderId: string | number;
  lines: RefundLine[];
  reason?: string;
  amount: number;
  method?: string;
  images?: string[];
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
  group?: CustomerGroup;
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
  group: CustomerGroup;
  isVerified?: boolean;
  sendWelcomeEmail?: boolean;
}

export interface StockItem {
  id: string | number;
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
  refunds?: { id: string; amount: string; reason: string | null; createdAt: string; status?: string }[];
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
        refunds?: Refund[];
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
          refunds: (o.refunds ?? []).map((r) => ({
            id: r.id,
            orderId: o.id,
            lines: [],
            reason: r.reason ?? undefined,
            amount: Number(r.amount),
            createdAt: r.createdAt,
          })),
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

    generateOrderInvoicePdf: builder.query<Blob, string | number>({
      query: (id) => ({
        url: `/admin/orders/${id}/invoice`,
        method: "GET",
        responseHandler: async (response) => await response.blob(),
      }),
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

    createRefund: builder.mutation<
      Refund,
      {
        orderId: string | number;
        lines: RefundLine[];
        reason?: string;
        amount: number;
        images?: (File | string)[];
      }
    >({
      query: ({ orderId, ...body }) => ({
        url: `/admin/orders/${orderId}/refunds`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { orderId }) => [
        { type: "Order", id: orderId },
        { type: "Order", id: "LIST" },
      ],
    }),

    updateOrderShippingTracking: builder.mutation<
      Order,
      {
        id: string | number;
        carrier?: string;
        trackingNo?: string;
        shipDate?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/orders/${id}/shipping-tracking`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    getCustomers: builder.query<PaginatedResponse<Customer>, CustomerFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.group) params.set("group", filters.group);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (filters.page) params.set("page", String(filters.page));
        if (filters.limit) params.set("limit", String(filters.limit));
        return {
          url: `/admin/customers?${params.toString()}`,
          method: "GET",
        };
      },
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
      providesTags: (_r, _e, id) => [{ type: "Customer", id }],
    }),

    createCustomer: builder.mutation<Customer, CreateCustomerInput>({
      query: (body) => ({
        url: `/admin/customers`,
        method: "POST",
        body,
      }),
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
        if (filters?.group) params.set("group", filters.group);
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
        if (filters.warehouseIds?.length) {
          filters.warehouseIds.forEach((w) => params.append("warehouseIds", String(w)));
        }
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", String(filters.page));
        if (filters.limit) params.set("limit", String(filters.limit));
        return {
          url: `/admin/inventory/stock?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((s) => ({ type: "Product" as const, id: s.productVariantId })),
              { type: "Product", id: "STOCK_LIST" },
            ]
          : [{ type: "Product", id: "STOCK_LIST" }],
    }),

    adjustStock: builder.mutation<InventoryLog, AdjustStockInput>({
      query: (body) => ({
        url: `/admin/inventory/adjust`,
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Product", id: "STOCK_LIST" },
        { type: "Product", id: "INVENTORY_LOGS" },
      ],
    }),

    createTransfer: builder.mutation<StockTransfer, CreateTransferInput>({
      query: (body) => ({
        url: `/admin/inventory/transfers`,
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Product", id: "STOCK_LIST" },
        { type: "Product", id: "TRANSFERS" },
      ],
    }),

    getInventoryLogs: builder.query<
      PaginatedResponse<InventoryLog>,
      { productId?: string | number; page?: number; limit?: number }
    >({
      query: ({ productId, page, limit }) => {
        const params = new URLSearchParams();
        if (productId) params.set("productId", String(productId));
        if (page) params.set("page", String(page));
        if (limit) params.set("limit", String(limit));
        return {
          url: `/admin/inventory/logs?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: [{ type: "Product", id: "INVENTORY_LOGS" }],
    }),

    getStockTransfers: builder.query<
      PaginatedResponse<StockTransfer>,
      { page?: number; limit?: number }
    >({
      query: ({ page, limit }) => {
        const params = new URLSearchParams();
        if (page) params.set("page", String(page));
        if (limit) params.set("limit", String(limit));
        return {
          url: `/admin/inventory/transfers?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: [{ type: "Product", id: "TRANSFERS" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOrderListQuery,
  useGetOrderQuery,
  useUpdateOrderStatusMutation,
  useBulkUpdateOrderStatusMutation,
  useLazyGenerateOrderInvoicePdfQuery,
  useSendOrderEmailMutation,
  useCreateOrderNoteMutation,
  useCreateRefundMutation,
  useUpdateOrderShippingTrackingMutation,
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useLazyExportCustomersQuery,
  useGetStockListQuery,
  useAdjustStockMutation,
  useCreateTransferMutation,
  useGetInventoryLogsQuery,
  useGetStockTransfersQuery,
} = operationsApiSlice;
