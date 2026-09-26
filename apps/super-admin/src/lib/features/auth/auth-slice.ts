"use client";

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const SUPER_AUDIENCE = "super";

export interface SuperAuthUser {
  id: string | number;
  name: string;
  email: string;
  /** PlatformAdmin.role, e.g. "super_owner". */
  role: string;
  lastLoginAt?: string | null;
}

interface SuperAuthState {
  user: SuperAuthUser | null;
  accessToken: string | null;
  permissions: string[];
  audience: typeof SUPER_AUDIENCE;
}

const initialState: SuperAuthState = {
  user: null,
  accessToken:
    typeof window !== "undefined"
      ? window.localStorage.getItem("superAccessToken")
      : null,
  permissions: [],
  audience: SUPER_AUDIENCE,
};

const superAuthSlice = createSlice({
  name: "superAuth",
  initialState,
  reducers: {
    setSuperCredentials: (
      state,
      action: PayloadAction<{
        user: SuperAuthUser;
        accessToken: string;
        permissions?: string[];
      }>,
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.permissions = action.payload.permissions ?? ["*"];
      state.audience = SUPER_AUDIENCE;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "superAccessToken",
          action.payload.accessToken,
        );
        if (action.payload.user) {
          window.localStorage.setItem(
            "superUser",
            JSON.stringify(action.payload.user),
          );
        }
      }
    },
    setSuperAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("superAccessToken", action.payload);
        document.cookie = `superAccessToken=${action.payload}; path=/; SameSite=Lax`;
      }
    },
    superLogout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.permissions = [];

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("superAccessToken");
        window.localStorage.removeItem("superUser");
        document.cookie =
          "superAccessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
    },
  },
});

export const { setSuperCredentials, setSuperAccessToken, superLogout } = superAuthSlice.actions;
export default superAuthSlice.reducer;
