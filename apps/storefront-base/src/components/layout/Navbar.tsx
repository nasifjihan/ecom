"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  LogIn,
  UserCircle,
  Package,
  Settings,
  LogOut,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui";
import { cn } from "@ecom/utils";

export type MenuLink = {
  label: string;
  href: string;
  children?: MenuLink[];
};

export type NavbarProps = {
  logo?: {
    image?: string;
    name: string;
  };
  menuLinks?: MenuLink[];
  cartCount?: number;
  wishlistCount?: number;
  onCartClick?: () => void;
  onWishlistClick?: () => void;
  className?: string;
  searchPlaceholder?: string;
  storeId?: string;
  /** The signed-in customer, or null for a guest. */
  account?: { name: string; email?: string | null } | null;
  onLogout?: () => void;
};

export const Navbar: React.FC<NavbarProps> = ({
  logo,
  menuLinks = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    {
      label: "Categories",
      href: "/categories",
      children: [
        { label: "Women", href: "/categories/women" },
        { label: "Men", href: "/categories/men" },
        { label: "Kids", href: "/categories/kids" },
        { label: "Accessories", href: "/categories/accessories" },
      ],
    },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  cartCount = 0,
  wishlistCount = 0,
  onCartClick,
  onWishlistClick,
  className,
  searchPlaceholder = "Search products...",
  account = null,
  onLogout,
}) => {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openCategory, setOpenCategory] = React.useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full bg-white transition-all duration-200",
        scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        className,
      )}
    >
      <div className="container">
        <div className="flex h-16 items-center gap-4 lg:h-20">
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-accent"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              {logo?.image ? (
                <img src={logo.image} alt={logo.name} className="h-8 w-8 object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {logo?.name?.[0] ?? "S"}
                </div>
              )}
              <span className="font-bold text-lg tracking-tight text-foreground hidden sm:inline">
                {logo?.name ?? "Store"}
              </span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {menuLinks.map((link) => {
              const hasChildren = !!link.children?.length;
              if (!hasChildren) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                );
              }
              return (
                <div
                  key={link.href}
                  className="relative"
                  onMouseEnter={() => setOpenCategory(link.href)}
                  onMouseLeave={() => setOpenCategory(null)}
                >
                  <button className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors inline-flex items-center gap-1">
                    {link.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openCategory === link.href && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {openCategory === link.href && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full pt-2 min-w-48"
                      >
                        <div className="rounded-md border bg-white p-1 shadow-md">
                          {link.children!.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block px-3 py-2 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="flex-1 hidden md:flex max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-10 pr-4 w-full"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value;
                    if (val) {
                      window.location.href = `/products?search=${encodeURIComponent(val)}`;
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              className="p-2 rounded-md hover:bg-accent md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            <button
              className="p-2 rounded-md hover:bg-accent relative"
              onClick={onWishlistClick}
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 p-0 items-center justify-center text-[10px]">
                  {wishlistCount}
                </Badge>
              )}
            </button>

            <button
              className="p-2 rounded-md hover:bg-accent relative"
              onClick={onCartClick}
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 p-0 items-center justify-center text-[10px]">
                  {cartCount}
                </Badge>
              )}
            </button>

            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <button className="p-2 rounded-md hover:bg-accent" aria-label="Account">
                  <User className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent open={userMenuOpen}>
                <DropdownMenuLabel>{account ? account.name : "My Account"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {account ? (
                  <>
                    <DropdownMenuItem onClick={() => (window.location.href = "/account")}>
                      <User className="h-4 w-4 mr-2" />
                      My Account
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (window.location.href = "/account/orders")}>
                      <Package className="h-4 w-4 mr-2" />
                      Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (window.location.href = "/account/addresses")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Addresses
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setUserMenuOpen(false); onLogout?.(); }}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Log Out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => (window.location.href = "/account/login")}>
                      <LogIn className="h-4 w-4 mr-2" />
                      Log In
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (window.location.href = "/account/register")}>
                      <UserCircle className="h-4 w-4 mr-2" />
                      Sign Up
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="w-full sm:w-80 !left-0 !right-auto border-r">
          <SheetHeader className="flex flex-row items-center justify-between">
            <SheetTitle>Menu</SheetTitle>
            <button onClick={() => setMobileOpen(false)} className="p-2 rounded-md hover:bg-accent" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </SheetHeader>
          <div className="mt-2 mb-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={searchPlaceholder} className="pl-10" />
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {menuLinks.map((link) => (
              <div key={link.href}>
                {!link.children?.length ? (
                  <Link
                    href={link.href}
                    className="block px-3 py-2 rounded-md font-medium hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <div>
                    <button
                      onClick={() => setOpenCategory(openCategory === link.href ? null : link.href)}
                      className="flex w-full items-center justify-between px-3 py-2 rounded-md font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                      {link.label}
                      <ChevronDown className={cn("h-4 w-4 transition-transform", openCategory === link.href && "rotate-180")} />
                    </button>
                    <AnimatePresence>
                      {openCategory === link.href && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-4"
                        >
                          {link.children!.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
                              onClick={() => setMobileOpen(false)}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="mt-6 space-y-2">
            {account ? (
              <>
                <Button variant="outline" className="w-full" onClick={() => (window.location.href = "/account")}>
                  <User className="h-4 w-4 mr-2" /> My Account
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => { setMobileOpen(false); onLogout?.(); }}>
                  <LogOut className="h-4 w-4 mr-2" /> Log Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="w-full" onClick={() => (window.location.href = "/account/login")}>
                  <LogIn className="h-4 w-4 mr-2" /> Log In
                </Button>
                <Button className="w-full" onClick={() => (window.location.href = "/account/register")}>
                  <UserCircle className="h-4 w-4 mr-2" /> Create Account
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default Navbar;
