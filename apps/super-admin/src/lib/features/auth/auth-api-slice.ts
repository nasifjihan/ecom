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

/** PlatformAdmin row as returned by /auth/super/login and /auth/me/super. */
interface ApiPlatformAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
}

const toSuperUser = (u: ApiPlatformAdmin): SuperAuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as SuperAuthUser["role"],
});

export const superAuthApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    loginSuper: builder.mutation<SuperLoginResponse, SuperLoginCredentials>({
      query: ({ email, password }) => ({
        url: "/auth/super/login",
        method: "POST",
        body: { email, password },
      }),
      // The refresh token comes back as an httpOnly cookie, not in the body.
      transformResponse: (res: { accessToken: string; user: ApiPlatformAdmin }) => ({
        user: toSuperUser(res.user),
        accessToken: res.accessToken,
        refreshToken: "",
        permissions: ["*"],
        audience: "super" as const,
      }),
      invalidatesTags: ["Me"],
    }),
    refreshSuper: builder.mutation<{ accessToken: string }, void>({
      query: () => ({
        url: "/auth/super/refresh",
        method: "POST",
        body: {},
      }),
    }),
    meSuper: builder.query<SuperMeResponse, void>({
      query: () => "/auth/me/super",
      transformResponse: (u: ApiPlatformAdmin) => ({ user: toSuperUser(u), permissions: ["*"], audience: "super" as const }),
      providesTags: ["Me"],
    }),
    logoutSuper: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Me"],
    }),
    getSuperDashboardStats: builder.query<SuperDashboardStats, void>({
      query: () => "/super/dashboard/overview",
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
