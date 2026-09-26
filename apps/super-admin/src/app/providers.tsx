"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { AppStore } from "@/lib/store";
import { makeStore } from "@/lib/store";
import { configureApiClient } from "@ecom/api-client";
import { setSuperAccessToken, superLogout } from "@/lib/features/auth/auth-slice";

export default function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    const store = makeStore();
    storeRef.current = store;
    // Configured before the first render so the first queries already send the super token.
    configureApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
      getToken: () => {
        if (typeof window === "undefined") return undefined;
        return window.localStorage.getItem("superAccessToken");
      },
      refresh: {
        path: "/auth/super/refresh",
        onRefreshed: (token) => {
          if (token) {
            store.dispatch(setSuperAccessToken(token));
          } else {
            store.dispatch(superLogout());
            window.location.assign(`/super/login?redirect=${encodeURIComponent(window.location.pathname)}`);
          }
        },
      },
    });
  }

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </ThemeProvider>
    </Provider>
  );
}
