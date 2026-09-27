"use client";

/** Every parcel in the store: filter by courier status, find by code, tracking number, order or phone, and move them along. */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, Truck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
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
  PARCEL_LABELS,
  PARCEL_NEXT,
  PARCEL_STATUSES,
  PARCEL_STYLES,
  apiError,
  useListParcelsQuery,
  useMoveParcelMutation,
  type Parcel,
  type ParcelStatus,
} from "@/lib/features/operations/fulfilment-api-slice";
import { NoteDialog } from "@/components/orders/parcels-card";
import { useCan } from "@/lib/permissions";

const money = (n: number) => `৳ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ShipmentsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [failing, setFailing] = useState<Parcel | null>(null);
  const { can } = useCan();
  const canEdit = can("orders.edit");
  const { data, isLoading, isFetching } = useListParcelsQuery({ status: status || undefined, search: search.trim() || undefined, page, perPage: 25 });
  const [moveParcel, { isLoading: moving }] = useMoveParcelMutation();
  const counts = data?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  async function move(p: Parcel, to: ParcelStatus, note?: string) {
    try {
      await moveParcel({ id: p.id, orderId: p.orderId, status: to, note }).unwrap();
      toast.success(`${p.code}: ${PARCEL_LABELS[to]}`);
      setFailing(null);
    } catch (e) {
      toast.error(apiError(e, "Couldn't update the parcel"));
    }
  }

  const tab = (value: string, label: string, n: number) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => { setStatus(value); setPage(1); }}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors whitespace-nowrap",
        status === value
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
      )}
    >
      {label} <span className="opacity-70">{n}</span>
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="h-5 w-5" /> Shipments
        </CardTitle>
        <p className="text-sm text-slate-500">Every parcel handed to a courier. Create parcels from an order's page.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tab("", "All", all)}
          {PARCEL_STATUSES.map((s) => tab(s, PARCEL_LABELS[s], counts[s] ?? 0))}
        </div>
        <Input
          className="h-9 max-w-sm"
          placeholder="Parcel code, tracking number, order number or phone"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Search shipments"
        />
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcel</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead className="text-right">Collect</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))}
              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">No parcels here.</TableCell></TableRow>
              )}
              {data?.items.map((p) => {
                const next = PARCEL_NEXT[p.status] ?? [];
                return (
                  <TableRow key={p.id} className={cn(isFetching && "opacity-60")}>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold">{p.code}</div>
                      <Link href={`/orders/${p.order.id}`} className="text-xs text-indigo-600 hover:underline">Order {p.order.number}</Link>
                      <div className="text-xs text-slate-500">{when(p.createdAt)}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{p.order.customerName}</div>
                      <div className="text-xs text-slate-500">{[p.order.phone, p.order.area].filter(Boolean).join(" · ")}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{p.providerName ?? "—"}</div>
                      {p.trackingNumber && (
                        p.trackingUrl ? (
                          <a href={p.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-indigo-600 hover:underline inline-flex items-center gap-0.5">
                            {p.trackingNumber} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <div className="font-mono text-xs text-slate-500">{p.trackingNumber}</div>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{p.codAmount > 0 ? money(p.codAmount) : <span className="text-slate-400">Paid</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[11px]", PARCEL_STYLES[p.status])}>{PARCEL_LABELS[p.status]}</Badge>
                      {p.status === "failed" && p.failedReason && <div className="text-xs text-red-600 mt-1 max-w-[180px] truncate" title={p.failedReason}>{p.failedReason}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && next.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={moving}>
                              Update <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Move parcel to</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {next.map((s) => (
                              <DropdownMenuItem key={s} onClick={() => (s === "failed" ? setFailing(p) : void move(p, s))}>
                                {PARCEL_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{data.total} parcels · page {page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
      {failing && (
        <NoteDialog
          title={`Delivery failed: ${failing.code}`}
          description="Say what happened (customer unreachable, refused, wrong address…)."
          confirm="Mark failed"
          busy={moving}
          onClose={() => setFailing(null)}
          onConfirm={(note) => void move(failing, "failed", note)}
        />
      )}
    </Card>
  );
}
