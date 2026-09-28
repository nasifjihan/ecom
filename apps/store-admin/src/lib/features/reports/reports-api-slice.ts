"use client";

/** Store reports: sales and profit, products, discounts, customers, couriers, returns, tax, stock value (API: modules/reports). */
import { api } from "@ecom/api-client";

export type Basis = "placed" | "delivered";
export interface RangeArgs {
  from?: string;
  to?: string;
  basis?: Basis;
}

interface Head {
  from: string;
  to: string;
  days: number;
  timezone: string;
  basis?: Basis;
}

export interface Figures {
  orders: number;
  itemsSubtotal: number;
  discounts: number;
  shipping: number;
  tax: number;
  refunds: number;
  cogs: number;
  units: number;
  unitsWithCost: number;
  netSales: number;
  grossProfit: number;
  margin: number | null;
  averageOrder: number;
  costCoverage: number | null;
}

export interface SalesReport extends Head {
  previous: { from: string; to: string };
  bucket: "day" | "week" | "month";
  total: Figures;
  changes: { orders: number | null; netSales: number | null; grossProfit: number | null; averageOrder: number | null };
  series: (Figures & { period: string })[];
  bySource: (Figures & { key: string; share: number | null })[];
  byPayment: (Figures & { key: string; share: number | null })[];
}

export interface ProductsReport extends Head {
  sort: "revenue" | "units" | "profit";
  products: {
    productId: string | null;
    name: string;
    sku: string | null;
    category: string | null;
    orders: number;
    units: number;
    unitsReturned: number;
    revenue: number;
    refunded: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    margin: number | null;
    costCoverage: number | null;
  }[];
  categories: { category: string; products: number; units: number; netSales: number; cogs: number; grossProfit: number; margin: number | null }[];
}

export interface DiscountsReport extends Head {
  totals: {
    orders: number;
    ordersWithCoupon: number;
    ordersWithPromotion: number;
    couponDiscount: number;
    promotionDiscount: number;
    manualDiscount: number;
    allDiscounts: number;
    discountRate: number | null;
  };
  coupons: { code: string; orders: number; discount: number; sales: number; averageOrder: number; customers: number; newCustomers: number; salesPerTaka: number | null }[];
  promotions: { name: string; type: string; orders: number; discount: number; sales: number }[];
}

export interface CustomersReport extends Head {
  totals: {
    customers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatCustomers: number;
    repeatRate: number | null;
    customerOrders: number;
    guestOrders: number;
    customerSales: number;
    guestSales: number;
    salesPerCustomer: number;
  };
  topCustomers: { id: string; name: string; phone: string | null; email: string | null; orders: number; sales: number; lifetimeOrders: number; lastOrderAt: string }[];
  byArea: { area: string; orders: number; sales: number }[];
}

export interface CouriersReport extends Head {
  couriers: {
    code: string;
    name: string;
    parcels: number;
    delivered: number;
    failed: number;
    returned: number;
    cancelled: number;
    inProgress: number;
    successRate: number | null;
    returnRate: number | null;
    codDelivered: number;
    deliveryFees: number;
    averageDays: number | null;
    payouts: number;
    paidOut: number;
    charges: number;
    shortfall: number;
  }[];
  cod: { total: number; withCourier: number; cashInHand: number; received: number; notCollected: number; outstanding: number };
  unsettledShortfall: number;
}

export interface ReturnsReport extends Head {
  totals: { refunds: number; refunded: number; refundedOrders: number; returns: number; ordersPlaced: number; returnRate: number | null };
  refundsByMethod: { key: string; refunds: number; amount: number }[];
  refundsByReason: { key: string; refunds: number; amount: number }[];
  returnsByStatus: { key: string; returns: number; amount: number }[];
  returnsByReason: { key: string; returns: number }[];
  mostRefunded: { name: string; units: number; amount: number }[];
}

export interface TaxReport extends Head {
  bucket: "day" | "month";
  totals: { orders: number; taxedOrders: number; sales: number; shipping: number; tax: number; effectiveRate: number | null };
  periods: { period: string; orders: number; taxedOrders: number; sales: number; shipping: number; tax: number }[];
}

export interface StockReport {
  asOf: string;
  totals: { products: number; units: number; costValue: number; retailValue: number; potentialProfit: number; unitsWithoutCost: number; productsWithoutCost: number };
  categories: { category: string; products: number; units: number; costValue: number; retailValue: number }[];
  products: { productId: string; name: string; sku: string | null; category: string; units: number; unitsWithoutCost: number; costValue: number; retailValue: number; potentialProfit: number }[];
}

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const TAG = [{ type: "Report" as const, id: "STORE" }];
/** Reports are read-only views of live data; refetch when reopened after a minute. */
const report = (path: string) => ({
  query: (args: object) => ({ url: `/admin/reports/${path}`, params: clean(args) }),
  providesTags: TAG,
  keepUnusedDataFor: 60,
});

export const reportsApi = api.injectEndpoints({
  endpoints: (b) => ({
    salesReport: b.query<SalesReport, RangeArgs>(report("sales")),
    productsReport: b.query<ProductsReport, RangeArgs & { sort?: ProductsReport["sort"] }>(report("products")),
    discountsReport: b.query<DiscountsReport, RangeArgs>(report("discounts")),
    customersReport: b.query<CustomersReport, RangeArgs>(report("customers")),
    couriersReport: b.query<CouriersReport, RangeArgs>(report("couriers")),
    returnsReport: b.query<ReturnsReport, RangeArgs>(report("returns")),
    taxReport: b.query<TaxReport, RangeArgs>(report("tax")),
    stockReport: b.query<StockReport, void>({ query: () => "/admin/reports/stock", providesTags: TAG, keepUnusedDataFor: 60 }),
  }),
});

export const {
  useSalesReportQuery,
  useProductsReportQuery,
  useDiscountsReportQuery,
  useCustomersReportQuery,
  useCouriersReportQuery,
  useReturnsReportQuery,
  useTaxReportQuery,
  useStockReportQuery,
} = reportsApi;
