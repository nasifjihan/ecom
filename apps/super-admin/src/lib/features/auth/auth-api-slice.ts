"use client";

import { api } from "@ecom/api-client";
import type { SuperAuthUser } from "./auth-slice";

export interface SuperLoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SuperLoginResponse {
  user: SuperAuthUser;
  accessToken: string;
  refreshToken: string;
  permissions: string[];
  audience: "super";
}

export interface SuperMeResponse {
  user: SuperAuthUser;
  permissions: string[];
  audience: "super";
}

export interface SuperDashboardStats {
  totalStores: number;
  activeStores: number;
  trialStores: number;
  suspendedStores: number;
  cancelledStores: number;
  totalMRR: number;
  newSignupsToday: number;
  newSignups7d: number;
  newSignups30d: number;
  churnRate: number;
  arpu: number;
  ltv: number;
  platformOrders: number;
  platformRevenue: number;
  activeAdmins: number;
  systemHealth: {
    cpu: string;
    memory: string;
    database: string;
    redis: string;
  };
  monthlyMRR: Array<{
    month: string;
    trial: number;
    starter: number;
    pro: number;
    enterprise: number;
  }>;
  topStores: Array<{
    rank: number;
    storeName: string;
    domain: string;
    plan: string;
    revenue: number;
    orders: number;
  }>;
  plansDistribution: Array<{
    plan: string;
    count: number;
    value: number;
  }>;
}

export const superAuthApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    loginSuper: builder.mutation<SuperLoginResponse, SuperLoginCredentials>({
      query: (credentials) => ({
        url: "/super/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Me"],
    }),
    refreshSuper: builder.mutation<
      { accessToken: string },
      { refreshToken: string }
    >({
      query: (body) => ({
        url: "/super/auth/refresh",
        method: "POST",
        body,
      }),
    }),
    meSuper: builder.query<SuperMeResponse, void>({
      query: () => "/super/auth/me",
      providesTags: ["Me"],
    }),
    logoutSuper: builder.mutation<void, void>({
      query: () => ({
        url: "/super/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Me"],
    }),
    getSuperDashboardStats: builder.query<SuperDashboardStats, void>({
      query: () => "/super/dashboard/stats",
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginSuperMutation,
  useRefreshSuperMutation,
  useMeSuperQuery,
  useLogoutSuperMutation,
  useGetSuperDashboardStatsQuery,
} = superAuthApiSlice;
