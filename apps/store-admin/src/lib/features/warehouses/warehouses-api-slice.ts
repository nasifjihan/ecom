"use client";

/** Warehouses, stock per warehouse, transfers between them, and where an order ships from (API: modules/stock). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  skus: number;
  onHand: number;
  reserved: number;
  available: number;
  valueAtCost: number;
  incomingTransfers: number;
}

export type WarehouseInput = Partial<{ name: string; code: string; address: string; phone: string; isDefault: boolean; isActive: boolean; sortOrder: number }>;

export interface StockRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  onHand: number;
  reserved: number;
  byWarehouse: { warehouseId: string; code: string; onHand: number; reserved: number; bin: string | null }[];
}

export interface Transfer {
  id: string;
  code: string;
  status: "in_transit" | "received" | "cancelled";
  from: { id: string; name: string; code: string };
  to: { id: string; name: string; code: string };
  note: string | null;
  receivedNote: string | null;
  sentAt: string;
  receivedAt: string | null;
  cancelledAt: string | null;
  units: number;
  unitsReceived: number | null;
  shortfall: number | null;
  items: { id: string; productId: string; variantId: string | null; name: string; sku: string | null; qtySent: number; qtyReceived: number | null }[];
}

export interface OrderStock {
  warehouse: { id: string; name: string; code: string } | null;
  canMove: boolean;
  warehouses: { id: string; name: string; code: string }[];
  lines: {
    orderItemId: string;
    name: string;
    quantity: number;
    held: number;
    onShelf: number;
    short: number;
    elsewhere: { warehouseId: string; code: string; free: number }[];
  }[];
}

const T = (id: string) => ({ type: "Product" as const, id });
const STOCK = [T("WAREHOUSES"), T("WAREHOUSE_STOCK"), T("STOCK_LIST"), T("INVENTORY_LOGS")];
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export const warehousesApi = api.injectEndpoints({
  endpoints: (b) => ({
    warehouses: b.query<Warehouse[], void>({ query: () => "/admin/warehouses", providesTags: [T("WAREHOUSES")] }),
    createWarehouse: b.mutation<Warehouse[], WarehouseInput>({
      query: (body) => ({ url: "/admin/warehouses", method: "POST", body }),
      invalidatesTags: STOCK,
    }),
    updateWarehouse: b.mutation<Warehouse[], WarehouseInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/warehouses/${id}`, method: "PATCH", body }),
      invalidatesTags: STOCK,
    }),
    deleteWarehouse: b.mutation<Warehouse[], string>({
      query: (id) => ({ url: `/admin/warehouses/${id}`, method: "DELETE" }),
      invalidatesTags: STOCK,
    }),
    warehouseStock: b.query<{ warehouses: { id: string; code: string; name: string; isActive: boolean }[]; items: StockRow[] }, { search?: string; warehouseId?: string; inStockOnly?: "true" }>({
      query: (params) => ({ url: "/admin/warehouses/stock", params: clean(params) }),
      providesTags: [T("WAREHOUSE_STOCK")],
    }),
    transfers: b.query<Paginated<Transfer>, { status?: Transfer["status"]; page?: number }>({
      query: (params) => ({ url: "/admin/warehouses/transfers", params: clean(params) }),
      transformResponse: (items: Transfer[], meta) => toPaginated(items, meta),
      providesTags: [T("TRANSFERS")],
    }),
    transfer: b.query<Transfer, string>({ query: (id) => `/admin/warehouses/transfers/${id}`, providesTags: [T("TRANSFERS")] }),
    sendTransfer: b.mutation<Transfer, { fromWarehouseId: string; toWarehouseId: string; items: { productId: string; variantId: string | null; qty: number }[]; note?: string }>({
      query: (body) => ({ url: "/admin/warehouses/transfers", method: "POST", body }),
      invalidatesTags: [...STOCK, T("TRANSFERS")],
    }),
    receiveTransfer: b.mutation<Transfer, { id: string; items: { id: string; qty: number }[]; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/warehouses/transfers/${id}/receive`, method: "POST", body }),
      invalidatesTags: [...STOCK, T("TRANSFERS")],
    }),
    cancelTransfer: b.mutation<Transfer, string>({
      query: (id) => ({ url: `/admin/warehouses/transfers/${id}/cancel`, method: "POST" }),
      invalidatesTags: [...STOCK, T("TRANSFERS")],
    }),
    orderStock: b.query<OrderStock, string>({
      query: (orderId) => `/admin/warehouses/orders/${orderId}`,
      providesTags: (_r, _e, id) => [{ type: "Order" as const, id }, T("WAREHOUSE_STOCK")],
    }),
    moveOrderWarehouse: b.mutation<OrderStock, { orderId: string; warehouseId: string }>({
      query: ({ orderId, warehouseId }) => ({ url: `/admin/warehouses/orders/${orderId}`, method: "POST", body: { warehouseId } }),
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order" as const, id: orderId }, ...STOCK],
    }),
  }),
});

export const {
  useWarehousesQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
  useWarehouseStockQuery,
  useTransfersQuery,
  useTransferQuery,
  useSendTransferMutation,
  useReceiveTransferMutation,
  useCancelTransferMutation,
  useOrderStockQuery,
  useMoveOrderWarehouseMutation,
} = warehousesApi;

export const transferStatusLabel: Record<Transfer["status"], string> = {
  in_transit: "On the way",
  received: "Received",
  cancelled: "Cancelled",
};
