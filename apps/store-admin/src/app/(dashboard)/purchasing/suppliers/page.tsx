"use client";

/** Suppliers with what the shop owes each; open one for its purchases and payments, pay, or edit. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Factory, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { Balance, PayDialog, StatusPill, SupplierDialog } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  PAYMENT_METHOD_LABELS,
  shortDate,
  tk,
  useDeleteSupplierMutation,
  useSupplierQuery,
  useSuppliersQuery,
  type Supplier,
} from "@/lib/features/purchasing/purchasing-api-slice";

function Statement({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useSupplierQuery(id);
  const { can } = useCan();
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [remove] = useDeleteSupplierMutation();
  if (!data) return <Skeleton className="h-48" />;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{data.name}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            {[data.contactPerson, data.contactPhone, data.contactEmail, data.address].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("purchasing.create") && (
            <Button size="sm" onClick={() => setPaying(true)}>
              <Wallet className="mr-1 h-4 w-4" /> Pay
            </Button>
          )}
          {can("purchasing.edit") && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
          )}
          {can("purchasing.delete") && data.purchases === 0 && data.paymentList.length === 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm(`Delete ${data.name}?`)) return;
                try {
                  await remove(data.id).unwrap();
                  toast.success("Supplier deleted");
                  onClose();
                } catch (e) {
                  toast.error(errorText(e));
                }
              }}
            >
              <Trash2 className="mr-1 h-4 w-4 text-red-600" /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Opening balance", tk(data.openingBalance)],
            ["Bought", tk(data.purchased)],
            ["Paid", tk(data.paid)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border p-3">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-lg font-semibold">{v}</p>
            </div>
          ))}
          <div className="rounded-lg border p-3">
            <p className="text-xs text-slate-500">Balance</p>
            <Balance value={data.balance} className="text-lg" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Purchases</h3>
            {data.purchaseList.length === 0 ? (
              <p className="text-sm text-slate-500">None yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.purchaseList.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Link href={`/purchasing/purchases/${p.id}`} className="font-medium text-blue-600 hover:underline">
                      {p.number}
                    </Link>
                    <span className="text-slate-500">{shortDate(p.purchasedOn)}</span>
                    <StatusPill status={p.status} />
                    <span className={cn("font-medium", p.status === "cancelled" && "text-slate-400 line-through")}>{tk(p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Payments</h3>
            {data.paymentList.length === 0 ? (
              <p className="text-sm text-slate-500">None yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.paymentList.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-slate-500">{shortDate(p.paidOn)}</span>
                    <span className="truncate">
                      {PAYMENT_METHOD_LABELS[p.method]} from {p.account}
                      {p.purchaseNumber ? ` · ${p.purchaseNumber}` : ""}
                    </span>
                    <span className="font-medium">{tk(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
      <PayDialog open={paying} onOpenChange={setPaying} supplierId={data.id} supplierName={data.name} suggested={data.balance} />
      <SupplierDialog open={editing} onOpenChange={setEditing} supplier={data} />
    </Card>
  );
}

export default function SuppliersPage() {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const { data, isFetching } = useSuppliersQuery({ search });
  const { can } = useCan();
  const owed = (data ?? []).reduce((s, x: Supplier) => s + Math.max(0, x.balance), 0);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Factory}
        title="Suppliers"
        description={data ? `You owe suppliers ${tk(owed)} in total.` : "Who you buy stock from and what you owe them."}
        actions={
          can("purchasing.create") && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add supplier
            </Button>
          )
        }
      />
      {open && <Statement key={open} id={open} onClose={() => setOpen(null)} />}
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder="Name, person or phone" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search suppliers" />
      </div>
      <Card>
        <CardContent className={cn("p-0", isFetching && "opacity-60")}>
          {!data ? (
            <Skeleton className="m-4 h-24" />
          ) : !data.length ? (
            <p className="p-10 text-center text-sm text-slate-500">{search ? "No suppliers match." : "No suppliers yet. Add the people you buy stock from."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead className="text-right">Bought</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id} className={cn("cursor-pointer", open === s.id && "bg-blue-50 dark:bg-slate-800")} onClick={() => setOpen(s.id)}>
                    <TableCell className="font-medium">
                      <button type="button" className="text-left hover:underline" onClick={() => setOpen(s.id)}>
                        {s.name}
                      </button>
                      {!s.isActive && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">off</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{[s.contactPerson, s.contactPhone].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-right">{s.purchases}</TableCell>
                    <TableCell className="text-right">{tk(s.purchased)}</TableCell>
                    <TableCell className="text-right">{tk(s.paid)}</TableCell>
                    <TableCell className="text-right">
                      <Balance value={s.balance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <SupplierDialog open={adding} onOpenChange={setAdding} onSaved={setOpen} />
    </div>
  );
}
