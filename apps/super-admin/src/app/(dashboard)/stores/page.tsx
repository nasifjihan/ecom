"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Search,
  CheckCircle2,
  MoreHorizontal,
  Edit3,
  PauseCircle,
  Plus,
  CreditCard,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  Input,
  Button,
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
  cn,
} from "@/components/ui";
import {
  apiErrorMessage,
  formatDate,
  formatMoney,
  useGetPlansQuery,
  useGetStoresQuery,
  useSetStoreStatusMutation,
  type StoreRow,
  type StoreStatus,
} from "@/lib/features/platform/platform-api-slice";
import {
  CreateStoreDialog,
  EmptyRow,
  Pager,
  PlanBadge,
  StoreStatusBadge,
  initials,
} from "@/components/platform/shared";
import { ChangePlanDialog } from "@/components/platform/change-plan-dialog";

const PER_PAGE = 20;

export default function SuperStoresPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(search);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [planStore, setPlanStore] = useState<StoreRow | null>(null);

  // The header search box navigates here with ?search=.
  useEffect(() => {
    const q = params.get("search");
    if (q !== null) setSearch(q);
    if (params.get("new") === "1") setCreating(true);
  }, [params]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, statusFilter, planFilter]);

  const { data: plans = [] } = useGetPlansQuery();
  const { data, isLoading, isFetching, isError } = useGetStoresQuery({
    page,
    perPage: PER_PAGE,
    search: debounced || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as StoreStatus),
    planId: planFilter === "all" ? undefined : planFilter,
  });
  const [setStoreStatus] = useSetStoreStatusMutation();

  const stores = data?.items ?? [];

  const toggleStatus = async (store: StoreRow) => {
    const action = store.status === "suspended" ? "activate" : "suspend";
    if (action === "suspend" && !window.confirm(`Suspend ${store.name}? Its storefront and admin stop working until it is activated again.`)) return;
    try {
      await setStoreStatus({ id: store.id, action }).unwrap();
      toast.success(action === "suspend" ? `Suspended ${store.name}` : `Activated ${store.name}`);
    } catch (err) {
      toast.error("Couldn't change the store status", { description: apiErrorMessage(err) });
    }
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">All Stores</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every tenant store on the platform. Change plans, suspend or reactivate.
          </p>
        </div>
        <Button size="sm" className="bg-rose-600 hover:bg-rose-500 text-white" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Store
        </Button>
      </motion.div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-3xl">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, slug, domain or owner email..."
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
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn("overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800", isFetching && !isLoading && "opacity-70")}>
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">GMV</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-16 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-12 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <EmptyRow colSpan={10} icon={Building2} title="Couldn't load stores" hint="Check that the API is running, then refresh." />
                ) : stores.length === 0 ? (
                  <EmptyRow colSpan={10} icon={Building2} title="No stores match these filters" hint="Try a different search or filter." />
                ) : (
                  stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <Link href={`/stores/${store.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                            <div className="h-full w-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-rose-500 to-red-600 text-white">
                              {initials(store.name)}
                            </div>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">{store.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                              {store.primaryDomain ?? `${store.slug} · no domain`}
                            </p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[180px] block">
                          {store.owner?.email ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <PlanBadge name={store.plan?.name} />
                      </TableCell>
                      <TableCell>
                        <StoreStatusBadge status={store.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {store.status === "trial" ? formatDate(store.trialEndsAt) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(store.mrr)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">{store.orders.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">{formatMoney(store.revenue, "BDT")}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(store.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${store.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-52" align="end">
                            <DropdownMenuLabel>Store Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`/stores/${store.id}`)} className="flex items-center gap-2 cursor-pointer">
                              <Edit3 className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPlanStore(store)} className="flex items-center gap-2 cursor-pointer">
                              <CreditCard className="h-4 w-4" />
                              Change Plan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleStatus(store)}
                              className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                store.status === "suspended" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {store.status === "suspended" ? <CheckCircle2 className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                              {store.status === "suspended" ? "Activate Store" : "Suspend Store"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && (
            <Pager page={data.page} totalPages={data.totalPages} total={data.total} perPage={PER_PAGE} noun="stores" onPage={setPage} />
          )}
        </CardContent>
      </Card>

      <CreateStoreDialog
        open={creating}
        onOpenChange={(o) => {
          setCreating(o);
          if (!o && params.get("new")) router.replace("/stores");
        }}
        onCreated={(id) => router.push(`/stores/${id}`)}
      />
      <ChangePlanDialog store={planStore} onOpenChange={(o) => !o && setPlanStore(null)} />
    </div>
  );
}
