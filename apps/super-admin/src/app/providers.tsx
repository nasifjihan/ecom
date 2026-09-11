"use client";

import { useRef, useEffect } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { AppStore } from "@/lib/store";
import { makeStore } from "@/lib/store";
import { configureApiClient } from "@ecom/api-client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  useEffect(() => {
    configureApiClient({
      baseUrl:
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
      getToken: () => {
        if (typeof window === "undefined") return undefined;
        return window.localStorage.getItem("superAccessToken");
      },
    });
  }, []);

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
