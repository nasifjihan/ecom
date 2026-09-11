"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import {
  Building2,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  ShieldCheck,
  Edit3,
  PauseCircle,
  Trash2,
  LogIn,
  Send,
  ArrowUpDown,
  Plus,
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
  Avatar,
  Select,
  SelectItem,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/components/ui";

type StoreStatus = "active" | "trial" | "suspended" | "cancelled";
type PlanType = "Free" | "Starter" | "Pro" | "Enterprise";

interface MockStore {
  id: string;
  logo: string;
  name: string;
  domain: string;
  domainVerified: boolean;
  ownerEmail: string;
  plan: PlanType;
  status: StoreStatus;
  trialExpires?: string;
  mrr: number;
  orders: number;
  createdDate: string;
  country: string;
}

const mockStores: MockStore[] = Array.from({ length: 50 }, (_, i) => {
  const plans: PlanType[] = ["Free", "Starter", "Pro", "Enterprise"];
  const statuses: StoreStatus[] = [
    "active",
    "active",
    "active",
    "trial",
    "trial",
    "suspended",
    "cancelled",
  ];
  const status = statuses[i % statuses.length];
  const plan = plans[i % plans.length];
  return {
    id: `store-${1000 + i}`,
    logo: ["FB", "SH", "TG", "HL", "SM", "BB", "KW", "OP"][i % 8],
    name: [
      "Fashion BD Premium",
      "StyleHub Global",
      "TechGear Pro",
      "HomeLux Decor",
      "SportMax BD",
      "BeautyBliss Co",
      "KidsWorld Net",
      "OrganicPure Life",
    ][i % 8] + ` ${i + 1}`,
    domain: [
      "fashionbd.com",
      "stylehub.io",
      "techgear.pro",
      "homelux.com",
      "sportmax.bd",
      "beautybliss.co",
      "kidsworld.net",
      "organicpure.life",
    ][i % 8],
    domainVerified: i % 5 !== 0,
    ownerEmail: `owner${i + 1}@store${i + 1}.com`,
    plan,
    status,
    trialExpires:
      status === "trial"
        ? new Date(Date.now() + (i % 14 + 1) * 86400000).toLocaleDateString()
        : undefined,
    mrr: plan === "Enterprise"
      ? Math.floor(Math.random() * 800) + 500
      : plan === "Pro"
        ? Math.floor(Math.random() * 250) + 100
        : plan === "Starter"
          ? Math.floor(Math.random() * 80) + 29
          : 0,
    orders: Math.floor(Math.random() * 2000) + 50,
    createdDate: new Date(
      Date.now() - Math.floor(Math.random() * 365) * 86400000,
    ).toLocaleDateString(),
    country: ["BD", "US", "UK", "SG", "MY", "IN", "AU", "CA"][i % 8],
  };
});

