export const PERMISSIONS = [
  "*",
  "*.read",
  "catalog.*",
  "inventory.*",
  "product.*",
  "brand.*",
  "category.*",
  "attribute.*",
  "collection.*",
  "media.*",
  "media.read",
  "media.upload",
  "tag.read",
  "orders.*",
  "orders.read",
  "orders.status.*_read",
  "orders.status.fulfilled",
  "order.edit",
  "order.status.*",
  "shipments.*",
  "shipments.create",
  "shipments.update",
  "refund.create",
  "refunds.read",
  "refunds.approve",
  "return.read",
  "returnRequests.read",
  "customer.read",
  "customers.*",
  "notes.create",
  "ticket.*",
  "coupons.*",
  "flashSales.*",
  "banners.*",
  "giftCards.*",
  "campaigns.*",
  "segments.read",
  "email.*",
  "sms.*",
  "promo.*",
  "cms.*",
  "blogs.*",
  "pages.*",
  "menus.*",
  "faqs.*",
  "builder.*",
  "themes.read",
  "seo.*",
  "payouts.*",
  "payments.*",
  "reports.*",
  "reports.read.*",
  "report.read.sales",
  "report.read.orders",
  "report.read.customers",
  "report.read.marketing",
  "billing.*",
  "tax.*",
  "reconciliation.*",
  "settings.read.financial",
  "labels.print",
  "manifest.*",
  "pickups.*",
  "dashboard.*",
  "exports.*",
  "analytics.*",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  product_manager: [
    "catalog.*",
    "inventory.*",
    "product.*",
    "brand.*",
    "category.*",
    "attribute.*",
    "collection.*",
    "media.*",
    "tag.read",
    "report.read.sales",
  ],
  order_manager: [
    "orders.*",
    "shipments.*",
    "order.edit",
    "order.status.*",
    "refund.create",
    "return.read",
    "customer.read",
    "report.read.orders",
  ],
  customer_support: [
    "orders.read",
    "orders.status.*_read",
    "customers.*",
    "refunds.read",
    "returnRequests.read",
    "notes.create",
    "ticket.*",
    "report.read.customers",
  ],
  marketing: [
    "coupons.*",
    "flashSales.*",
    "banners.*",
    "giftCards.*",
    "campaigns.*",
    "segments.read",
    "email.*",
    "sms.*",
    "promo.*",
    "report.read.marketing",
  ],
  content: [
    "cms.*",
    "blogs.*",
    "pages.*",
    "menus.*",
    "faqs.*",
    "builder.*",
    "media.read",
    "media.upload",
    "themes.read",
    "seo.*",
  ],
  finance: [
    "refunds.approve",
    "payouts.*",
    "payments.*",
    "reports.*",
    "billing.*",
    "tax.*",
    "reconciliation.*",
    "settings.read.financial",
  ],
  shipper: [
    "shipments.create",
    "shipments.update",
    "orders.read",
    "orders.status.fulfilled",
    "labels.print",
    "manifest.*",
    "pickups.*",
  ],
  reports: [
    "reports.read.*",
    "dashboard.*",
    "exports.*",
    "analytics.*",
  ],
  viewer: ["*.read"],
};

export function adminHasPermission(
  perms: string[],
  required: string | string[],
): boolean {
  const needed: string[] = Array.isArray(required) ? required : [required];
  return needed.every((n) => hasPerm(perms, n));
}

function hasPerm(perms: string[], required: string): boolean {
  if (!perms.length) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(required)) return true;
  const prefix = required.split(".").slice(0, -1).join(".") + ".*";
  if (perms.includes(prefix)) return true;
  for (const p of perms) {
    if (p.endsWith(".*")) {
      const base = p.slice(0, -2);
      if (required.startsWith(base)) return true;
    }
  }
  return false;
}
