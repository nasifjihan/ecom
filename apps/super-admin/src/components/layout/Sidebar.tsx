"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui";
import {
  BarChart3,
  Building2,
  Globe2,
  UserPlus,
  CreditCard,
  Receipt,
  CalendarClock,
  Wallet,
  ShieldCheck,
  KeyRound,
  PieChart,
  FileSearch,
  Activity,
  Settings2,
  AlertTriangle,
  ChevronRight,
  Shield,
} from "lucide-react";
import { ScrollArea } from "@/components/ui";
import { useMeSuperQuery } from "@/lib/features/auth/auth-api-slice";

interface SuperSidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const superNavSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    ],
  },
  {
    title: "Stores",
    items: [
      { href: "/stores", label: "All Stores", icon: Building2, badge: "142" },
      { href: "/stores/domains", label: "Domains", icon: Globe2 },
      { href: "/stores/signups", label: "Store Signups", icon: UserPlus },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/billing/plans", label: "Plans", icon: CreditCard },
      {
        href: "/billing/subscriptions",
        label: "Subscriptions & Invoices",
        icon: Receipt,
      },
      { href: "/billing/cycles", label: "Billing Cycles", icon: CalendarClock },
      { href: "/billing/payouts", label: "Payouts", icon: Wallet },
    ],
  },
  {
    title: "Users",
    items: [
      {
        href: "/admins",
        label: "Platform Admins",
        icon: ShieldCheck,
        badge: "8",
      },
      {
        href: "/admins/roles",
        label: "Roles & Permissions",
        icon: KeyRound,
      },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/reports", label: "Platform Reports", icon: PieChart },
      { href: "/reports/audit", label: "Audit Logs", icon: FileSearch },
      { href: "/reports/health", label: "System Health", icon: Activity },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        href: "/settings/platform",
        label: "Platform Settings",
        icon: Settings2,
      },
      {
        href: "/settings/maintenance",
        label: "Maintenance",
        icon: AlertTriangle,
      },
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
        className="flex-shrink-0"
      >
        <Icon
          className={cn(
            "h-5 w-5",
            isActive && "text-rose-400",
          )}
        />
      </motion.div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="truncate whitespace-nowrap flex-1"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400"
        >
          {item.badge}
        </motion.span>
      )}
    </Link>
  );
}

export default function SuperSidebar({
  collapsed,
  setCollapsed,
}: SuperSidebarProps) {
  const pathname = usePathname();
  const { data: meData } = useMeSuperQuery();
  const adminName = meData?.user?.name ?? "Platform Super Admin";
  const adminRole = meData?.user?.role ?? "PLATFORM_SUPER_ADMIN";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 264 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-rose-950/20 text-white shadow-xl border-r border-white/5"
    >
      <motion.div
        animate={{ height: 68 }}
        className="flex items-center justify-between border-b border-white/5 px-4 bg-rose-950/10"
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-900/30">
            <Shield className="h-5 w-5" />
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
                <span className="block text-[10px] font-bold tracking-[0.15em] text-rose-400/80 uppercase leading-none">
                  Ecom
                </span>
                <span className="text-sm font-bold tracking-tight truncate block max-w-[170px] leading-tight mt-0.5">
                  Platform Super
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </motion.div>

      <ScrollArea className="flex-1 scrollbar-thin">
        <nav className="space-y-1 p-3">
          {superNavSections.map((section, sectionIdx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIdx * 0.04, duration: 0.3 }}
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
                    <h3 className="admin-nav-section-title text-[10px] tracking-[0.1em]">
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

      <div className="border-t border-white/5 p-3 space-y-2">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden px-2 py-2 mb-1 rounded-lg bg-white/3"
            >
              <p className="text-xs font-medium text-white truncate">
                {adminName}
              </p>
              <p className="text-[10px] text-rose-400/70 truncate mt-0.5">
                {adminRole.replace(/_/g, " ")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
