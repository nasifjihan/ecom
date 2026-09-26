"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { AppStore } from "@/lib/store";
import { makeStore } from "@/lib/store";
import { configureApiClient } from "@ecom/api-client";
import { logout, setAccessToken } from "@/lib/features/auth/auth-slice";

export default function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    const store = makeStore();
    storeRef.current = store;
    configureApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
      refresh: {
        path: "/auth/admin/refresh",
        onRefreshed: (token) => {
          if (token) {
            store.dispatch(setAccessToken(token));
          } else {
            store.dispatch(logout());
            window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
          }
        },
      },
    });
  }

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </Provider>
  );
}
