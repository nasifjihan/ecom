/**
 * SHARED UTILITIES — pure helpers used across Node (API) and Browser (Storefront/Admin).
 * Never add anything React-specific here (that goes in `@ecom/ui`).
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import slugifyFn from "slugify";
import { createId } from "@paralleldrive/cuid2";

/**
 * Merge tailwind class names with conflict resolution.
 * Example: cn("px-2 py-1", error && "bg-red-500", { "mx-auto": centered })
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Generate URL-safe slug from arbitrary strings.
 * slugify("iPhone 17 Pro (256GB, Titan Black)") → "iphone-17-pro-256gb-titan-black"
 */
export function slugify(input: string): string {
  return slugifyFn(String(input ?? ""), {
    lower: true,
    strict: true,
    trim: true,
    remove: /[*+~.()'"!:@]/g,
  });
}

/**
 * Generate collision-resistant, sortable, unpredictable IDs.
 * Length ~24 chars — perfect for short codes, order references, etc.
 * DB primary keys are still BigInt (auto) — use cuid2 for public-facing ref strings.
 */
export function newId(prefix?: string): string {
  const id = createId();
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Money-safe multiply: Intentionally returns a number rounded to 2 decimals.
 * For serious calculations inside services prefer dinero.js API — this is for quick UI/seed math.
 * NOTE: We use Decimal in Prisma — never do `price * qty` with JS `number` floats for real orders!
 */
export function moneyMul(amount: number | string, multiplier: number): number {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Math.round(n * multiplier * 100) / 100;
}

/**
 * Money-safe add. Again: Decimal arithmetic via Prisma Decimal in services — this is UI quick helper.
 */
export function moneyAdd(...amounts: (number | string)[]): number {
  const totalCents = amounts.reduce((acc, a) => {
    const n = typeof a === "string" ? parseFloat(a) : a;
    return acc + Math.round((n || 0) * 100);
  }, 0);
  return totalCents / 100;
}

/**
 * Format money for display. This should match frontend Intl.NumberFormatter.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = "BDT",
  locale = "en-BD",
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(0);
  }
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "BDT" ? 2 : 2,
  }).format(num);
}

/**
 * Plain object deep clone (JSON-safe). For objects with Date/Map/Set use structuredClone builtin.
 */
export function deepClone<T>(obj: T): T {
  return typeof structuredClone === "function"
    ? (structuredClone(obj) as T)
    : (JSON.parse(JSON.stringify(obj)) as T);
}

/**
 * Wait n ms. Usage: await wait(2000)
 */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
