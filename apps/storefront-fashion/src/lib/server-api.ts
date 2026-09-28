/**
 * Server-side fetch helper for Server Components / metadata / sitemap.
 *
 * The API resolves the store from the request Origin (apps/api 10-tenant.ts), and a
 * server-side fetch has no browser Origin, so we send the storefront's own origin.
 */
import { cookies } from "next/headers";
import type { ApiEnvelope } from "@ecom/api-client";
import { LOCALE_COOKIE, toLocale, type Locale } from "@ecom/storefront-base";

const API_BASE =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
const STORE_ORIGIN =
  process.env.STOREFRONT_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * The language the shopper picked (the `lang` cookie), or null for the shop's default.
 * Not wrapped in try/catch: Next signals "this page reads cookies" by throwing here.
 */
export async function cookieLocale(): Promise<Locale | null> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/** `path` with `lang=` added, so the API answers in that language and cached copies stay apart. */
export async function withLang(path: string): Promise<string> {
  const lang = await cookieLocale();
  return lang ? `${path}${path.includes("?") ? "&" : "?"}lang=${lang}` : path;
}

/** Returns the envelope's `data`, or null when the API is down or answers with an error. */
export async function serverApi<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  const url = `${API_BASE}${await withLang(path)}`;
  try {
    const res = await fetch(url, {
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
