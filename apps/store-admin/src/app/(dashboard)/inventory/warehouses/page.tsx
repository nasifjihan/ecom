"use client";

/** Where stock is kept: add warehouses, pick the default one online orders ship from, turn one off. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftRight, Pencil, Plus, Star, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  cn,
} from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useCreateWarehouseMutation,
  useDeleteWarehouseMutation,
  useUpdateWarehouseMutation,
  useWarehousesQuery,
  type Warehouse,
} from "@/lib/features/warehouses/warehouses-api-slice";

const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function WarehouseDialog({ open, onOpenChange, warehouse }: { open: boolean; onOpenChange: (v: boolean) => void; warehouse: Warehouse | null }) {
  const [f, setF] = useState({ name: "", code: "", address: "", phone: "" });
  const [active, setActive] = useState(true);
  const [create, c] = useCreateWarehouseMutation();
  const [update, u] = useUpdateWarehouseMutation();
  useEffect(() => {
    if (!open) return;
    setF({ name: warehouse?.name ?? "", code: warehouse?.code ?? "", address: warehouse?.address ?? "", phone: warehouse?.phone ?? "" });
    setActive(warehouse?.isActive ?? true);
  }, [open, warehouse]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    try {
      if (warehouse) await update({ id: warehouse.id, ...f, isActive: active }).unwrap();
      else await create(f).unwrap();
      toast.success(warehouse ? "Warehouse saved" : "Warehouse added");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{warehouse ? "Edit warehouse" : "Add warehouse"}</DialogTitle>
          <DialogDescription>A place you keep stock: a godown, a shop, or a hub in another city.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name" htmlFor="w-name" className="col-span-2">
              <Input id="w-name" value={f.name} onChange={set("name")} placeholder="e.g. Chattogram hub" />
            </Field>
            <Field label="Code" htmlFor="w-code" hint="Short, on lists">
              <Input id="w-code" value={f.code} onChange={set("code")} placeholder="CTG" maxLength={12} className="uppercase" />
            </Field>
          </div>
          <Field label="Address" htmlFor="w-address">
            <Input id="w-address" value={f.address} onChange={set("address")} />
          </Field>
          <Field label="Phone" htmlFor="w-phone">
            <Input id="w-phone" value={f.phone} onChange={set("phone")} inputMode="tel" />
          </Field>
          {warehouse && !warehouse.isDefault && (
            <Toggle checked={active} onChange={setActive} label="In use" hint="A warehouse can be turned off once it has no stock or orders held." />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={c.isLoading || u.isLoading || f.name.trim().length < 2}>
            {warehouse ? "Save" : "Add warehouse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WarehousesPage() {
  const { data } = useWarehousesQuery();
  const { can } = useCan();
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [adding, setAdding] = useState(false);
  const [update] = useUpdateWarehouseMutation();
  const [remove] = useDeleteWarehouseMutation();
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={WarehouseIcon}
        title="Warehouses"
        description="Stock is counted per warehouse. Online orders ship from the default one, or from another warehouse that has everything the order needs."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/inventory/transfers">
                <ArrowLeftRight className="mr-1 h-4 w-4" /> Transfers
              </Link>
            </Button>
            {can("inventory.edit") && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add warehouse
              </Button>
            )}
          </>
        }
      />
      {!data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((w) => (
            <Card key={w.id} className={cn(!w.isActive && "opacity-60")}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {w.name}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{w.code}</span>
                    </p>
                    <p className="text-xs text-slate-500">{[w.address, w.phone].filter(Boolean).join(" · ") || "No address"}</p>
                  </div>
                  {w.isDefault ? (
                    <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  ) : !w.isActive ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Off</span>
                  ) : null}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["On the shelf", w.onHand.toLocaleString("en-IN")],
                    ["Held for orders", w.reserved.toLocaleString("en-IN")],
                    ["Value at cost", tk(w.valueAtCost)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                      <dt className="text-[11px] text-slate-500">{k}</dt>
                      <dd className="font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-slate-500">
                  {w.skus} products / options in stock
                  {w.incomingTransfers ? ` · ${w.incomingTransfers} transfer${w.incomingTransfers > 1 ? "s" : ""} on the way here` : ""}
                </p>
                {can("inventory.edit") && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(w)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    {!w.isDefault && w.isActive && (
                      <Button size="sm" variant="outline" onClick={() => act(() => update({ id: w.id, isDefault: true }).unwrap(), `${w.name} is now the default`)}>
                        <Star className="mr-1 h-3.5 w-3.5" /> Make default
                      </Button>
                    )}
                    {!w.isDefault && !w.onHand && !w.reserved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirm(`Delete ${w.name}? Only a warehouse that never had stock or orders can be deleted.`) && act(() => remove(w.id).unwrap(), "Warehouse deleted")}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5 text-red-600" /> Delete
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <WarehouseDialog open={adding || !!editing} onOpenChange={(v) => !v && (setAdding(false), setEditing(null))} warehouse={editing} />
    </div>
  );
}
