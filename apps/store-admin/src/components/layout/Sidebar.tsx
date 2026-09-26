"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui";
import {
  LayoutGrid,
  Package,
  Tags,
  Award,
  SlidersHorizontal,
  Image,
  ShoppingCart,
  Truck,
  RefreshCcw,
  User2,
  Gift,
  Warehouse,
  Settings2,
  BarChart3,
  Percent,
  Zap,
  MessageSquare,
  Map,
  Receipt,
  Settings,
  Building2,
  CreditCard,
  ChevronRight,
  ShoppingBag,
  FileText,
  Newspaper,
  HelpCircle,
  Home,
  Palette,
  ListTree,
} from "lucide-react";
import { ScrollArea } from "@/components/ui";
import { useMeQuery } from "@/lib/features/auth/auth-api-slice";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/catalog/products", label: "Products", icon: Package },
      { href: "/catalog/categories", label: "Categories", icon: Tags },
      { href: "/catalog/brands", label: "Brands", icon: Award },
      {
        href: "/catalog/attributes",
        label: "Attributes",
        icon: SlidersHorizontal,
      },
      { href: "/catalog/media", label: "Media", icon: Image },
    ],
  },
  {
    title: "Orders",
    items: [
      { href: "/orders", label: "List", icon: ShoppingCart },
      { href: "/orders/shipments", label: "Shipments", icon: Truck },
      { href: "/orders/returns", label: "Returns", icon: RefreshCcw },
    ],
  },
  {
    title: "Customers",
    items: [
      { href: "/customers", label: "Users", icon: User2 },
      { href: "/customers/loyalty", label: "Loyalty", icon: Gift },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/inventory", label: "Stock", icon: Warehouse },
      {
        href: "/inventory/adjustments",
        label: "Adjustments",
        icon: Settings2,
      },
      { href: "/inventory/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/marketing/coupons", label: "Coupons", icon: Percent },
      { href: "/marketing/flash-sales", label: "Flash Sales", icon: Zap },
      { href: "/marketing/reviews", label: "Reviews", icon: MessageSquare },
    ],
  },
  {
    title: "Online Store",
    items: [
      { href: "/online-store/homepage", label: "Homepage", icon: Home },
      { href: "/online-store/theme", label: "Theme", icon: Palette },
      { href: "/online-store/menus", label: "Menus", icon: ListTree },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/content/pages", label: "Pages", icon: FileText },
      { href: "/content/blog", label: "Blog", icon: Newspaper },
      { href: "/content/faqs", label: "FAQs", icon: HelpCircle },
    ],
  },
  {
    title: "Shipping",
    items: [
      { href: "/shipping/zones", label: "Zones", icon: Map },
      { href: "/shipping/rates", label: "Rates", icon: Truck },
      { href: "/shipping/taxes", label: "Taxes", icon: Receipt },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings/profile", label: "User", icon: Settings },
      { href: "/settings/store", label: "Store", icon: Building2 },
      { href: "/settings/payment", label: "Payment", icon: CreditCard },
    ],
  },
];

function NavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "admin-nav-link group relative",
        isActive && "admin-nav-link-active",
      )}
      title={collapsed ? item.label : undefined}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isActive ? 0 : 0 }}
        className="flex-shrink-0"
      >
        <Icon className={cn("h-5 w-5", isActive && "text-white")} />
      </motion.div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="truncate whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && isActive && (
        <motion.div
          layoutId="nav-active-indicator"
          className="absolute right-2 h-2 w-2 rounded-full bg-white"
        />
      )}
    </Link>
  );
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { data: meData } = useMeQuery();
  const storeName = meData?.store?.name ?? "Fashion BD Admin";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-white shadow-xl"
    >
      <motion.div
        animate={{ height: 64 }}
        className="flex items-center justify-between border-b border-white/10 px-4"
      >
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="text-base font-bold tracking-tight truncate block max-w-[170px]">
                  {storeName}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </motion.div>

      <ScrollArea className="flex-1 scrollbar-thin">
        <nav className="space-y-1 p-3">
          {navSections.map((section, sectionIdx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIdx * 0.05, duration: 0.3 }}
              className="mb-4"
            >
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <h3 className="admin-nav-section-title">
                      {section.title}
                    </h3>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    isActive={isActive(item.href)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="admin-nav-link w-full justify-center"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronRight className="h-5 w-5" />
          </motion.div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
