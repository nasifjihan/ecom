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
  permissions: string[];
}

export interface SuperMeResponse {
  user: SuperAuthUser;
  permissions: string[];
}

/** PlatformAdmin row as returned by /auth/super/login and /auth/me/super. */
interface ApiPlatformAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt?: string | null;
}

const toSuperUser = (u: ApiPlatformAdmin): SuperAuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  lastLoginAt: u.lastLoginAt ?? null,
});

export const superAuthApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    loginSuper: builder.mutation<SuperLoginResponse, SuperLoginCredentials>({
      query: ({ email, password }) => ({
        url: "/auth/super/login",
        method: "POST",
        body: { email, password },
      }),
      // The refresh token is set as an httpOnly cookie by the API, not returned in the body.
      transformResponse: (res: { accessToken: string; user: ApiPlatformAdmin }) => ({
        user: toSuperUser(res.user),
        accessToken: res.accessToken,
        permissions: ["*"],
      }),
      invalidatesTags: ["Me"],
    }),
    meSuper: builder.query<SuperMeResponse, void>({
      query: () => "/auth/me/super",
      transformResponse: (u: ApiPlatformAdmin) => ({ user: toSuperUser(u), permissions: ["*"] }),
      providesTags: ["Me"],
    }),
    logoutSuper: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
        body: {},
      }),
      invalidatesTags: ["Me"],
    }),
  }),
  overrideExisting: false,
});

export const { useLoginSuperMutation, useMeSuperQuery, useLogoutSuperMutation } = superAuthApiSlice;
