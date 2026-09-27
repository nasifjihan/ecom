"use client";

import * as React from "react";
import { Navbar, CartDrawer, useCart, useGetCategoriesTreeQuery } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";
import { signOutAndLeave, useCustomerLogoutMutation } from "@/lib/account";
import type { MenuLink } from "@/lib/content";

/** Used until the store saves a header menu in the admin (Online Store > Menus). */
const DEFAULT_MENU: MenuLink[] = [
  { title: "Home", url: "/", openInNewTab: false },
  { title: "Products", url: "/products", openInNewTab: false },
  { title: "Categories", url: "/categories", openInNewTab: false },
  { title: "New In", url: "/products?sort=newest", openInNewTab: false },
  { title: "Blog", url: "/blog", openInNewTab: false },
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
  const { data: categories = [] } = useGetCategoriesTreeQuery();
  const auth = useAppSelector((s) => s.auth);
  const [logout] = useCustomerLogoutMutation();
  const onLogout = async () => {
    await logout().unwrap().catch(() => undefined);
    signOutAndLeave("/");
  };

  // A "/categories" link with no dropdown of its own lists the live categories.
  const menuLinks = (menu?.length ? menu : DEFAULT_MENU).map((item) => ({
    label: item.title,
    href: item.url,
    children: item.children?.length
      ? item.children.map((c) => ({ label: c.title, href: c.url }))
      : item.url === "/categories"
        ? categories.map((c) => ({ label: c.name, href: `/products?category=${c.slug}` }))
        : undefined,
  }));

  return (
    <Navbar
      logo={{ name: storeName, image: logoUrl ?? undefined }}
      cartCount={itemCount}
      wishlistCount={0}
      onCartClick={openCart}
      onWishlistClick={() => (window.location.href = "/wishlist")}
      account={auth.isAuthenticated ? { name: auth.customerName ?? "My Account", email: auth.customerEmail } : null}
      onLogout={onLogout}
      menuLinks={menuLinks}
    />
  );
}

export function CartDrawerSlot({ storeName }: { storeName: string }) {
  return <CartDrawer storeName={storeName} />;
}
