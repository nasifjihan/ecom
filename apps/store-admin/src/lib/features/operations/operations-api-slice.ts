"use client";

import { api } from "@ecom/api-client";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PROCESSING"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "FAILED"
  | "SHIPPED"
  | "DELIVERED"
  | "RETURNED";

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

export interface CustomerStatusCounts {
  PENDING_PAYMENT?: number;
  PROCESSING?: number;
  ON_HOLD?: number;
  COMPLETED?: number;
  CANCELLED?: number;
  REFUNDED?: number;
  FAILED?: number;
  SHIPPED?: number;
  DELIVERED?: number;
  RETURNED?: number;
}

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PROCESSING", "ON_HOLD", "CANCELLED", "FAILED"],
  PROCESSING: ["ON_HOLD", "SHIPPED", "CANCELLED", "COMPLETED"],
  ON_HOLD: ["PENDING_PAYMENT", "PROCESSING", "CANCELLED"],
  COMPLETED: ["RETURNED", "REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
  FAILED: ["PENDING_PAYMENT", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["COMPLETED", "RETURNED", "REFUNDED"],
  RETURNED: ["REFUNDED", "COMPLETED"],
};

export const operationsApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrderList: builder.query<
      PaginatedResponse<Order> & { statusCounts: CustomerStatusCounts },
      OrderListFilters
    >({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.status) params.set("status", filters.status);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
        if (filters.minTotal !== undefined) params.set("minTotal", String(filters.minTotal));
        if (filters.maxTotal !== undefined) params.set("maxTotal", String(filters.maxTotal));
        if (filters.coupon !== undefined) params.set("coupon", String(filters.coupon));
        if (filters.shippingZone) params.set("shippingZone", filters.shippingZone);
        if (filters.search) params.set("search", filters.search);
        if (filters.page) params.set("page", String(filters.page));
        if (filters.limit) params.set("limit", String(filters.limit));
        return {
          url: `/admin/orders?${params.toString()}`,
          method: "GET",
        };
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
      providesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),

    updateOrderStatus: builder.mutation<
      Order,
      { id: string | number; status: OrderStatus }
    >({
      query: ({ id, status }) => ({
        url: `/admin/orders/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    bulkUpdateOrderStatus: builder.mutation<
      { updated: number },
      { ids: (string | number)[]; status: OrderStatus }
    >({
      query: (body) => ({
        url: `/admin/orders/bulk-status`,
        method: "POST",
        body,
      }),
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
