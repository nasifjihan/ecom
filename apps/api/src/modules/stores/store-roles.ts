import { PERMISSION_AREAS, perm, type PermissionAction } from "@ecom/shared-types";

/** `area` with the given actions, or every action the area has when none are given. */
const g = (area: string, ...actions: PermissionAction[]) => {
  const def = PERMISSION_AREAS.find((a) => a.key === area);
  if (!def) throw new Error(`Unknown permission area "${area}"`);
  return (actions.length ? actions : def.actions).map((x) => perm(area, x));
};

/**
 * The built-in roles every store gets, keyed by slug, with codes from PERMISSION_AREAS
 * (@ecom/shared-types). Used by the seed and by store creation; the role_permission_catalogue
 * migration moved existing stores onto the same lists.
 */
export const STORE_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  product_manager: [
    ...g("dashboard"),
    ...g("products"),
    ...g("categories"),
    ...g("attributes"),
    ...g("media"),
    ...g("inventory"),
    ...g("reviews", "view"),
    ...g("purchasing", "view", "create"),
  ],
  order_manager: [
    ...g("payments"),
    ...g("dashboard"),
    ...g("orders"),
    ...g("commissions", "view"),
    ...g("customers", "view", "create", "edit"),
    ...g("leads"),
    ...g("products", "view"),
    ...g("inventory", "view"),
    ...g("shipping", "view"),
  ],
  customer_support: [
    ...g("orders", "view", "create"),
    ...g("customers", "view", "create", "edit"),
    ...g("leads", "view", "create", "edit"),
    ...g("reviews", "view", "edit"),
    ...g("products", "view"),
  ],
  marketing: [
    ...g("dashboard"),
    ...g("promotions"),
    ...g("loyalty"),
    ...g("coupons"),
    ...g("flash_sales"),
    ...g("reviews"),
    ...g("products", "view"),
    ...g("categories", "view"),
    ...g("customers", "view"),
    ...g("leads", "view"),
    ...g("emails"),
  ],
  content: [
    ...g("pages"),
    ...g("blog"),
    ...g("faqs"),
    ...g("menus"),
    ...g("online_store"),
    ...g("media", "view", "create"),
    ...g("products", "view"),
    ...g("categories", "view"),
  ],
  finance: [
    ...g("reports"),
    ...g("commissions"),
    ...g("loyalty", "view"),
    ...g("payments"),
    ...g("purchasing"),
    ...g("money_accounts"),
    ...g("dashboard"),
    ...g("orders", "view", "edit"),
    ...g("customers", "view"),
    ...g("taxes"),
    ...g("settings", "view"),
    ...g("audit_logs"),
  ],
  shipper: [
    ...g("payments", "view"),
    ...g("orders", "view", "edit"),
    ...g("shipping", "view"),
    ...g("inventory", "view"),
  ],
  reports: [...g("dashboard"), ...g("reports"), ...g("commissions", "view"), ...g("orders", "view"), ...g("payments", "view"), ...g("purchasing", "view"), ...g("money_accounts", "view"), ...g("customers", "view"), ...g("products", "view"), ...g("inventory", "view")],
  viewer: PERMISSION_AREAS.filter((a) => a.actions.includes("view") && !["audit_logs", "staff", "roles"].includes(a.key)).map((a) => perm(a.key, "view")),
};

/** "product_manager" -> "Product Manager" */
export const roleNameFromSlug = (slug: string) =>
  slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * Largest discount (% of the items subtotal) each built-in role may give on an order entered by hand.
 * Roles not listed get 0. Existing stores got the same values in the manual_orders migration.
 */
export const STORE_ROLE_MANUAL_DISCOUNT: Record<string, number> = {
  owner: 100,
  order_manager: 10,
  customer_support: 5,
};
