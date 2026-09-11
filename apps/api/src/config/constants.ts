/**
 * GLOBAL API CONSTANTS
 * Rate limits, pagination limits, cookie names, order prefixes, etc.
 * Tweak numbers here — nowhere else.
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
  MAX_SEARCH_LENGTH: 100,
} as const;

export const RATE_LIMITS = {
  PUBLIC: { max: 120, windowMs: 60_000 }, // 120/minute public routes
  AUTHENTICATED: { max: 600, windowMs: 60_000 }, // 600/min for logged in
  STRICT: { max: 20, windowMs: 60_000 }, // for login / password reset
} as const;

export const COOKIE_NAMES = {
  ADMIN_REFRESH: "admin_refresh_token",
  CUSTOMER_REFRESH: "customer_refresh_token",
  SUPER_REFRESH: "super_refresh_token",
  CART: "cart_sid",
  CURRENCY: "currency",
  LOCALE: "locale",
} as const;

export const ORDER_PREFIX = "BD-";
export const INVOICE_PREFIX = "INV-";
export const REFUND_PREFIX = "RF-";

export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB per file
  MAX_FILES: 20,
  IMAGE_MIMES: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  ALLOWED_MIMES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/zip",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
} as const;

export const CACHE_KEYS = {
  store: (storeId: bigint | string) => `store:${storeId}`,
  storeByDomain: (host: string) => `store:domain:${host}`,
  product: (id: bigint | string) => `product:${id}`,
  products: (storeId: bigint | string, key = "") => `products:${storeId}:${key}`,
  categories: (storeId: bigint | string) => `categories:${storeId}:tree`,
  settings: (storeId: bigint | string) => `settings:${storeId}`,
  theme: (storeId: bigint | string) => `theme:${storeId}`,
  TTL_DEFAULT: 5 * 60,
  TTL_PRODUCT: 15 * 60,
  TTL_LONG: 60 * 60,
} as const;
