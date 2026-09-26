"use client";

import * as React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { CartProvider as StorefrontCartProvider } from "@ecom/storefront-base";
import { getOrCreateStore, type AppStore } from "@/lib/store";
import { configureApiClient } from "@ecom/api-client";
import { restoreSession, storeRefreshedToken } from "@/lib/account";

let apiConfigured = false;

function ensureApiConfigured(store: AppStore) {
  if (apiConfigured) return;
  const baseUrl =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE_URL : undefined) ??
    "http://localhost:4000/api";
  configureApiClient({
    baseUrl,
    getToken: () => {
      try {
        if (typeof window === "undefined") return undefined;
        return window.localStorage.getItem("accessToken");
      } catch {
        return undefined;
      }
    },
    // Customer access tokens are short-lived; renew them from the refresh cookie.
    refresh: {
      path: "/auth/customer/refresh",
      onRefreshed: (token) => storeRefreshedToken(token, store.dispatch),
    },
  });
  restoreSession(store.dispatch);
  apiConfigured = true;
}

const CartProvider = StorefrontCartProvider as unknown as React.ComponentType<any>;

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  const store = React.useMemo(() => getOrCreateStore(), []);

  React.useEffect(() => {
    ensureApiConfigured(store);
    setMounted(true);
  }, [store]);

  return (
    <ReduxProvider store={store}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <CartProvider storeId="fashion_bd">{children}</CartProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "0.625rem",
            },
            className: "bg-card text-card-foreground border",
          }}
          richColors
          closeButton
        />
        <noscript>{/* hydrate guard */}</noscript>
        {mounted ? null : (
          <script
            // hydrate helper
            dangerouslySetInnerHTML={{ __html: "/* ensure hydration */" }}
          />
        )}
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default Providers;
