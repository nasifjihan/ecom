"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Receipt,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Clock,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  MoreHorizontal,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  FileText,
  Download,
  RotateCcw,
  ArrowUpDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  Badge,
  Checkbox,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Select,
  SelectItem,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/components/ui";

type SubStatus = "active" | "past_due" | "cancelled" | "scheduled";
type PaymentMethod = "card" | "bkash" | "nagad" | "bank";

interface Subscription {
  id: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  plan: string;
  billingCycle: "Monthly" | "Annual";
  status: SubStatus;
  nextBillingDate: string;
  daysUntil: number;
  price: number;
  lastPaymentDate: string;
  lastPaymentStatus: "paid" | "failed";
  paymentMethod: PaymentMethod;
  cardLast4?: string;
}

const mockSubs: Subscription[] = Array.from({ length: 30 }, (_, i) => {
  const statuses: SubStatus[] = [
    "active",
    "active",
    "active",
    "active",
    "past_due",
    "cancelled",
    "scheduled",
  ];
  const status = statuses[i % statuses.length];
  const paymentMethods: PaymentMethod[] = ["card", "card", "bkash", "nagad", "bank"];
  const plans = ["Starter", "Pro", "Enterprise", "Starter", "Pro"];
  return {
    id: `sub-${2000 + i}`,
    storeId: `store-${1000 + i}`,
    storeName: [
      "Fashion BD Premium",
      "StyleHub Global",
      "TechGear Pro",
      "HomeLux Decor",
      "SportMax BD",
      "BeautyBliss Co",
    ][i % 6] + ` ${i + 1}`,
    storeLogo: ["FB", "SH", "TG", "HL", "SM", "BB"][i % 6],
    plan: plans[i % plans.length],
    billingCycle: i % 3 === 0 ? "Annual" : "Monthly",
    status,
    nextBillingDate: new Date(
      Date.now() + (i + 1) * 86400000,
    ).toLocaleDateString(),
    daysUntil: i + 1,
    price:
      plans[i % plans.length] === "Enterprise"
        ? 499
        : plans[i % plans.length] === "Pro"
          ? 99
          : 29,
    lastPaymentDate: new Date(
      Date.now() - (i + 1) * 86400000 * 30,
    ).toLocaleDateString(),
    lastPaymentStatus: i % 7 === 4 ? "failed" : "paid",
    paymentMethod: paymentMethods[i % paymentMethods.length],
    cardLast4: (1000 + i * 37).toString().slice(-4),
  };
});

const statusConfig: Record<
  SubStatus,
  { variant: any; color: string; icon: any; label: string }
> = {
  active: {
    variant: "success",
    color: "text-emerald-600",
    icon: CheckCircle2,
    label: "Active",
  },
  past_due: {
    variant: "warning",
    color: "text-amber-600",
    icon: AlertTriangle,
    label: "Past Due",
  },
  cancelled: {
    variant: "destructive",
    color: "text-red-600",
    icon: XCircle,
    label: "Cancelled",
  },
  scheduled: {
    variant: "info",
    color: "text-blue-600",
    icon: Clock,
    label: "Scheduled",
  },
};

const pmIcons: Record<PaymentMethod, any> = {
  card: CreditCard,
  bkash: DollarSign,
  nagad: DollarSign,
  bank: Wallet,
};

const pmLabels: Record<PaymentMethod, string> = {
  card: "Card",
  bkash: "bKash",
  nagad: "Nagad",
  bank: "Bank Transfer",
};

