"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { PageGuard } from "@/components/layout/page-guard";
import { useTextSize } from "@/lib/features/settings/preferences-api-slice";
import { useMeQuery } from "@/lib/features/auth/auth-api-slice";
import { TwoFactorCard } from "@/components/settings/two-factor-card";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useTextSize();
  const { data: me } = useMeQuery();

  // The store requires two-step sign-in: nothing else works until it's set up (the API refuses the rest).
  if (me?.twoFactorSetupRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-2xl space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Set up two-step sign-in to continue</h1>
            <p className="text-sm text-slate-500">The shop owner requires it for everyone on the team. It takes a minute with an authenticator app on your phone.</p>
          </div>
          <TwoFactorCard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AnimatePresence initial={false}>
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </AnimatePresence>

      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex min-h-screen min-w-0 flex-1 flex-col"
      >
        <Header
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 min-w-0 overflow-auto p-6">
          <PageGuard>{children}</PageGuard>
        </main>
      </motion.div>
    </div>
  );
}
