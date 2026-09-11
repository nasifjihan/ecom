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
    avatar?: string | null;
  };
  storeId?: string;
  store?: {
    id: string;
    name: string;
  };
  permissions: string[];
}

export const authApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Me"],
    }),
    refresh: builder.mutation<{ accessToken: string }, { refreshToken: string }>({
      query: (body) => ({
        url: "/auth/refresh",
        method: "POST",
        body,
      }),
    }),
    me: builder.query<MeResponse, void>({
      query: () => "/auth/me",
      providesTags: ["Me"],
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
} = authApiSlice;
