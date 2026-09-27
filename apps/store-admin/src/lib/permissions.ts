"use client";

/** What the signed-in staff member may do, from their role (GET /auth/me/admin). */
import { hasPermission } from "@ecom/shared-types";
import { useMeQuery } from "@/lib/features/auth/auth-api-slice";

export function useCan() {
  const { data, isLoading } = useMeQuery();
  const held = data?.permissions ?? [];
  const can = (code?: string | null) => !code || hasPermission(held, code);
  return { can, ready: !isLoading && !!data, isOwner: held.includes("*") };
}
