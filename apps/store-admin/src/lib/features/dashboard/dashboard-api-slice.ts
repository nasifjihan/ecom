"use client";

import { api } from "@ecom/api-client";

export interface DashboardTotals {
  /** Paid orders only, within the window. */
  revenue: number;
  orders: number;
  customers: number;
  averageOrderValue: number;
}

export interface RevenueChartPoint {
  date: string;
  revenue: number;
}

export interface TopProduct {
  id: string | number;
  name: string;
  sales: number;
  revenue: number;
}

export interface RecentOrder {
  id: string | number;
  orderNumber: string;
  customerName: string;
  date: string;
  status: string;
  total: number;
}

export interface DashboardOverview {
  totals: DashboardTotals;
  revenueChart: RevenueChartPoint[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
}

export const dashboardApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardOverview: builder.query<DashboardOverview, { days?: number }>({
      query: ({ days = 30 }) => `/admin/dashboard/overview?days=${days}`,
      providesTags: ["Order", "Product", "Customer"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardOverviewQuery } = dashboardApiSlice;
