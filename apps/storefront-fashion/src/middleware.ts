/**
 * REDIRECTS — sends visitors of an old address to its new one (Online Store → Redirects in the
 * admin). The shop's list comes from the API (already followed to each final address) and is
 * kept for a minute per web address, so most requests need no API call. Hits are counted in the
 * background.
 */
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
const TTL_MS = 60_000;

interface Rule {
  from: string;
  to: string;
  code: number;
}

const cache = new Map<string, { at: number; rules: Map<string, Rule> }>();

/** Same form as the API's normalizePath: lowercase, no trailing slash. */
function normalize(pathname: string): string {
  let p = pathname;
  try {
    p = decodeURI(p);
  } catch {
    // keep as is
  }
  p = p.replace(/\/{2,}/g, "/").toLowerCase();
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

async function rulesFor(origin: string): Promise<Map<string, Rule>> {
  const hit = cache.get(origin);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rules;
  try {
    const res = await fetch(`${API_BASE}/storefront/redirects`, { headers: { Origin: origin }, cache: "no-store" });
    const body = (await res.json()) as { data?: Rule[] };
    const rules = new Map((body.data ?? []).map((r) => [r.from, r]));
    cache.set(origin, { at: Date.now(), rules });
    return rules;
  } catch {
    // API down: no redirects for now, try again soon.
    const rules = hit?.rules ?? new Map<string, Rule>();
    cache.set(origin, { at: Date.now() - TTL_MS + 10_000, rules });
    return rules;
  }
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const origin = req.nextUrl.origin;
  const path = normalize(req.nextUrl.pathname);
  if (path === "/") return NextResponse.next();
  const rule = (await rulesFor(origin)).get(path);
  if (!rule) return NextResponse.next();

  let target: URL;
  try {
    target = new URL(rule.to, origin);
  } catch {
    return NextResponse.next();
  }
  // Keep the visitor's query (?utm_…) unless the new address has its own.
  if (!target.search && req.nextUrl.search) target.search = req.nextUrl.search;
  event.waitUntil(
    fetch(`${API_BASE}/storefront/redirects/hit`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => undefined),
  );
  return NextResponse.redirect(target, rule.code === 302 ? 302 : 301);
}

export const config = {
  // Pages (old .html / .php addresses too), not Next's files, the API, or images, scripts and fonts.
  matcher: ["/((?!_next/|api/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|txt|xml|json|woff2?|ttf)$).*)"],
};
