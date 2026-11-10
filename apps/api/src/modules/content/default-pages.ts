/**
 * The pages every new store starts with. Checkout asks shoppers to agree to the terms and privacy
 * policy and links to those two; the footer links to About, Shipping and Returns. A store without
 * them sent shoppers to "Page not found", and payment gateways ask for these pages too.
 * Starter wording the owner edits in Content → Pages. Used by the seed (which keeps its own
 * shipping and return wording: the first page with a slug wins there) and when the super admin
 * creates a store.
 */
export const DEFAULT_PAGES = [
  {
    slug: "about",
    title: "About Us",
    content:
      "Welcome to our shop.\n\n## Who we are\nWrite a few lines here about your shop: what you sell, where you are, and why customers can trust you.\n\n## Our promise\n- Real products, as shown in the pictures\n- Delivery all over Bangladesh\n- Cash on delivery and easy returns",
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    content:
      "## Delivery areas\nWe deliver to all 64 districts of Bangladesh.\n\n## Delivery time\n- Inside Dhaka: 1 to 2 working days\n- Outside Dhaka: 2 to 5 working days\n\n## Charges\nThe delivery charge is shown at checkout before you place the order.",
  },
  {
    slug: "return-policy",
    title: "Return & Refund Policy",
    content:
      "## 7-day returns\nIf something is not right, you can return it within **7 days** of delivery.\n\n## Conditions\n- Items must be unused, with tags attached\n\n## Refunds\nRefunds go back to your original payment method, or by bKash for cash on delivery orders, within 5 working days of us receiving the item.",
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    content:
      "We collect only what we need to deliver your order: your name, phone number, email and address.\n\n## How we use it\n- To process and deliver your orders\n- To send order updates\n- To send offers, only if you opt in\n\nWe never sell your personal information.",
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    content:
      "By using this website you agree to these terms.\n\n## Orders\nAn order is confirmed once we call or message you to verify it. Prices are in Bangladeshi Taka (৳) and include VAT where applicable.\n\n## Cancellations\nYou can cancel an order from **My Account** until it is shipped.",
  },
] as const

/** Rows for cmsPage.createMany for one store. */
export function defaultPageRows(storeId: bigint) {
  return DEFAULT_PAGES.map((p, i) => ({ storeId, ...p, sortOrder: i, isPublished: true, showInFooterMenu: false }))
}
