"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CreditCard, Search } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { useGetSubscriptionsQuery } from "@/lib/features/platform/platform-api-slice";

const fd = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useGetSubscriptionsQuery({ search: search || undefined });
  const subs = data?.items ?? [];
  const active = subs.filter((s) => s.status === "active");
  const mrr = active.reduce((n, s) => n + s.price, 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Platform billing subscriptions, one per store. {data ? `${data.total} total · ${active.length} active · $${mrr} MRR on this page` : ""}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search store" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-60" />
        </div>
      </motion.div>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="p-6 text-sm text-red-600">Could not load subscriptions.</p>
          ) : subs.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <CreditCard className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              No subscriptions yet. They are created once platform billing (Stripe) is connected.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period ends</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/stores/${s.storeId}`} className="font-medium text-rose-600 hover:underline">
                        {s.storeName}
                      </Link>
                    </TableCell>
                    <TableCell>{s.plan}</TableCell>
                    <TableCell>${s.price}/mo</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">
                        {s.status.replace(/_/g, " ")}
                      </Badge>
                      {s.cancelAtPeriodEnd && <span className="ml-2 text-xs text-amber-600">cancels at period end</span>}
                    </TableCell>
                    <TableCell>{fd(s.currentPeriodEnd)}</TableCell>
                    <TableCell>{fd(s.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
