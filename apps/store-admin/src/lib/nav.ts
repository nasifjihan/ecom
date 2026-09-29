/**
 * The store admin's pages and the permission each needs to open. The sidebar, the settings
 * menu and the "where to go after sign-in" choice all read this list.
 */
import {
  Activity,
  ArrowLeftRight,
  Award,
  Banknote,
  BarChart3,
  Boxes,
  CreditCard,
  Factory,
  FileText,
  ClipboardList,
  CornerUpRight,
  Trophy,
  Coins,
  HandCoins,
  Gift,
  HelpCircle,
  Home,
  Image,
  KeyRound,
  Landmark,
  LayoutGrid,
  ListTree,
  Mail,
  Map,
  MapPin,
  MessageSquare,
  MessageCircleQuestion,
  MessageSquareText,
  Languages,
  Newspaper,
  Package,
  PackagePlus,
  Palette,
  Percent,
  Briefcase,
  Calculator,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  TrendingUp,
  Truck,
  Undo2,
  User2,
  UserCog,
  Wallet,
  Users,
  Warehouse,
  Zap,
  Megaphone,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Permission needed to open the page; none = every signed-in staff member. */
  perm?: string;
  /** Shown only to staff on the sales team. */
  salesOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, perm: "dashboard.view" },
      { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports.view" },
    ],
  },
  {
    title: "Orders",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingCart, perm: "orders.view" },
      { href: "/orders/new", label: "New order", icon: PackagePlus, perm: "orders.create" },
      { href: "/orders/quotations", label: "Quotations", icon: ClipboardList, perm: "orders.view" },
      { href: "/orders/sales-team", label: "Sales team", icon: Trophy, perm: "commissions.view" },
      { href: "/my-commission", label: "My commission", icon: Coins, salesOnly: true },
      { href: "/orders/shipments", label: "Shipments", icon: Truck, perm: "orders.view" },
      { href: "/orders/returns", label: "Returns", icon: Undo2, perm: "orders.view" },
      { href: "/orders/payments", label: "Payments to verify", icon: CreditCard, perm: "payments.view" },
      { href: "/orders/cash", label: "Cash & couriers", icon: Banknote, perm: "payments.view" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/catalog/products", label: "Products", icon: Package, perm: "products.view" },
      { href: "/catalog/categories", label: "Categories", icon: Tags, perm: "categories.view" },
      { href: "/catalog/brands", label: "Brands", icon: Award, perm: "categories.view" },
      { href: "/catalog/attributes", label: "Attributes", icon: SlidersHorizontal, perm: "attributes.view" },
      { href: "/catalog/media", label: "Media", icon: Image, perm: "media.view" },
      { href: "/catalog/pricing", label: "Price by margin", icon: Calculator, perm: "products.view" },
      { href: "/inventory", label: "Stock", icon: Boxes, perm: "inventory.view" },
      { href: "/inventory/warehouses", label: "Warehouses", icon: Warehouse, perm: "inventory.view" },
      { href: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight, perm: "inventory.view" },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { href: "/purchasing/purchases", label: "Purchases", icon: ShoppingBag, perm: "purchasing.view" },
      { href: "/purchasing/suppliers", label: "Suppliers", icon: Factory, perm: "purchasing.view" },
      { href: "/purchasing/payments", label: "Supplier payments", icon: HandCoins, perm: "purchasing.view" },
      { href: "/purchasing/accounts", label: "Accounts", icon: Landmark, perm: "money_accounts.view" },
    ],
  },
  {
    title: "Customers",
    items: [
      { href: "/customers", label: "Customers", icon: User2, perm: "customers.view" },
      { href: "/customers/business", label: "Business accounts", icon: Briefcase, perm: "customers.view" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/marketing/promotions", label: "Promotions", icon: Gift, perm: "promotions.view" },
      { href: "/marketing/coupons", label: "Coupons", icon: Percent, perm: "coupons.view" },
      { href: "/marketing/flash-sales", label: "Flash Sales", icon: Zap, perm: "flash_sales.view" },
      { href: "/marketing/loyalty", label: "Loyalty & wallet", icon: Wallet, perm: "loyalty.view" },
      { href: "/marketing/reviews", label: "Reviews", icon: MessageSquare, perm: "reviews.view" },
      { href: "/marketing/questions", label: "Questions", icon: MessageCircleQuestion, perm: "reviews.view" },
      { href: "/marketing/search-terms", label: "Search terms", icon: TrendingUp, perm: "products.view" },
    ],
  },
  {
    title: "Online Store",
    items: [
      { href: "/online-store/homepage", label: "Homepage", icon: Home, perm: "online_store.view" },
      { href: "/online-store/theme", label: "Theme", icon: Palette, perm: "online_store.view" },
      { href: "/online-store/menus", label: "Menus", icon: ListTree, perm: "menus.view" },
      { href: "/online-store/storefronts", label: "Storefronts", icon: Store, perm: "online_store.view" },
      { href: "/online-store/landing-pages", label: "Landing pages", icon: Megaphone, perm: "pages.view" },
      { href: "/online-store/redirects", label: "Redirects", icon: CornerUpRight, perm: "online_store.view" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/content/pages", label: "Pages", icon: FileText, perm: "pages.view" },
      { href: "/content/blog", label: "Blog", icon: Newspaper, perm: "blog.view" },
      { href: "/content/faqs", label: "FAQs", icon: HelpCircle, perm: "faqs.view" },
    ],
  },
  {
    title: "Shipping",
    items: [
      { href: "/shipping/zones", label: "Zones", icon: Map, perm: "shipping.view" },
      { href: "/shipping/locations", label: "Delivery areas", icon: MapPin, perm: "shipping.view" },
      { href: "/shipping/taxes", label: "Taxes", icon: Receipt, perm: "taxes.view" },
    ],
  },
  { title: "Settings", items: [{ href: "/settings/profile", label: "Settings", icon: Settings }] },
];

export const SETTINGS_SECTIONS: NavSection[] = [
  {
    title: "Your account",
    items: [
      { href: "/settings/profile", label: "Profile", icon: UserCog },
      { href: "/settings/password", label: "Password", icon: KeyRound },
    ],
  },
  {
    title: "Store",
    items: [
      { href: "/settings/general", label: "Store details", icon: Store, perm: "settings.view" },
      { href: "/settings/payments", label: "Payment methods", icon: Wallet, perm: "settings.view" },
      { href: "/settings/couriers", label: "Couriers", icon: Truck, perm: "settings.view" },
      { href: "/settings/sms", label: "SMS", icon: MessageSquareText, perm: "settings.view" },
      { href: "/settings/languages", label: "Languages", icon: Languages, perm: "settings.view" },
      { href: "/settings/emails", label: "Emails", icon: Mail, perm: "emails.view" },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/settings/staff", label: "Staff", icon: Users, perm: "staff.view" },
      { href: "/settings/roles", label: "Roles & permissions", icon: Shield, perm: "roles.view" },
      { href: "/settings/activity", label: "Activity log", icon: Activity, perm: "audit_logs.view" },
    ],
  },
];

/** The first page someone may open (where to land after signing in). */
export function firstAllowedHref(can: (perm?: string) => boolean): string {
  for (const s of NAV_SECTIONS) for (const i of s.items) if (can(i.perm)) return i.href;
  return "/settings/profile";
}
