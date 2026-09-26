"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, DollarSign, MoreHorizontal, Receipt, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import {
  apiErrorMessage,
  formatDate,
  formatMoney,
  useGetPlansQuery,
  useGetSubscriptionsQuery,
  useUpdateSubscriptionMutation,
  type SubscriptionRow,
  type SubscriptionStatus,
} from "@/lib/features/platform/platform-api-slice";
import { EmptyRow, PlanBadge } from "@/components/platform/shared";
import { subscriptionStatusConfig } from "@/components/platform/subscription-card";
import { ChangePlanDialog } from "@/components/platform/change-plan-dialog";

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [planId, setPlanId] = useState("all");
  const [planStore, setPlanStore] = useState<SubscriptionRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: plans = [] } = useGetPlansQuery();
  const { data, isLoading, isError, isFetching } = useGetSubscriptionsQuery({
    search: debounced || undefined,
    status: status as SubscriptionStatus | "all",
    planId: planId === "all" ? undefined : planId,
  });
  const [save] = useUpdateSubscriptionMutation();
  const rows = data?.items ?? [];
  const summary = data?.summary;

  const setSubStatus = async (row: SubscriptionRow, patch: { status?: SubscriptionStatus; cancelAtPeriodEnd?: boolean }, label: string) => {
    try {
      await save({ storeId: row.storeId, ...patch }).unwrap();
      toast.success(label, { description: row.storeName });
    } catch (err) {
      toast.error("Couldn't update the subscription", { description: apiErrorMessage(err) });
    }
  };

  const cards = [
    { label: "MRR", value: summary ? formatMoney(summary.mrr) : "—", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Active", value: summary?.active ?? "—", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Trialing", value: summary?.trialing ?? "—", icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Past due", value: summary?.pastDue ?? "—", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Cancelled", value: summary?.cancelled ?? "—", icon: XCircle, color: "text-slate-500", bg: "bg-slate-500/10" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscriptions</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          One row per store. Stores without a subscription record show the status implied by the store.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", c.bg)}>
                <c.icon className={cn("h-4 w-4", c.color)} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3 max-w-3xl">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search stores..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past_due">Past due</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </Select>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectItem value="all">All Plans</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn("overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800", isFetching && !isLoading && "opacity-70")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period Ends</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="w-16 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <EmptyRow colSpan={8} icon={Receipt} title="Couldn't load subscriptions" />
                ) : rows.length === 0 ? (
                  <EmptyRow colSpan={8} icon={Receipt} title="No subscriptions match these filters" />
                ) : (
                  rows.map((row) => {
                    const cfg = subscriptionStatusConfig[row.status] ?? subscriptionStatusConfig.cancelled;
                    return (
                      <TableRow key={row.storeId}>
                        <TableCell>
                          <Link href={`/stores/${row.storeId}`} className="hover:text-rose-600">
                            <p className="text-sm font-semibold">{row.storeName}</p>
                            <p className="text-xs text-slate-500">{row.domain || "no domain"}</p>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <PlanBadge name={row.plan?.name} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={cfg.variant} className="border-0">
                              {cfg.text}
                            </Badge>
                            {!row.id && <span className="text-[10px] text-slate-400">no record</span>}
                            {row.cancelAtPeriodEnd && <span className="text-[10px] text-amber-600">cancels at period end</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{formatDate(row.currentPeriodEnd)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{row.plan ? `${formatMoney(row.plan.priceMonthly)}/mo` : "—"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">{formatMoney(row.mrr)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{formatDate(row.createdAt)}</TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${row.storeName}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>{row.storeName}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setPlanStore(row)}>
                                Change plan
                              </DropdownMenuItem>
                              {row.status !== "active" && (
                                <DropdownMenuItem className="cursor-pointer" disabled={!row.plan} onClick={() => setSubStatus(row, { status: "active" }, "Marked active")}>
                                  Mark active
                                </DropdownMenuItem>
                              )}
                              {row.status !== "past_due" && (
                                <DropdownMenuItem className="cursor-pointer" disabled={!row.plan} onClick={() => setSubStatus(row, { status: "past_due" }, "Marked past due")}>
                                  Mark past due
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={!row.plan}
                                onClick={() =>
                                  setSubStatus(row, { cancelAtPeriodEnd: !row.cancelAtPeriodEnd }, row.cancelAtPeriodEnd ? "Cancellation withdrawn" : "Set to cancel at period end")
                                }
                              >
                                {row.cancelAtPeriodEnd ? "Keep renewing" : "Cancel at period end"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ChangePlanDialog
        store={planStore ? { id: planStore.storeId, name: planStore.storeName, status: planStore.storeStatus, plan: planStore.plan } : null}
        onOpenChange={(o) => !o && setPlanStore(null)}
      />
    </div>
  );
}
