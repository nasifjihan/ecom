"use client";

import { configureStore, combineReducers, createReducer } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "@ecom/api-client";
import type { TypedUseSelectorHook } from "react-redux";
import { useDispatch, useSelector } from "react-redux";

type AuthSliceState = {
  isAuthenticated: boolean;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  token: string | null;
};

const initialAuthState: AuthSliceState = {
  isAuthenticated: false,
  customerId: null,
  customerEmail: null,
  customerName: null,
  token: null,
};

const authReducer = createReducer<AuthSliceState>(initialAuthState, (builder) => {
  builder
    .addMatcher(
      (action: { type: string }) => action.type?.startsWith("auth/"),
      (_state, action: { payload?: Partial<AuthSliceState> }) => ({
        ..._state,
        ...(action.payload ?? {}),
      }),
    )
    .addDefaultCase((state) => state);
});

const rootReducer = combineReducers({
  auth: authReducer,
  [api.reducerPath]: api.reducer,
});

export const makeStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).concat(api.middleware),
    devTools: process.env.NODE_ENV !== "production",
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

let clientStore: AppStore | undefined;

export function getOrCreateStore(preloadedState?: Partial<RootState>): AppStore {
  const isServer = typeof window === "undefined";
  if (isServer) return makeStore(preloadedState);

  if (!clientStore) {
    clientStore = makeStore(preloadedState);
    setupListeners(clientStore.dispatch);
  }
  return clientStore;
}
