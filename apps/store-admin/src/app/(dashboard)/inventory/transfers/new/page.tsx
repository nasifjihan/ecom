"use client";

/** Send stock to another warehouse: pick the source, the destination and what's going. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, Search, Send, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useSendTransferMutation, useWarehouseStockQuery, useWarehousesQuery, type StockRow } from "@/lib/features/warehouses/warehouses-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function NewTransferPage() {
  const router = useRouter();
  const { data: warehouses } = useWarehousesQuery();
  const live = (warehouses ?? []).filter((w) => w.isActive);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<{ row: StockRow; qty: string }[]>([]);
  const [note, setNote] = useState("");
  const [send, { isLoading }] = useSendTransferMutation();

  useEffect(() => {
    if (!from && live[0]) setFrom(live.find((w) => w.isDefault)?.id ?? live[0].id);
  }, [from, live]);
  useEffect(() => {
    if (!to || to === from) setTo(live.find((w) => w.id !== from)?.id ?? "");
  }, [from, to, live]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setLines([]), [from]);

  const { data: stock, isFetching } = useWarehouseStockQuery({ warehouseId: from || undefined, search: search || undefined }, { skip: !from });
  /** Free = on the shelf and not held for orders; only that can leave. */
  const free = (r: StockRow) => {
    const at = r.byWarehouse.find((b) => b.warehouseId === from);
    return (at?.onHand ?? 0) - (at?.reserved ?? 0);
  };
  const picked = new Set(lines.map((l) => l.row.key));
  const candidates = (stock?.items ?? []).filter((r) => !picked.has(r.key) && free(r) > 0).slice(0, 12);

  const problems = [
    live.length < 2 && "Add a second warehouse first",
    from === to && "Choose two different warehouses",
    !lines.length && "Add at least one item",
    lines.some((l) => !(Number(l.qty) >= 1) || !Number.isInteger(Number(l.qty))) && "Quantities must be whole numbers of 1 or more",
    lines.some((l) => Number(l.qty) > free(l.row)) && "Some quantities are more than is free to send",
  ].filter(Boolean) as string[];

  const submit = async () => {
    try {
      const t = await send({
        fromWarehouseId: from,
        toWarehouseId: to,
        items: lines.map((l) => ({ productId: l.row.productId, variantId: l.row.variantId, qty: Number(l.qty) })),
        note,
      }).unwrap();
      toast.success(`${t.code} sent: ${t.units} units on the way to ${t.to.name}`);
      router.push("/inventory/transfers");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const fromName = live.find((w) => w.id === from)?.code ?? "";
  return (
    <div className="space-y-6">
      <PageTitle
        icon={ArrowLeftRight}
        title="New transfer"
        description="The stock leaves the sending warehouse as soon as you send it, and arrives when the other warehouse receives it."
        actions={
          <Button variant="outline" asChild>
            <Link href="/inventory/transfers">
              <ArrowLeft className="mr-1 h-4 w-4" /> Transfers
            </Link>
          </Button>
        }
      />
      {!warehouses ? (
        <Skeleton className="h-40" />
      ) : live.length < 2 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            You have one warehouse. <Link href="/inventory/warehouses" className="text-blue-600 underline">Add another</Link> to move stock between them.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="From" htmlFor="from">
                <select id="from" className={SELECT} value={from} onChange={(e) => setFrom(e.target.value)}>
                  {live.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) · {w.available.toLocaleString("en-IN")} free
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="To" htmlFor="to">
                <select id="to" className={SELECT} value={to} onChange={(e) => setTo(e.target.value)}>
                  {live
                    .filter((w) => w.id !== from)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </Field>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">In {fromName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Search by name or SKU" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search stock" />
                </div>
                <ul className={cn("divide-y rounded-lg border", isFetching && "opacity-60")}>
                  {!candidates.length ? (
                    <li className="p-4 text-sm text-slate-500">{search ? "Nothing free matches." : "Nothing free to send here."}</li>
                  ) : (
                    candidates.map((r) => (
                      <li key={r.key}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => setLines((ls) => [...ls, { row: r, qty: String(Math.min(free(r), 1)) }])}
                        >
                          {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 rounded bg-slate-100" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            <span className="block text-xs text-slate-500">{r.sku ?? "no SKU"}</span>
                          </span>
                          <span className="text-sm tabular-nums text-slate-600">{free(r)} free</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sending</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!lines.length ? (
                  <p className="text-sm text-slate-500">Pick items on the left.</p>
                ) : (
                  <ul className="divide-y">
                    {lines.map((l, i) => {
                      const over = Number(l.qty) > free(l.row);
                      return (
                        <li key={l.row.key} className="flex items-center gap-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{l.row.name}</span>
                            <span className={cn("block text-xs", over ? "text-red-600" : "text-slate-500")}>{free(l.row)} free</span>
                          </span>
                          <Input
                            type="number"
                            min={1}
                            max={free(l.row)}
                            className={cn("h-9 w-24 text-right", over && "border-red-400")}
                            value={l.qty}
                            onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                            aria-label={`Quantity of ${l.row.name}`}
                          />
                          <Button variant="ghost" size="icon" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove ${l.row.name}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Field label="Note" htmlFor="note" hint="Vehicle, driver, or why it's moving">
                  <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-3">
                  {problems.length > 0 && lines.length > 0 && <p className="text-sm text-amber-700">{problems[0]}</p>}
                  <Button onClick={submit} disabled={isLoading || problems.length > 0}>
                    <Send className="mr-1 h-4 w-4" /> Send {lines.reduce((a, l) => a + (Number(l.qty) || 0), 0)} units
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
