"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Sun,
  Moon,
  Menu,
  LogOut,
  Plus,
  ShieldCheck,
  CreditCard,
  Building2,
  Globe2,
  ChevronDown,
} from "lucide-react";
import {
  Button,
  Input,
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Badge,
  Separator,
} from "@/components/ui";
import {
  useMeSuperQuery,
  useLogoutSuperMutation,
} from "@/lib/features/auth/auth-api-slice";
import { useDispatch, useSelector } from "react-redux";
import { superLogout } from "@/lib/features/auth/auth-slice";
import type { RootState } from "@/lib/store";

interface SuperHeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export default function SuperHeader({
  collapsed,
  onToggleSidebar,
}: SuperHeaderProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: meData, isLoading: meLoading } = useMeSuperQuery();
  const [logoutApi, { isLoading: loggingOut }] = useLogoutSuperMutation();
  const authUser = useSelector((state: RootState) => state.auth.user);

  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
    } finally {
      dispatch(superLogout());
      toast.success("Signed out from platform", {
        description: "Super admin session has been terminated.",
      });
      router.replace("/super/login");
    }
  };

  const displayUser = meData?.user ?? authUser;
  const displayName = displayUser?.name ?? "Super Admin";
  const displayEmail = displayUser?.email ?? "";
  const displayRole = displayUser?.role ?? "super_owner";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const quickCreateItems = [
    {
      icon: Building2,
      label: "New Store",
      description: "Create a tenant store",
      href: "/stores?new=1",
    },
    {
      icon: CreditCard,
      label: "New Plan",
      description: "Create a billing plan",
      href: "/billing/plans?new=1",
    },
    {
      icon: Globe2,
      label: "New Domain",
      description: "Attach a domain to a store",
      href: "/stores/domains?new=1",
    },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative max-w-xl flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Search stores by name, domain or owner email..."
          onKeyDown={(e) => {
            const q = e.currentTarget.value.trim();
            if (e.key === "Enter" && q) router.push(`/stores?search=${encodeURIComponent(q)}`);
          }}
          className="h-9 w-full border-slate-200 bg-slate-50 pl-9 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 focus:ring-rose-500 focus:border-rose-500"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-9 gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Quick Create</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 p-1"
            sideOffset={8}
          >
            {quickCreateItems.map((item) => (
              <DropdownMenuItem asChild key={item.label} className="p-0 my-0.5">
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.description}
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          disabled={!mounted}
          className="h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Toggle theme"
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )
          ) : (
            <Skeleton className="h-5 w-5 rounded-full" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-8 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 h-9 rounded-lg px-1.5 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {meLoading && !displayUser ? (
                <>
                  <Skeleton className="h-8 w-8 rounded-full" />
                  {!collapsed && (
                    <div className="hidden sm:block space-y-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2 w-24" />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Avatar className="h-8 w-8 border-2 border-rose-200 dark:border-rose-900">
                    <span className="text-xs font-semibold bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center h-full w-full">
                      {initials}
                    </span>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {displayName}
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 line-clamp-1 font-medium">
                      {displayRole.replace(/_/g, " ")}
                    </p>
                  </div>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72" sideOffset={8}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-12 w-12">
                  <span className="text-sm font-semibold bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center h-full w-full">
                    {initials}
                  </span>
                </Avatar>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {displayEmail}
                  </p>
                  <Badge
                    variant="destructive"
                    className="bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/15 border-0"
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {displayRole.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-3 cursor-pointer text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
              <span>{loggingOut ? "Signing out..." : "Logout Platform"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}
