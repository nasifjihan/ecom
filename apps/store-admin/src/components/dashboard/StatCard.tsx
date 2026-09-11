"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { cn } from "@/components/ui";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: number;
  iconColor?: string;
  iconBgColor?: string;
  currency?: string;
  delay?: number;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  iconColor = "text-indigo-600 dark:text-indigo-400",
  iconBgColor = "bg-indigo-50 dark:bg-indigo-500/10",
  delay = 0,
}: StatCardProps) {
  const isPositive = (delta ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {value}
              </p>
              {delta !== undefined ? (
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    isPositive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span>
                    {Math.abs(delta).toFixed(1)}%
                    <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                      vs last 7 days
                    </span>
                  </span>
                </div>
              ) : (
                <div className="h-5" />
              )}
            </div>
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                iconBgColor,
              )}
            >
              <Icon className={cn("h-6 w-6", iconColor)} />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 w-full">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
