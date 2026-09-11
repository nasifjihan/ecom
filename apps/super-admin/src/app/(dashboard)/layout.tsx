"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SuperSidebar from "@/components/layout/Sidebar";
import SuperHeader from "@/components/layout/Header";

export default function SuperDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AnimatePresence initial={false}>
        <SuperSidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </AnimatePresence>

      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 72 : 264 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex min-h-screen flex-1 flex-col"
      >
        <SuperHeader
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-slate-950/50">
          {children}
        </main>
      </motion.div>
    </div>
  );
}
