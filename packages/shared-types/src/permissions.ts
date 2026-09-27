/**
 * STORE ADMIN PERMISSIONS
 * Every store-admin API route checks one `area.action` code from this list, and roles hold
 * the same codes (the owner holds "*"). The store admin builds its role editor and its
 * navigation from the same list, so there is one source of truth.
 */

export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface PermissionArea {
  key: string;
  group: string;
  label: string;
  /** What each action allows, in plain words (shown in the role editor). */
  help?: string;
  actions: readonly PermissionAction[];
}

const ALL = ["view", "create", "edit", "delete"] as const;

export const PERMISSION_AREAS: readonly PermissionArea[] = [
  { key: "dashboard", group: "Overview", label: "Dashboard", help: "Sales figures and charts", actions: ["view"] },

  { key: "orders", group: "Orders", label: "Orders", help: "Create = enter orders by hand; Edit = status, refunds, invoices, emails", actions: ["view", "create", "edit"] },
  { key: "payments", group: "Orders", label: "Payments and cash", help: "Edit = verify or reject bKash/Nagad/bank payments, confirm cash, record courier payouts", actions: ["view", "edit"] },

  { key: "products", group: "Catalog", label: "Products", actions: ALL },
  { key: "categories", group: "Catalog", label: "Categories and brands", actions: ALL },
  { key: "attributes", group: "Catalog", label: "Attributes", actions: ALL },
  { key: "media", group: "Catalog", label: "Media library", actions: ALL },
  { key: "inventory", group: "Catalog", label: "Stock", help: "Edit = adjust stock and low-stock alerts", actions: ["view", "edit"] },

  { key: "customers", group: "Customers", label: "Customers", actions: ALL },
  { key: "reviews", group: "Customers", label: "Reviews", help: "Edit = approve, mark as spam", actions: ["view", "edit", "delete"] },

  { key: "promotions", group: "Marketing", label: "Promotions", help: "Automatic offers: discounts, free gifts, buy X get Y, free delivery", actions: ALL },
  { key: "coupons", group: "Marketing", label: "Coupons", actions: ALL },
  { key: "flash_sales", group: "Marketing", label: "Flash sales", actions: ALL },

  { key: "pages", group: "Content", label: "Pages", actions: ALL },
  { key: "blog", group: "Content", label: "Blog", actions: ALL },
  { key: "faqs", group: "Content", label: "FAQs", actions: ALL },
  { key: "menus", group: "Content", label: "Menus", actions: ALL },
  { key: "online_store", group: "Content", label: "Theme and homepage", actions: ["view", "edit"] },

  { key: "shipping", group: "Shipping", label: "Zones, delivery areas and prices", actions: ALL },
  { key: "taxes", group: "Shipping", label: "Taxes", actions: ALL },

  { key: "settings", group: "Settings", label: "Store settings", actions: ["view", "edit"] },
  { key: "emails", group: "Settings", label: "Emails", help: "Templates, test sends and the sent log", actions: ["view", "edit"] },
  { key: "staff", group: "Settings", label: "Staff accounts", actions: ALL },
  { key: "roles", group: "Settings", label: "Roles and permissions", actions: ALL },
  { key: "audit_logs", group: "Settings", label: "Activity log", actions: ["view"] },
] as const;

export const perm = (area: string, action: PermissionAction) => `${area}.${action}`;

/** Every code a role can hold (besides "*"). */
export const ALL_PERMISSIONS: readonly string[] = PERMISSION_AREAS.flatMap((a) => a.actions.map((x) => perm(a.key, x)));

export const isKnownPermission = (code: string) => code === "*" || ALL_PERMISSIONS.includes(code);

/** True when the held codes include `required` (or "*", or "area.*"). */
export function hasPermission(held: readonly string[], required: string): boolean {
  if (held.includes("*") || held.includes(required)) return true;
  const area = required.slice(0, required.lastIndexOf("."));
  return held.includes(`${area}.*`);
}
