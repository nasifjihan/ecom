"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Store,
  User2,
  CreditCard,
  Globe,
  Languages,
  Package2,
  Warehouse,
  Receipt,
  Truck,
  ShoppingCart,
  Banknote,
  ClipboardList,
  Mail,
  Users,
  Shield,
  Lock,
  Plug,
  Code2,
  Webhook,
  Activity,
  ChevronRight,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@ecom/utils";
import { Card, CardContent } from "@/components/ui";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Store",
    items: [
      { label: "Profile", href: "/settings/profile", icon: User2 },
      { label: "Store", href: "/settings/general", icon: Store },
      { label: "Billing & Plans", href: "/settings/billing", icon: CreditCard },
      { label: "Domains & SSL", href: "/settings/domains", icon: Globe },
      { label: "Localization", href: "/settings/localization", icon: Languages },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/settings/products", icon: Package2 },
      { label: "Inventory", href: "/settings/inventory", icon: Warehouse },
      { label: "Taxes", href: "/settings/taxes", icon: Receipt },
      { label: "Shipping", href: "/settings/shipping", icon: Truck },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Checkout", href: "/settings/checkout", icon: ShoppingCart },
      { label: "Payments", href: "/settings/payments", icon: Banknote },
      { label: "Order Statuses", href: "/settings/order-statuses", icon: ClipboardList },
      { label: "Emails", href: "/settings/emails", icon: Mail },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Team", href: "/settings/team", icon: Users },
      { label: "Roles & Permissions", href: "/settings/roles", icon: Shield },
      { label: "Security", href: "/settings/security", icon: Lock },
      { label: "Integrations", href: "/settings/integrations", icon: Plug },
      { label: "Developers API", href: "/settings/developers", icon: Code2 },
      { label: "Webhooks", href: "/settings/webhooks", icon: Webhook },
      { label: "Activity Log", href: "/settings/activity", icon: Activity },
    ],
  },
];

function isActive(path: string, href: string) {
  if (href === "/settings/profile") {
    return path?.startsWith("/settings/profile") || path?.startsWith("/settings/password");
  }
  if (href === "/settings/general") {
    return path?.startsWith("/settings/general") || path === "/settings";
  }
  return path?.startsWith(href);
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage your store, team, and system preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="mb-2 first:mt-1">
                    <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {group.label}
                    </div>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(pathname ?? "", item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                                active
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  active
                                    ? "text-primary"
                                    : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300",
                                )}
                              />
                              <span className="flex-1 truncate">{item.label}</span>
                              {active && (
                                <ChevronRight className="h-3.5 w-3.5 text-primary" />
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
