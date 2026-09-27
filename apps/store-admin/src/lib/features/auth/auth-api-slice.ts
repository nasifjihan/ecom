"use client";

import { api } from "@ecom/api-client";

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: {
    id: string | number;
    name: string;
    email: string;
    role?: string;
    avatar?: string | null;
  };
  accessToken: string;
  refreshToken: string;
  storeId?: string;
  store?: {
    id: string;
    name: string;
  };
  permissions: string[];
}

export interface MeResponse {
  user: {
    id: string | number;
    name: string;
    email: string;
    role?: string;
    roleId?: string;
    avatar?: string | null;
  };
  storeId?: string;
  store?: {
    id: string;
    name: string;
  };
  permissions: string[];
}

/** AdminUser row as returned by /auth/admin/login and /auth/me/admin. */
interface ApiAdminUser {
  id: string;
  storeId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleId?: string;
  role?: { name: string; permissions?: { permission: string }[] } | null;
}

const toAuthUser = (u: ApiAdminUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role?.name,
  roleId: u.roleId,
  avatar: u.avatarUrl ?? null,
});

export const authApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: ({ email, password }) => ({
        url: "/auth/admin/login",
        method: "POST",
        body: { email, password },
      }),
      // The refresh token is set as an httpOnly cookie by the API, not returned in the body.
      transformResponse: (res: { accessToken: string; user: ApiAdminUser; permissions: string[] }) => ({
        user: toAuthUser(res.user),
        accessToken: res.accessToken,
        refreshToken: "",
        storeId: res.user.storeId,
        permissions: res.permissions,
      }),
      invalidatesTags: ["Me"],
    }),
    refresh: builder.mutation<{ accessToken: string }, void>({
      query: () => ({
        url: "/auth/admin/refresh",
        method: "POST",
        body: {},
      }),
    }),
    me: builder.query<MeResponse, void>({
      query: () => "/auth/me/admin",
      transformResponse: (u: ApiAdminUser) => ({
        user: toAuthUser(u),
        storeId: u.storeId,
        permissions: u.role?.permissions?.map((p) => p.permission) ?? [],
      }),
      providesTags: ["Me"],
    }),
    forgotPassword: builder.mutation<{ sent: boolean }, { email: string }>({
      query: (body) => ({ url: "/auth/admin/forgot-password", method: "POST", body }),
    }),
    resetPassword: builder.mutation<{ email: string }, { token: string; password: string }>({
      query: (body) => ({ url: "/auth/admin/reset-password", method: "POST", body }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Me"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useMeQuery,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApiSlice;
