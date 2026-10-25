/**
 * The pages every new store starts with: checkout asks shoppers to agree to the terms and privacy
 * policy and links to these two, so a store without them sent shoppers to "Page not found".
 * Starter wording the owner edits in Content → Pages. Used by the seed and when the super admin
 * creates a store.
 */
export const DEFAULT_PAGES = [
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
