"use client";

import * as React from "react";
import { Navbar, CartDrawer, useCart, useGetCategoriesTreeQuery, useT, msg, type MenuLink as NavLink } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";
import { signOutAndLeave, useCustomerLogoutMutation } from "@/lib/account";
import type { MenuLink } from "@/lib/content";
import { useWishlist } from "@/lib/engagement";
import { SearchBox } from "./_components/search-box";

/** Used until the store saves a header menu in the admin (Online Store > Menus). */
const DEFAULT_MENU: MenuLink[] = [
  { title: msg("Home"), url: "/", openInNewTab: false },
  { title: msg("Products"), url: "/products", openInNewTab: false },
  { title: msg("Categories"), url: "/categories", openInNewTab: false },
  { title: msg("New In"), url: "/products?sort=newest", openInNewTab: false },
  { title: msg("Blog"), url: "/blog", openInNewTab: false },
];

/** Navbar bound to the cart and the live category tree (must run on the client). */
export function NavbarWithCartState({
  storeName,
  logoUrl,
  menu,
}: {
  storeName: string;
  logoUrl?: string | null;
  menu?: MenuLink[] | null;
}) {
  const { itemCount, openCart } = useCart();
  const wishlist = useWishlist();
  const { data: categories = [] } = useGetCategoriesTreeQuery();
  const auth = useAppSelector((s) => s.auth);
  const [logout] = useCustomerLogoutMutation();
  const t = useT();
  const onLogout = async () => {
    await logout().unwrap().catch(() => undefined);
    signOutAndLeave("/");
  };

  // A "/categories" link with no dropdown of its own lists the live categories. Titles the shop
  // left in English that we have words for ("Home", "Shop"…) show in the shopper's language.
  type Node = (typeof categories)[number];
  const fromCategory = (c: Node, depth: number): NavLink => ({
    label: c.name,
    href: `/products?category=${c.slug}`,
    children: depth < 3 && c.children?.length ? c.children.map((x) => fromCategory(x, depth + 1)) : undefined,
  });
  const toLink = (item: MenuLink): NavLink => ({
    label: t(item.title),
    href: item.url,
    icon: item.icon || undefined,
    children: item.children?.length
      ? item.children.map(toLink)
      : item.url === "/categories"
        ? categories.map((c) => fromCategory(c, 2))
        : undefined,
  });
  const menuLinks = (menu?.length ? menu : DEFAULT_MENU).map(toLink);

  return (
    <Navbar
      logo={{ name: storeName, image: logoUrl ?? undefined }}
      cartCount={itemCount}
      wishlistCount={wishlist.count}
      searchSlot={<SearchBox />}
      onCartClick={openCart}
      onWishlistClick={() => (window.location.href = "/wishlist")}
      account={auth.isAuthenticated ? { name: auth.customerName ?? t("My Account"), email: auth.customerEmail } : null}
      onLogout={onLogout}
      menuLinks={menuLinks}
    />
  );
}

export function CartDrawerSlot({ storeName }: { storeName: string }) {
  return <CartDrawer storeName={storeName} />;
}
