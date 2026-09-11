"use client";

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  role?: string;
  avatar?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  storeId: string | null;
  permissions: string[];
}

const initialState: AuthState = {
  user: null,
  accessToken:
    typeof window !== "undefined"
      ? window.localStorage.getItem("accessToken")
      : null,
  storeId: null,
  permissions: [],
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: AuthUser;
        accessToken: string;
        storeId?: string | null;
        permissions?: string[];
      }>,
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.storeId = action.payload.storeId ?? state.storeId;
      state.permissions = action.payload.permissions ?? state.permissions;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("accessToken", action.payload.accessToken);
        if (action.payload.storeId) {
          window.localStorage.setItem("storeId", action.payload.storeId);
        }
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.storeId = null;
      state.permissions = [];

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("storeId");
        document.cookie =
          "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie =
          "X-Store-Id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
