/**
 * The built-in roles every store gets, keyed by slug, with the permission codes the admin routes check
 * (rbacMiddleware("products.*"), "orders.read", ...). Used by the seed and by store creation.
 */
export const STORE_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  product_manager: [
    "products.*",
    "categories.*",
    "brands.*",
    "attributes.*",
    "collections.*",
    "inventory.read",
    "inventory.update",
    "media.*",
    "suppliers.*",
  ],
  order_manager: [
    "orders.read",
    "orders.update",
    "orders.statusChange",
    "shipments.*",
    "invoices.read",
    "invoices.create",
    "refunds.*",
    "returns.*",
    "abandoned_carts.read",
    "abandoned_carts.update",
  ],
  customer_support: [
    "customers.read",
    "customers.update",
    "customers.notes",
    "orders.read",
    "reviews.*",
    "tickets.*",
    "returns.read",
    "returns.update",
  ],
  marketing: [
    "coupons.*",
    "flash_sales.*",
    "banners.*",
    "gift_cards.*",
    "affiliates.read",
    "affiliates.update",
    "abandoned_carts.read",
    "email_templates.read",
    "email_templates.update",
    "notifications.send",
  ],
  content: [
    "pages.*",
    "blog.*",
    "faqs.*",
    "menus.*",
    "themes.read",
    "themes.update",
    "homepage_sections.*",
    "page_builder.*",
  ],
  finance: [
    "orders.read",
    "invoices.*",
    "refunds.read",
    "reports.*",
    "payment_gateways.read",
    "payouts.*",
    "billing.read",
    "billing.update",
  ],
  shipper: [
    "orders.read",
    "orders.statusChange",
    "shipments.create",
    "shipments.update",
    "shipments.print",
    "orders.export",
  ],
  reports: ["reports.*", "orders.read", "customers.read", "products.read"],
  viewer: ["dashboard.read", "orders.read", "products.read", "customers.read"],
};

/** "product_manager" -> "Product Manager" */
export const roleNameFromSlug = (slug: string) =>
  slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
