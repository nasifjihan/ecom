"use client";

import * as React from "react";

const newKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Adds an Idempotency-Key to a request body (as `idempotencyKey`, sent as the header). The key
 * stays the same while the body does, so a double click or a retry after a lost connection places
 * one order; any change to the order gets a new key.
 */
export function useIdempotencyKey() {
  const last = React.useRef<{ body: string; key: string } | null>(null);
  return React.useCallback(<T extends object>(body: T): T & { idempotencyKey: string } => {
    const b = JSON.stringify(body);
    if (last.current?.body !== b) last.current = { body: b, key: newKey() };
    return { ...body, idempotencyKey: last.current.key };
  }, []);
}
