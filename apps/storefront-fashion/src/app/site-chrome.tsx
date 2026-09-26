"use client";

import * as React from "react";
import { Navbar, CartDrawer, useCart, useGetCategoriesTreeQuery } from "@ecom/storefront-base";

/** Navbar bound to the cart and the live category tree (must run on the client). */
export function NavbarWithCartState() {
  const { itemCount, openCart } = useCart();
  const { data: categories = [] } = useGetCategoriesTreeQuery();
  return (
    <Navbar
      logo={{ name: "Fashion BD" }}
      cartCount={itemCount}
      wishlistCount={0}
      onCartClick={openCart}
      onWishlistClick={() => (window.location.href = "/wishlist")}
      menuLinks={[
        { label: "Home", href: "/" },
        { label: "Products", href: "/products" },
        {
          label: "Categories",
          href: "/products?view=categories",
          children: categories.map((c) => ({ label: c.name, href: `/products?category=${c.slug}` })),
        },
        { label: "New In", href: "/products?sort=newest" },
        { label: "Sale", href: "/products?sort=price_asc" },
      ]}
    />
  );
}

export function CartDrawerSlot() {
  return <CartDrawer storeName="Fashion BD" />;
}