export default function SuperBillingSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");

  const filteredSubs = useMemo(
    () =>
      mockSubs.filter(
        (s) =>
          s.storeName.toLowerCase().includes(search.toLowerCase()) &&
          (statusFilter === "all" || s.status === statusFilter) &&
          (planFilter === "all" || s.plan === planFilter) &&
          (cycleFilter === "all" || s.billingCycle === cycleFilter),
      ),
    [search, statusFilter, planFilter, cycleFilter],
  );

  const stats = useMemo(() => {
    const active = mockSubs.filter((s) => s.status === "active").length;
    const pastDue = mockSubs.filter((s) => s.status === "past_due").length;
    const monthlyRevenue = mockSubs
      .filter((s) => s.status === "active")
      .reduce(
        (sum, s) =>
          sum + (s.billingCycle === "Annual" ? s.price / 12 : s.price),
        0,
      );
    const atRisk =
      mockSubs.filter((s) => s.status === "cancelled" || s.status === "past_due").length;
    return { active, pastDue, monthlyRevenue, atRisk };
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Subscriptions & Invoices
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            All tenant store subscriptions, billing cycles, payment statuses,
            and invoice history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1.5" />
            Export All
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Subscriptions", value: stats.active.toString(), icon: CheckCircle2, color: "emerald", sub: `${((stats.active / mockSubs.length) * 100).toFixed(0)}% of total` },
          { label: "Monthly Recurring Revenue", value: `$${stats.monthlyRevenue.toFixed(0)}`, icon: DollarSign, color: "blue", sub: `$${(stats.monthlyRevenue * 12).toFixed(0)}/yr annualized` },
          { label: "Past Due Accounts", value: stats.pastDue.toString(), icon: AlertTriangle, color: "amber", sub: "Requires attention" },
          { label: "At-Risk (Cancelled)", value: stats.atRisk.toString(), icon: XCircle, color: "rose", sub: "Churn candidates" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s.label}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
                      {s.value}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">{s.sub}</p>
                  </div>
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center",
                      s.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
                      s.color === "blue" && "bg-blue-500/10 text-blue-600",
                      s.color === "amber" && "bg-amber-500/10 text-amber-600",
                      s.color === "rose" && "bg-rose-500/10 text-rose-600",
                    )}
                  >
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1 max-w-4xl">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search store subscriptions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="Free">Free</SelectItem>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                </Select>
                <Select value={cycleFilter} onValueChange={setCycleFilter}>
                  <SelectItem value="all">All Cycles</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white font-medium">
                      Store
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs.slice(0, 20).map((sub) => {
                  const s = statusConfig[sub.status];
                  const SIcon = s.icon;
                  const PmIcon = pmIcons[sub.paymentMethod];
                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {sub.storeLogo}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                              {sub.storeName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {sub.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sub.plan === "Enterprise" ? "destructive" : sub.plan === "Pro" ? "default" : "secondary"}
                          className={cn(
                            "border-0",
                            sub.plan === "Enterprise" && "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                            sub.plan === "Pro" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                            sub.plan === "Starter" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {sub.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {sub.billingCycle}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <SIcon className={cn("h-3.5 w-3.5", s.color)} />
                          <Badge variant={s.variant} className="border-0">
                            {s.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                            {sub.nextBillingDate}
                          </p>
                          <p
                            className={cn(
                              "text-[11px]",
                              sub.daysUntil <= 3
                                ? "text-red-600 font-semibold"
                                : sub.daysUntil <= 7
                                  ? "text-amber-600"
                                  : "text-slate-500",
                            )}
                          >
                            {sub.daysUntil} day{sub.daysUntil === 1 ? "" : "s"} left
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          ${sub.price}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          / {sub.billingCycle.toLowerCase().slice(0, 3)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                            {sub.lastPaymentDate}
                          </p>
                          {sub.lastPaymentStatus === "paid" ? (
                            <Badge variant="success" className="border-0 mt-0.5 text-[10px] px-1.5 py-0 h-4">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="border-0 mt-0.5 text-[10px] px-1.5 py-0 h-4">
                              Failed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <PmIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-300">
                            {pmLabels[sub.paymentMethod]}
                            {sub.paymentMethod === "card" && sub.cardLast4 && (
                              <span className="font-mono text-slate-500 ml-1">
                                ••{sub.cardLast4}
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Subscription Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                toast.info(`Invoices for ${sub.storeName}`)
                              }
                              className="cursor-pointer"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View Invoices
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toast.info(`Change plan for ${sub.storeName}`)}
                              className="cursor-pointer"
                            >
                              <ArrowLeftRight className="h-4 w-4 mr-2" />
                              Change Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toast.success(`Applied $5 credit (Demo)`)}
                              className="cursor-pointer"
                            >
                              <Wallet className="h-4 w-4 mr-2" />
                              Apply Credit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toast.success(`Refund issued: $${sub.price} (Demo)`)
                              }
                              className="cursor-pointer"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Issue Refund
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                toast.warning(
                                  `Scheduled cancellation at period end: ${sub.storeName}`,
                                )
                              }
                              className="cursor-pointer text-amber-600 focus:text-amber-600"
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Cancel at Period End
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toast.error(
                                  `Cancelled immediately: ${sub.storeName} (confirm required)`,
                                )
                              }
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Immediately
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing 1 to {Math.min(20, filteredSubs.length)} of{" "}
              {filteredSubs.length} subscriptions
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="default" size="icon" className="h-8 w-8 text-xs bg-rose-600 hover:bg-rose-500">
                1
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-xs">
                2
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
