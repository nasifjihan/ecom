"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Globe2, Plus, Star, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import {
  apiErrorMessage,
  formatDate,
  useCreateDomainMutation,
  useDeleteDomainMutation,
  useGetDomainsQuery,
  useGetStoresQuery,
  useUpdateDomainMutation,
  type StoreDomain,
} from "@/lib/features/platform/platform-api-slice";
import { EmptyRow } from "./shared";

/**
 * Domains decide which store a request belongs to (the API resolves the tenant from the Origin host),
 * so hostnames include the port in local development, e.g. localhost:3000.
 */
export function DomainsTable({ storeId, openNew = false, onNewClosed }: { storeId?: string; openNew?: boolean; onNewClosed?: () => void }) {
  const { data: domains = [], isLoading } = useGetDomainsQuery(storeId ? { storeId } : undefined);
  const [updateDomain] = useUpdateDomainMutation();
  const [deleteDomain] = useDeleteDomainMutation();
  const [adding, setAdding] = useState(openNew);
  useEffect(() => setAdding(openNew), [openNew]);

  const showStore = !storeId;
  const cols = showStore ? 7 : 6;

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (err) {
      toast.error("Couldn't update the domain", { description: apiErrorMessage(err) });
    }
  };

  const remove = (d: StoreDomain) => {
    if (!window.confirm(`Remove ${d.hostname}? Requests from it will no longer reach ${d.store?.name ?? "this store"}.`)) return;
    void run(deleteDomain(d.id!).unwrap(), `Removed ${d.hostname}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Domains</CardTitle>
          <CardDescription>Hostnames that route to {storeId ? "this store" : "each store"}. The primary storefront domain is used in links.</CardDescription>
        </div>
        <Button size="sm" className="bg-rose-600 hover:bg-rose-500 text-white" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add domain
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead>Hostname</TableHead>
                {showStore && <TableHead>Store</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead>SSL</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={cols}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ) : domains.length === 0 ? (
                <EmptyRow colSpan={cols} icon={Globe2} title="No domains yet" hint="Add a storefront domain so customers can reach the store." />
              ) : (
                domains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium font-mono text-sm">{d.hostname}</TableCell>
                    {showStore && (
                      <TableCell>
                        {d.store ? (
                          <Link href={`/stores/${d.storeId}`} className="text-sm hover:text-rose-600">
                            {d.store.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={d.type === "storefront" ? "info" : "secondary"} className="border-0 capitalize">
                        {d.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {d.primary ? (
                        <Badge variant="success" className="border-0">
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => run(updateDomain({ id: d.id!, primary: true }).unwrap(), `${d.hostname} is now primary`)}>
                          Make primary
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!d.sslEnabled}
                        onCheckedChange={(v) => run(updateDomain({ id: d.id!, sslEnabled: v }).unwrap(), `SSL ${v ? "on" : "off"} for ${d.hostname}`)}
                        aria-label={`SSL for ${d.hostname}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(d.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => remove(d)} aria-label={`Remove ${d.hostname}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <AddDomainDialog
        open={adding}
        storeId={storeId}
        onOpenChange={(o) => {
          setAdding(o);
          if (!o) onNewClosed?.();
        }}
      />
    </Card>
  );
}

function AddDomainDialog({ open, storeId, onOpenChange }: { open: boolean; storeId?: string; onOpenChange: (o: boolean) => void }) {
  const { data: stores } = useGetStoresQuery({ perPage: 100 }, { skip: !!storeId || !open });
  const [createDomain, { isLoading }] = useCreateDomainMutation();
  const [target, setTarget] = useState(storeId ?? "");
  const [hostname, setHostname] = useState("");
  const [type, setType] = useState<"storefront" | "admin">("storefront");
  const [primary, setPrimary] = useState(false);

  useEffect(() => {
    if (!open) {
      setHostname("");
      setType("storefront");
      setPrimary(false);
      setTarget(storeId ?? "");
    }
  }, [open, storeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) {
      toast.error("Pick a store");
      return;
    }
    try {
      await createDomain({ storeId: target, hostname: hostname.trim().toLowerCase(), type, primary }).unwrap();
      toast.success(`Added ${hostname.trim().toLowerCase()}`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't add the domain", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add domain</DialogTitle>
            <DialogDescription>Use the bare host, with the port for local development (shop.example.com or localhost:3005).</DialogDescription>
          </DialogHeader>
          {!storeId && (
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectItem value="">Select a store...</SelectItem>
                {(stores?.items ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="hostname">Hostname</Label>
            <Input
              id="hostname"
              value={hostname}
              required
              minLength={3}
              pattern="[A-Za-z0-9.\-]+(:[0-9]{1,5})?"
              placeholder="shop.example.com"
              onChange={(e) => setHostname(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "storefront" | "admin")}>
                <SelectItem value="storefront">Storefront</SelectItem>
                <SelectItem value="admin">Store admin</SelectItem>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm h-10">
              <Switch checked={primary} onCheckedChange={setPrimary} />
              Make primary
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Adding..." : "Add domain"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
