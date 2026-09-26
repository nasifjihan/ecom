/**
 * Server-side fetch helper for Server Components / metadata / sitemap.
 *
 * The API resolves the store from the request Origin (apps/api 10-tenant.ts), and a
 * server-side fetch has no browser Origin, so we send the storefront's own origin.
 */
import type { ApiEnvelope } from "@ecom/api-client";

const API_BASE =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
const STORE_ORIGIN =
  process.env.STOREFRONT_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Returns the envelope's `data`, or null when the API is down or answers with an error. */
export async function serverApi<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json", Origin: STORE_ORIGIN },
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiEnvelope<T>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}
