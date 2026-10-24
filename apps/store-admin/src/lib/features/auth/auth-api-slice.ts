"use client";

import { api } from "@ecom/api-client";

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  /** Two-step sign-in: the authenticator code or a backup code (asked for after AUTH_2FA_REQUIRED). */
  code?: string;
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
    /** On the sales team (has a My commission page). */
    isSalesperson?: boolean;
  };
  storeId?: string;
  store?: {
    id: string;
    name: string;
  };
  permissions: string[];
  /** The store requires two-step sign-in and this person hasn't set it up yet. */
  twoFactorSetupRequired?: boolean;
}

/** AdminUser row as returned by /auth/admin/login and /auth/me/admin. */
interface ApiAdminUser {
  id: string;
  storeId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isSalesperson?: boolean;
  roleId?: string;
  role?: { name: string; permissions?: { permission: string }[] } | null;
  twoFactorSetupRequired?: boolean;
}

const toAuthUser = (u: ApiAdminUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role?.name,
  roleId: u.roleId,
  avatar: u.avatarUrl ?? null,
  isSalesperson: !!u.isSalesperson,
});

export const authApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: ({ email, password, code }) => ({
        url: "/auth/admin/login",
        method: "POST",
        body: { email, password, ...(code ? { code } : {}) },
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
        twoFactorSetupRequired: !!u.twoFactorSetupRequired,
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
