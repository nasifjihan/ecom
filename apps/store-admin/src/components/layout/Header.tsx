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
  Settings,
  Building2,
  UserRound,
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
} from "@/components/ui";
import {
  useMeQuery,
  useLogoutMutation,
} from "@/lib/features/auth/auth-api-slice";
import { useDispatch, useSelector } from "react-redux";
import { logout as logoutAction } from "@/lib/features/auth/auth-slice";
import type { RootState } from "@/lib/store";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ collapsed, onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: meData, isLoading: meLoading } = useMeQuery();
  const [logoutApi, { isLoading: loggingOut }] = useLogoutMutation();
  const authUser = useSelector((state: RootState) => state.auth.user);

  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
    } finally {
      dispatch(logoutAction());
      toast.success("Logged out successfully");
      router.replace("/login");
    }
  };

  const displayUser = meData?.user ?? authUser;
  const displayName = displayUser?.name ?? "Admin User";
  const displayEmail = displayUser?.email ?? "admin@store.com";
  const displayRole = displayUser?.role ?? "Store Admin";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
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

      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Search orders, customers, products..."
          className="h-9 w-full border-slate-200 bg-slate-50 pl-9 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />

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

        <div className="mx-2 h-8 w-px bg-slate-200 dark:bg-slate-700" />

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
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Avatar className="h-8 w-8 border-2 border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-gradient-to-br from-indigo-400 to-purple-500 text-white">
                      {initials}
                    </span>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {displayRole}
                    </p>
                  </div>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  <span className="text-sm font-semibold bg-gradient-to-br from-indigo-400 to-purple-500 text-white">
                    {initials}
                  </span>
                </Avatar>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {displayEmail}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-400">
                    {displayRole}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/settings/profile"
                className="flex items-center gap-3 cursor-pointer"
              >
                <UserRound className="h-4 w-4" />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings/store"
                className="flex items-center gap-3 cursor-pointer"
              >
                <Building2 className="h-4 w-4" />
                <span>Store Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-3 cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span>{loggingOut ? "Signing out..." : "Logout"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}
