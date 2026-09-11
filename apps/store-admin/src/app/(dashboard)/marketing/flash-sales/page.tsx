"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import {
  Zap,
  Plus,
  MoreHorizontal,
  Pencil,
  Layers,
  BarChart3,
  StopCircle,
  Loader2,
  ShoppingBag,
  Clock3,
  TrendingUp,
} from "lucide-react";
import { formatMoney } from "@ecom/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
} from "@/components/ui";
import {
  useGetFlashSalesQuery,
  useStopFlashSaleMutation,
  type FlashSale,
} from "@/lib/features/marketing/marketing-api-slice";

type FlashStatus = "active" | "scheduled" | "expired";

function computeFlashStatus(fs: FlashSale): FlashStatus {
  const now = new Date();
  const start = new Date(fs.startDate);
  const end = new Date(fs.endDate);
  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}

function useCountdown(target: string | Date) {
  const targetMs = typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, targetMs - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff / 3_600_000) % 24);
  const minutes = Math.floor((diff / 60_000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, ended: diff === 0 };
}

function CountdownTimer({ target }: { target: string | Date }) {
  const { days, hours, minutes, seconds, ended } = useCountdown(target);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (ended) return <span className="font-mono text-white/80">Ended</span>;
  return (
    <div className="flex items-center gap-1 font-mono text-white tabular-nums">
      <TimeBlock label="Days" value={String(days)} />
      <span className="text-white/60 mx-1">:</span>
      <TimeBlock label="Hours" value={pad(hours)} />
      <span className="text-white/60 mx-1">:</span>
      <TimeBlock label="Minutes" value={pad(minutes)} />
      <span className="text-white/60 mx-1">:</span>
      <TimeBlock label="Seconds" value={pad(seconds)} />
    </div>
  );
}

function TimeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="min-w-[2.3rem] text-center rounded-md bg-black/20 px-2 py-1 text-lg font-bold">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-white/60 mt-0.5">
        {label}
      </div>
    </div>
  );
}

export default function FlashSalesPage() {
  const [tab, setTab] = useState<FlashStatus>("active");
  const { data: listData, isLoading } = useGetFlashSalesQuery({ status: tab });
  const sales = listData?.items ?? [];
  const [stopSale, stopLoading] = useStopFlashSaleMutation();

  const activeSale = useMemo(() => {
    if (tab === "active") return sales[0];
    return sales.find((s) => computeFlashStatus(s) === "active");
  }, [sales, tab]);

  const stats = useMemo(() => {
    const all = (listData?.items ?? sales).length > 0 ? listData?.items ?? sales : undefined;
    // Fall back to counting current page results
    const allSales = listData?.items ?? [];
    return {
      active: allSales.filter((s) => computeFlashStatus(s) === "active").length,
      scheduled: allSales.filter((s) => computeFlashStatus(s) === "scheduled").length,
      expired: allSales.filter((s) => computeFlashStatus(s) === "expired").length,
    };
  }, [listData, sales]);

  const handleStop = async (s: FlashSale) => {
    try {
      await stopSale(s.id).unwrap();
      toast.success("Flash sale stopped.");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to stop sale.");
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-orange-600" /> Flash Sales
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Limited-time campaigns with urgency timers to boost conversion.
          </p>
        </div>
        <Link href="/marketing/flash-sales/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Create Flash Sale
          </Button>
        </Link>
      </motion.div>

      {activeSale && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 p-6 text-white shadow-xl"
        >
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-black/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                <Zap className="h-3 w-3 mr-1" /> LIVE NOW
              </Badge>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{activeSale.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-white/90">
                <Badge className="bg-white text-rose-600 border-0">
                  {activeSale.discountType === "percentage"
                    ? `${activeSale.discountValue}% OFF`
                    : `${formatMoney(activeSale.discountValue)} OFF`}
                </Badge>
                <span className="text-sm">
                  <ShoppingBag className="h-3.5 w-3.5 inline mr-1" />
                  {activeSale.productsIncludedCount ?? 0} products
                </span>
                <span className="text-sm">
                  <Clock3 className="h-3.5 w-3.5 inline mr-1" />
                  Ends {new Date(activeSale.endDate).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <CountdownTimer target={activeSale.endDate} />
              <a href="#" onClick={(e) => e.preventDefault()}>
                <Button className="bg-white text-rose-600 hover:bg-white/90 shadow-lg">
                  Shop Now
                </Button>
              </a>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              label="Items Sold"
              value={(activeSale.currentSalesCount ?? 0).toLocaleString()}
            />
            <MiniStat
              label="Revenue"
              value={formatMoney(activeSale.revenueGenerated ?? 0)}
            />
            <MiniStat
              label="Per User Limit"
              value={
                activeSale.perUserLimit ? `${activeSale.perUserLimit}x` : "Unlimited"
              }
            />
            <MiniStat
              label="Max/Order"
              value={activeSale.maxQtyPerOrder ? `${activeSale.maxQtyPerOrder} units` : "—"}
            />
          </div>
        </motion.div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger
                value="active"
                onClick={() => setTab("active")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                Active
                <Badge className="ml-2 !h-5 !px-1.5 text-[10px]">{stats.active}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="scheduled"
                onClick={() => setTab("scheduled")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                Scheduled
                <Badge variant="secondary" className="ml-2 !h-5 !px-1.5 text-[10px]">
                  {stats.scheduled}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="expired"
                onClick={() => setTab("expired")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                Expired
                <Badge variant="secondary" className="ml-2 !h-5 !px-1.5 text-[10px]">
                  {stats.expired}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campaign Period</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Qty Limits</TableHead>
                <TableHead>Per User</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && sales.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center py-12 text-slate-500"
                  >
                    <Zap className="h-10 w-10 mx-auto opacity-40 mb-2" />
                    No {tab} flash sales. Create one to drive traffic!
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                sales.map((s) => {
                  const st = computeFlashStatus(s);
                  return (
                    <TableRow key={String(s.id)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white">
                            <Zap className="h-4 w-4" />
                          </div>
                          <div className="font-medium">{s.title}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {st === "active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : st === "scheduled" ? (
                          <Badge variant="secondary">Scheduled</Badge>
                        ) : (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(s.startDate).toLocaleDateString()}
                        <span className="mx-1">→</span>
                        {new Date(s.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {s.discountType === "percentage"
                            ? `${s.discountValue}%`
                            : formatMoney(s.discountValue)}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">
                          {s.discountType === "percentage" ? "OFF" : "OFF"}
                        </span>
                      </TableCell>
                      <TableCell>{s.productsIncludedCount ?? 0}</TableCell>
                      <TableCell className="text-xs">
                        {s.minQtyPerOrder ? `Min ${s.minQtyPerOrder}` : "—"} /{" "}
                        {s.maxQtyPerOrder ? `Max ${s.maxQtyPerOrder}` : "∞"}
                      </TableCell>
                      <TableCell>{s.perUserLimit ?? "∞"}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                          {s.currentSalesCount ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          {formatMoney(s.revenueGenerated ?? 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <Link
                              href={`/marketing/flash-sales/new?edit=${s.id}`}
                              className="w-full"
                            >
                              <DropdownMenuItem>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem>
                              <Layers className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <BarChart3 className="h-4 w-4 mr-2" /> View Stats
                            </DropdownMenuItem>
                            {st === "active" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleStop(s)}
                                  disabled={stopLoading}
                                  className="text-amber-600 dark:text-amber-400"
                                >
                                  {stopLoading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <StopCircle className="h-4 w-4 mr-2" />
                                  )}
                                  Stop Sale
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-white/70">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
