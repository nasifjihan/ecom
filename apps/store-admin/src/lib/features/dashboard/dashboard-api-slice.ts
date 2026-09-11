"use client";

import { api } from "@ecom/api-client";

export interface DashboardStats {
  totalRevenue: number;
  ordersCount: number;
  customersCount: number;
  conversionRate: number;
  revenueDelta?: number;
  ordersDelta?: number;
  customersDelta?: number;
  conversionDelta?: number;
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

export interface DashboardQueries {
  from?: string;
  to?: string;
  days?: number;
  limit?: number;
}

export const dashboardApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, DashboardQueries>({
      query: ({ from, to }) => {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        return {
          url: `/admin/dashboard/stats?${params.toString()}`,
          method: "GET",
        };
      },
    }),
    getRevenueChart: builder.query<RevenueChartPoint[], { days?: number }>({
      query: ({ days = 30 }) => ({
        url: `/admin/dashboard/revenue-chart?days=${days}`,
        method: "GET",
      }),
    }),
    getTopProducts: builder.query<TopProduct[], { limit?: number }>({
      query: ({ limit = 5 }) => ({
        url: `/admin/dashboard/top-products?limit=${limit}`,
        method: "GET",
      }),
    }),
    getRecentOrders: builder.query<RecentOrder[], { limit?: number }>({
      query: ({ limit = 10 }) => ({
        url: `/admin/dashboard/recent-orders?limit=${limit}`,
        method: "GET",
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardStatsQuery,
  useGetRevenueChartQuery,
  useGetTopProductsQuery,
  useGetRecentOrdersQuery,
} = dashboardApiSlice;
