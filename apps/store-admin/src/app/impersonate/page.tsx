"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { logout, setAccessToken } from "@/lib/features/auth/auth-slice";

/**
 * Landing page for "Log in as owner" in the super admin. The platform API hands
 * out a short-lived owner access token, passed in the URL hash so it never
 * reaches a server log. Store it like a normal login, then go to the dashboard.
 */
export default function ImpersonatePage() {
  const dispatch = useDispatch();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    // Drop the token from the address bar and history either way.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setFailed(true);
      return;
    }
    let storeId: string | undefined;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
      storeId = payload.storeId;
    } catch {
      setFailed(true);
      return;
    }
    dispatch(logout());
    dispatch(setAccessToken(token));
    if (storeId) {
      window.localStorage.setItem("storeId", storeId);
      document.cookie = `X-Store-Id=${storeId}; path=/; SameSite=Lax`;
    }
    // Full navigation so no cached data from an earlier session survives.
    window.location.replace("/dashboard");
  }, [dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      {failed ? (
        <div className="space-y-2">
          <p className="font-semibold">This sign-in link is missing or invalid.</p>
          <Link href="/login" className="text-sm underline">
            Go to the login page
          </Link>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Signing you in as the store owner...</p>
      )}
    </div>
  );
}