const planColors: Record<PlanType, string> = {
  Free: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Starter: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Pro: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Enterprise: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const statusConfig: Record<
  StoreStatus,
  { variant: any; icon: any; text: string; color: string }
> = {
  active: {
    variant: "success",
    icon: CheckCircle2,
    text: "Active",
    color: "text-emerald-600",
  },
  trial: {
    variant: "info",
    icon: Clock,
    text: "Trial",
    color: "text-blue-600",
  },
  suspended: {
    variant: "destructive",
    icon: PauseCircle,
    text: "Suspended",
    color: "text-red-600",
  },
  cancelled: {
    variant: "secondary",
    icon: XCircle,
    text: "Cancelled",
    color: "text-slate-500",
  },
};

export default function SuperStoresPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading] = useState(false);

  const filteredStores = useMemo(() => {
    return mockStores.filter((store) => {
      const matchesSearch =
        store.name.toLowerCase().includes(search.toLowerCase()) ||
        store.domain.toLowerCase().includes(search.toLowerCase()) ||
        store.ownerEmail.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || store.status === statusFilter;
      const matchesPlan = planFilter === "all" || store.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [search, statusFilter, planFilter]);

  const allSelected = filteredStores.length > 0 &&
    filteredStores.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const newSet = new Set(selectedIds);
      filteredStores.forEach((s) => newSet.delete(s.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filteredStores.forEach((s) => newSet.add(s.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const runBulkAction = (action: string) => {
    if (selectedIds.size === 0) {
      toast.warning("No stores selected", {
        description: "Select at least one store to apply bulk actions.",
      });
      return;
    }
    const count = selectedIds.size;
    toast.success(`Bulk action: ${action}`, {
      description: `${count} store(s) affected. (Demo)`,
    });
  };

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
            All Stores
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage every tenant store on the platform. Edit plans, suspend,
            impersonate owners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Export queued", { description: "CSV export will download shortly." })}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </motion.div>

      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {selectedIds.size} selected
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Bulk actions available for selected stores
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select onValueChange={(v) => runBulkAction(`Change plan to ${v}`)}>
              <SelectItem value="">Change plan...</SelectItem>
              <SelectItem value="Starter">Upgrade to Starter</SelectItem>
              <SelectItem value="Pro">Upgrade to Pro</SelectItem>
              <SelectItem value="Enterprise">Upgrade to Enterprise</SelectItem>
            </Select>
            <Button
              size="sm"
              variant="warning"
              onClick={() => runBulkAction("Suspend")}
            >
              <PauseCircle className="h-4 w-4 mr-1.5" />
              Bulk Suspend
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => runBulkAction("Activate")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Bulk Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runBulkAction("Export CSV")}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1 max-w-3xl">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search stores, domains, owner emails..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="Free">Free</SelectItem>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1.5" />
                More Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white font-medium">
                      Store
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>Owner Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Expires</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-12 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredStores.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-12 text-slate-500"
                    >
                      <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No stores match filters</p>
                      <p className="text-sm mt-1">
                        Try adjusting your search or filter criteria.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStores.slice(0, 15).map((store) => {
                    const s = statusConfig[store.status];
                    const SIcon = s.icon;
                    return (
                      <TableRow
                        key={store.id}
                        data-state={
                          selectedIds.has(store.id) ? "selected" : undefined
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(store.id)}
                            onCheckedChange={() => toggleSelect(store.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/stores/${store.id}`}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                          >
                            <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                              <div
                                className={cn(
                                  "h-full w-full flex items-center justify-center text-xs font-bold bg-gradient-to-br",
                                  store.plan === "Enterprise"
                                    ? "from-rose-500 to-red-600 text-white"
                                    : store.plan === "Pro"
                                      ? "from-amber-500 to-orange-500 text-white"
                                      : store.plan === "Starter"
                                        ? "from-emerald-500 to-teal-500 text-white"
                                        : "from-slate-500 to-slate-600 text-white",
                                )}
                              >
                                {store.logo}
                              </div>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                                {store.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] flex items-center gap-1">
                                {store.domain}
                                {store.domainVerified ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 inline-flex" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-slate-400 inline-flex" />
                                )}
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {store.country}
                                </span>
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[180px] block">
                            {store.ownerEmail}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("border-0", planColors[store.plan])}
                          >
                            {store.plan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <SIcon
                              className={cn("h-3.5 w-3.5", s.color)}
                            />
                            <Badge
                              variant={s.variant}
                              className="border-0"
                            >
                              {s.text}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {store.trialExpires ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                            ${store.mrr.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                            {store.orders.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {store.createdDate}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                              <DropdownMenuLabel>
                                Store Actions
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/stores/${store.id}`}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit3 className="h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toast.success("Impersonating owner", {
                                    description: `Logging into ${store.name} as owner.`,
                                  })
                                }
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Impersonate Login
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toast.info("Change plan dialog", {
                                    description: `Open plan change for ${store.name}. (Demo)`,
                                  })
                                }
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <CreditCard className="h-4 w-4" />
                                Edit Plan
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {store.status !== "suspended" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    toast.warning(`Suspended: ${store.name}`)
                                  }
                                  className="flex items-center gap-2 cursor-pointer text-amber-600 focus:text-amber-600 dark:text-amber-400"
                                >
                                  <PauseCircle className="h-4 w-4" />
                                  Suspend Store
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    toast.success(`Activated: ${store.name}`)
                                  }
                                  className="flex items-center gap-2 cursor-pointer text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Activate Store
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  toast.success("Warning email sent", {
                                    description: `Sent to ${store.ownerEmail}`,
                                  })
                                }
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Send className="h-4 w-4" />
                                Send Warning
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  toast.error(`Deleted: ${store.name}`, {
                                    description: "Double-confirm required in production.",
                                  })
                                }
                                className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Permanently
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

          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                1
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(15, filteredStores.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {filteredStores.length}
              </span>{" "}
              stores
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              {[1, 2, 3, 4].map((p) => (
                <Button
                  key={p}
                  variant={p === 1 ? "default" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-8 w-8 text-xs",
                    p === 1 && "bg-rose-600 hover:bg-rose-500 text-white",
                  )}
                >
                  {p}
                </Button>
              ))}
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
