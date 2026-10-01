"use client";

/**
 * Storefronts: several shop fronts from one store. Each has its own web addresses, look, homepage,
 * menus, product range and prices; stock, customers and orders are shared.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Globe, Home, ListTree, Palette, Pencil, Plus, Star, Store, Trash2 } from "lucide-react";
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
import { Field, PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { usePaymentMethodsQuery } from "@/lib/features/operations/payments-api-slice";
import { useCourierAccountsQuery } from "@/lib/features/operations/couriers-api-slice";
import {
  storefrontUrl,
  useAddStorefrontDomainMutation,
  useCreateStorefrontMutation,
  useDeleteStorefrontMutation,
  useMakeDefaultStorefrontMutation,
  useMoveStorefrontDomainMutation,
  useStorefrontsQuery,
  useUpdateStorefrontMutation,
  type Storefront,
} from "@/lib/features/storefronts/storefronts-api-slice";

function StorefrontDialog({ open, onOpenChange, storefront }: { open: boolean; onOpenChange: (v: boolean) => void; storefront: Storefront | null }) {
  const [f, setF] = useState({ name: "", code: "", priceAdjustPercent: "0" });
  const [active, setActive] = useState(true);
  const [includeNew, setIncludeNew] = useState(true);
  const [gateways, setGateways] = useState<string[]>([]);
  const [courier, setCourier] = useState("");
  const [choice, setChoice] = useState<string[]>([]);
  const { data: methods = [] } = usePaymentMethodsQuery();
  const { data: couriers = [] } = useCourierAccountsQuery();
  const [create, c] = useCreateStorefrontMutation();
  const [update, u] = useUpdateStorefrontMutation();
  useEffect(() => {
    if (!open) return;
    setF({ name: storefront?.name ?? "", code: storefront?.code ?? "", priceAdjustPercent: String(storefront?.priceAdjustPercent ?? 0) });
    setActive(storefront?.isActive ?? true);
    setIncludeNew(storefront?.includeNewProducts ?? true);
    setGateways(storefront?.paymentGateways ?? []);
    setCourier(storefront?.courierAccountId ?? "");
    setChoice(storefront?.checkoutCourierIds ?? []);
  }, [open, storefront]);
  const pct = Number(f.priceAdjustPercent);
  const pctOk = f.priceAdjustPercent.trim() !== "" && Number.isFinite(pct) && pct >= -90 && pct <= 500;
  const save = async () => {
    const body = {
      name: f.name.trim(),
      code: f.code.trim() || undefined,
      priceAdjustPercent: pct,
      includeNewProducts: includeNew,
      paymentGateways: gateways,
      courierAccountId: courier || null,
      checkoutCourierIds: choice,
    };
    try {
      if (storefront) await update({ id: storefront.id, ...body, ...(storefront.isDefault ? {} : { isActive: active }) }).unwrap();
      else await create(body).unwrap();
      toast.success(storefront ? "Storefront saved" : "Storefront added", {
        description: storefront ? undefined : "Give it a web address, then its own look, homepage and menus if you like.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{storefront ? "Edit storefront" : "Add storefront"}</DialogTitle>
          <DialogDescription>Another shop front for the same stock and orders, e.g. a kids&apos; shop or a wholesale site.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name" htmlFor="sf-name" className="col-span-2">
              <Input id="sf-name" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Kids Corner" />
            </Field>
            <Field label="Code" htmlFor="sf-code" hint="Short, on orders">
              <Input
                id="sf-code"
                value={f.code}
                onChange={(e) => setF((p) => ({ ...p, code: e.target.value }))}
                placeholder="KIDS"
                maxLength={12}
                className="uppercase"
              />
            </Field>
          </div>
          <Field
            label="Price change (%)"
            htmlFor="sf-pct"
            hint="Added to every price here: 10 makes ৳1,000 show as ৳1,100, -5 as ৳950. Products with their own price here ignore it."
            error={pctOk ? undefined : "Between -90 and 500"}
          >
            <Input
              id="sf-pct"
              inputMode="decimal"
              value={f.priceAdjustPercent}
              onChange={(e) => setF((p) => ({ ...p, priceAdjustPercent: e.target.value }))}
              className="max-w-[8rem]"
            />
          </Field>
          {!storefront?.isDefault && (
            <Toggle
              checked={includeNew}
              onChange={setIncludeNew}
              label="Sell every product here"
              hint="Off: only products you add to this storefront (in each product's Storefronts box) are sold here."
            />
          )}
          {methods.some((m) => m.enabled) && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Payment methods</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {methods
                  .filter((m) => m.enabled)
                  .map((m) => (
                    <label key={m.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={gateways.includes(m.code)}
                        onChange={(e) => setGateways((g) => (e.target.checked ? [...g, m.code] : g.filter((x) => x !== m.code)))}
                      />
                      {m.name}
                    </label>
                  ))}
              </div>
              <p className="text-xs text-slate-500">
                {gateways.length ? "Shoppers here can pay with the ticked methods only." : "Every method switched on in Payment settings (none ticked)."}
              </p>
            </fieldset>
          )}
          {couriers.length > 0 && (
            <Field label="Courier" htmlFor="sf-courier" hint="Picked first when booking this storefront's parcels, and used by “Each storefront's courier” in bulk booking.">
              <select
                id="sf-courier"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None</option>
                {couriers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.courierName})
                  </option>
                ))}
              </select>
            </Field>
          )}
          {couriers.filter((a) => a.enabled).length > 1 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Customers choose the courier at checkout</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {couriers
                  .filter((a) => a.enabled)
                  .map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={choice.includes(a.id)}
                        onChange={(e) => setChoice((c) => (e.target.checked ? [...c, a.id] : c.filter((x) => x !== a.id)))}
                      />
                      {a.label} ({a.courierName})
                    </label>
                  ))}
              </div>
              <p className="text-xs text-slate-500">
                {choice.length ? "Checkout lists the ticked couriers; the order is booked with the one picked." : "None ticked: customers don't choose, and parcels go with the courier above."}
              </p>
            </fieldset>
          )}
          {storefront && !storefront.isDefault && (
            <Toggle checked={active} onChange={setActive} label="Open" hint="A closed storefront's web addresses open the default storefront." />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={c.isLoading || u.isLoading || f.name.trim().length < 2 || !pctOk}>
            {storefront ? "Save" : "Add storefront"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddressForm({ storefront }: { storefront: Storefront }) {
  const [hostname, setHostname] = useState("");
  const [add, { isLoading }] = useAddStorefrontDomainMutation();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await add({ id: storefront.id, hostname }).unwrap();
      toast.success(`${r.hostname} added`, { description: "Point it at your store in your domain's DNS settings." });
      setHostname("");
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        aria-label={`New web address for ${storefront.name}`}
        value={hostname}
        onChange={(e) => setHostname(e.target.value)}
        placeholder="kids.yourshop.com"
        className="h-8 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={isLoading || hostname.trim().length < 3}>
        Add
      </Button>
    </form>
  );
}

export default function StorefrontsPage() {
  const { data } = useStorefrontsQuery();
  const { can } = useCan();
  const edit = can("online_store.edit");
  const [editing, setEditing] = useState<Storefront | null>(null);
  const [adding, setAdding] = useState(false);
  const [makeDefault] = useMakeDefaultStorefrontMutation();
  const [remove] = useDeleteStorefrontMutation();
  const [move] = useMoveStorefrontDomainMutation();
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const several = (data?.length ?? 0) > 1;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Store}
        title="Storefronts"
        description="Run more than one shop front from this store. Each has its own web address, look, homepage, menus, products and prices. Stock, customers and orders are shared."
        actions={
          edit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add storefront
            </Button>
          )
        }
      />
      {!data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((s) => {
            const q = s.isDefault ? "" : `?storefront=${s.id}`;
            return (
              <Card key={s.id} className={cn(!s.isActive && "opacity-70")}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        {s.name}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s.code}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.priceAdjustPercent ? `Prices ${s.priceAdjustPercent > 0 ? "+" : ""}${s.priceAdjustPercent}%` : "Standard prices"}
                        {s.ownPrices ? ` · ${s.ownPrices} product${s.ownPrices > 1 ? "s" : ""} with own price` : ""}
                        {" · "}
                        {s.includeNewProducts
                          ? s.hiddenProducts
                            ? `All products but ${s.hiddenProducts}`
                            : "All products"
                          : `${s.addedProducts} product${s.addedProducts === 1 ? "" : "s"} added`}
                      </p>
                      {s.paymentGateways.length > 0 && <p className="text-xs text-slate-500">Payment: {s.paymentGateways.join(", ")}</p>}
                    </div>
                    {s.isDefault ? (
                      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    ) : !s.isActive ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Closed</span>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <Globe className="h-3.5 w-3.5" /> Web addresses
                    </p>
                    {s.domains.length === 0 ? (
                      <p className="text-sm text-slate-500">None yet: add the address shoppers will open.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {s.domains.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-mono">{d.hostname}</span>
                            {edit && several && (
                              <select
                                aria-label={`Storefront for ${d.hostname}`}
                                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                                value={s.id}
                                onChange={(e) =>
                                  act(() => move({ domainId: d.id, storefrontId: e.target.value }).unwrap(), `${d.hostname} now opens ${data.find((x) => x.id === e.target.value)?.name}`)
                                }
                              >
                                {data.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    Opens {x.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {edit && <AddressForm storefront={s} />}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/online-store/theme${q}`}>
                        <Palette className="mr-1 h-3.5 w-3.5" /> Look{!s.isDefault && !s.ownTheme ? " (default)" : ""}
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/online-store/homepage${q}`}>
                        <Home className="mr-1 h-3.5 w-3.5" /> Homepage{!s.isDefault && !s.ownHomepage ? " (default)" : ""}
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/online-store/menus${q}`}>
                        <ListTree className="mr-1 h-3.5 w-3.5" /> Menus{!s.isDefault && !s.ownMenus ? " (default)" : ""}
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={storefrontUrl(s, STOREFRONT_URL)} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
                      </a>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/orders?storefrontId=${s.id}`} className="text-sm text-blue-600 hover:underline">
                      {s.orders.toLocaleString("en-IN")} order{s.orders === 1 ? "" : "s"}
                    </Link>
                    <span className="flex-1" />
                    {edit && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {edit && !s.isDefault && s.isActive && (
                      <Button size="sm" variant="outline" onClick={() => act(() => makeDefault(s.id).unwrap(), `${s.name} is now the default`)}>
                        <Star className="mr-1 h-3.5 w-3.5" /> Make default
                      </Button>
                    )}
                    {edit && !s.isDefault && s.orders === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirm(`Delete ${s.name}? Its web addresses will open the default storefront.`) && act(() => remove(s.id).unwrap(), "Storefront deleted")}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5 text-red-600" /> Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {data?.length === 1 && (
        <p className="text-sm text-slate-500">
          With one storefront nothing changes for your shoppers. Add a second one to sell under another name, to a different audience or at different prices.
        </p>
      )}
      <StorefrontDialog open={adding || !!editing} onOpenChange={(v) => !v && (setAdding(false), setEditing(null))} storefront={editing} />
    </div>
  );
}
