"use client";

/**
 * A salesperson's share link (?sp=CODE): remembered in the browser for 30 days and sent with the
 * order, which is then credited to them (their commission). Mounted in the root layout.
 */
import * as React from "react";

const KEY = "sp:v1";
const DAYS = 30;

/** The remembered code, if it hasn't run out. */
export function salesCode(): string | undefined {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return undefined;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > DAYS * 86_400_000) return undefined;
    return code;
  } catch {
    return undefined;
  }
}

export function SalesCodeCapture() {
  React.useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("sp");
      if (code && /^[A-Za-z0-9]{3,20}$/.test(code)) {
        window.localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
      }
    } catch {
      // Storage blocked: the order just isn't credited.
    }
  }, []);
  return null;
}
