"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@ecom/utils";
import { Card, CardContent } from "@/components/ui";
import { SETTINGS_SECTIONS } from "@/lib/nav";
import { useCan } from "@/lib/permissions";

function isActive(path: string, href: string) {
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
  const { can } = useCan();
  const groups = SETTINGS_SECTIONS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length);

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
            Your account, store details, emails and team.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {groups.map((group) => (
                  <div key={group.title} className="mb-2 first:mt-1">
                    <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {group.title}
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
