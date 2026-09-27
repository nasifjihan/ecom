"use client";

/**
 * Record a purchase: supplier, where it came from, the items bought (with quality grade, quantity,
 * unit cost and discounts), extra charges, and how it was paid. Saving adds the stock and sets each
 * product's cost price to the average including shipping, customs and other charges.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea, cn } from "@/components/ui";
import { Field, PageTitle } from "@/components/content/shared";
import { SELECT, SupplierDialog } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TERM_LABELS,
  tk,
  today,
  useAddGradeMutation,
  useCreatePurchaseMutation,
  useGradesQuery,
  useMoneyAccountsQuery,
  usePickProductsQuery,
  useSuppliersQuery,
  type PaymentMethod,
  type PaymentTerm,
  type PickProduct,
} from "@/lib/features/purchasing/purchasing-api-slice";

interface Line {
  key: number;
  product: PickProduct;
  variantId: string;
  grade: string;
  qty: string;
  unitCost: string;
  pct: string;
  amount: string;
}

const n = (s: string) => (s.trim() === "" ? 0 : Number(s) || 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
const lineTotal = (l: Line) => r2(Math.max(0, n(l.qty) * n(l.unitCost) * (1 - n(l.pct) / 100) - n(l.amount)));

/** Search products to buy; picking one adds a line. */
function ProductPicker({ onPick }: { onPick: (p: PickProduct) => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const { data, isFetching } = usePickProductsQuery(term, { skip: !open });
  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input
        className="pl-9"
        placeholder="Search products by name or SKU to add"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        aria-label="Add product"
      />
      {open && (
        <ul className={cn("absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border bg-white shadow-lg dark:bg-slate-900", isFetching && "opacity-70")}>
          {!data?.length ? (
            <li className="px-3 py-3 text-sm text-slate-500">{data ? "No products match." : "Loading…"}</li>
          ) : (
            data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onPick(p);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 rounded bg-slate-100" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-slate-500">
                      {p.sku ?? "no SKU"} · {p.stockQty} in stock{p.costPrice !== null ? ` · cost ${tk(p.costPrice)}` : ""}
                      {p.variants.length ? ` · ${p.variants.length} options` : ""}
                      {p.status !== "active" ? ` · ${p.status}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { data: suppliers } = useSuppliersQuery({ active: "true" });
  const { data: grades } = useGradesQuery();
  const { data: accounts } = useMoneyAccountsQuery();
  const [addGrade] = useAddGradeMutation();
  const [create, { isLoading }] = useCreatePurchaseMutation();

  const [supplierId, setSupplierId] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [sourcingType, setSourcingType] = useState<"local" | "import">("local");
  const [originCountry, setOriginCountry] = useState("");
  const [sourceFrom, setSourceFrom] = useState("");
  const [reference, setReference] = useState("");
  const [purchasedOn, setPurchasedOn] = useState(today());
  const [lines, setLines] = useState<Line[]>([]);
  const [shipping, setShipping] = useState("");
  const [customs, setCustoms] = useState("");
  const [other, setOther] = useState("");
  const [discount, setDiscount] = useState("");
  const [term, setTerm] = useState<PaymentTerm>("instant_full");
  const [payNow, setPayNow] = useState("");
  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const seq = useRef(1);

  const live = (accounts ?? []).filter((a) => a.isActive);
  useEffect(() => {
    if (!accountId && live[0]) setAccountId(live[0].id);
  }, [accountId, live]);

  const addLine = (p: PickProduct) =>
    setLines((ls) => [
      ...ls,
      {
        key: seq.current++,
        product: p,
        variantId: p.variants.length === 1 ? p.variants[0]!.id : "",
        grade: "",
        qty: "1",
        unitCost: String((p.variants.length === 1 ? p.variants[0]!.costPrice : p.costPrice) ?? ""),
        pct: "",
        amount: "",
      },
    ]);
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    const subtotal = r2(lines.reduce((s, l) => s + lineTotal(l), 0));
    const extras = r2(n(shipping) + n(customs) + n(other) - n(discount));
    const total = r2(subtotal + extras);
    const units = lines.reduce((s, l) => s + n(l.qty), 0);
    // Same sharing as the API: extras by line value, or by quantity when every line is free.
    const landed = lines.map((l) => {
      const q = n(l.qty);
      if (!q) return 0;
      const share = subtotal > 0 ? (lineTotal(l) / subtotal) * extras : units ? (q / units) * extras : 0;
      return r2((lineTotal(l) + share) / q);
    });
    return { subtotal, extras, total, landed };
  }, [lines, shipping, customs, other, discount]);

  const paidNow = term === "instant_full" ? totals.total : term === "instant_partial" ? n(payNow) : 0;
  const account = live.find((a) => a.id === accountId);
  const problems = [
    !supplierId && "Choose a supplier",
    !lines.length && "Add at least one item",
    lines.some((l) => l.product.variants.length > 0 && !l.variantId) && "Choose an option for every product that has options",
    lines.some((l) => !(n(l.qty) >= 1) || !Number.isInteger(n(l.qty))) && "Quantities must be whole numbers of 1 or more",
    lines.some((l) => n(l.qty) * n(l.unitCost) * (1 - n(l.pct) / 100) - n(l.amount) < -0.001) && "A line's discount is more than it's worth",
    totals.total < 0 && "The discount is more than the purchase",
    term === "instant_partial" && !(n(payNow) > 0 && n(payNow) < totals.total) && "Part payment must be above 0 and less than the total",
    paidNow > 0 && !accountId && "Choose the account the money comes from",
    paidNow > 0 && account && paidNow > account.balance && `${account.name} only has ${tk(account.balance)}`,
  ].filter(Boolean) as string[];

  const save = async () => {
    try {
      const p = await create({
        supplierId,
        sourcingType,
        originCountry: sourcingType === "import" ? originCountry : undefined,
        sourceFrom,
        reference,
        purchasedOn,
        shippingCost: n(shipping),
        customsDuty: n(customs),
        otherCharges: n(other),
        discount: n(discount),
        items: lines.map((l) => ({
          productId: l.product.id,
          variantId: l.variantId || null,
          qualityGrade: l.grade || undefined,
          qty: n(l.qty),
          unitCost: n(l.unitCost),
          discountPct: n(l.pct),
          discountAmount: n(l.amount),
        })),
        paymentTerm: term,
        payNow: term === "instant_partial" ? n(payNow) : undefined,
        accountId: paidNow > 0 ? accountId : null,
        paymentMethod: method,
        notes,
      }).unwrap();
      toast.success(`${p.number} recorded and stock added`);
      router.push(`/purchasing/purchases/${p.id}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ShoppingBag}
        title="Record purchase"
        description="Stock you bought. Saving adds it to stock and updates the cost price."
        actions={
          <Button variant="outline" asChild>
            <Link href="/purchasing/purchases">
              <ArrowLeft className="mr-1 h-4 w-4" /> Purchases
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier and source</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Supplier" htmlFor="supplier" className="sm:col-span-2">
            <div className="flex gap-2">
              <select id="supplier" className={SELECT} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choose…</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={() => setAddingSupplier(true)} aria-label="Add supplier">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Field>
          <Field label="Date bought" htmlFor="date">
            <Input id="date" type="date" value={purchasedOn} max={today()} onChange={(e) => setPurchasedOn(e.target.value)} />
          </Field>
          <Field label="Invoice / reference" htmlFor="ref">
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Supplier's invoice no." />
          </Field>
          <Field label="Sourcing" htmlFor="sourcing">
            <select id="sourcing" className={SELECT} value={sourcingType} onChange={(e) => setSourcingType(e.target.value as "local" | "import")}>
              <option value="local">Local</option>
              <option value="import">Import</option>
            </select>
          </Field>
          {sourcingType === "import" && (
            <Field label="Country of origin" htmlFor="origin">
              <Input id="origin" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="e.g. China" />
            </Field>
          )}
          <Field label="Bought from" htmlFor="from" hint="Market, wholesaler or website">
            <Input id="from" value={sourceFrom} onChange={(e) => setSourceFrom(e.target.value)} placeholder="e.g. Islampur, Dhaka" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProductPicker onPick={addLine} />
          {lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-2 font-medium">Product</th>
                    <th className="px-2 font-medium">Grade</th>
                    <th className="w-20 px-2 font-medium">Qty</th>
                    <th className="w-28 px-2 font-medium">Unit cost ৳</th>
                    <th className="w-20 px-2 font-medium">Disc %</th>
                    <th className="w-24 px-2 font-medium">Disc ৳</th>
                    <th className="px-2 text-right font-medium">Line total</th>
                    <th className="px-2 text-right font-medium" title="Unit cost including its share of shipping, customs and other charges">
                      Landed / unit
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.key} className="border-b align-top last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{l.product.name}</p>
                        {l.product.variants.length > 0 ? (
                          <select
                            className={cn(SELECT, "mt-1 h-8 py-1", !l.variantId && "border-amber-400")}
                            value={l.variantId}
                            aria-label={`Option for ${l.product.name}`}
                            onChange={(e) => {
                              const v = l.product.variants.find((x) => x.id === e.target.value);
                              setLine(l.key, { variantId: e.target.value, ...(v?.costPrice != null && !l.unitCost ? { unitCost: String(v.costPrice) } : {}) });
                            }}
                          >
                            <option value="">Choose option…</option>
                            {l.product.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label} ({v.stockQty} in stock)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-slate-500">{l.product.stockQty} in stock</p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={cn(SELECT, "h-9 py-1")}
                          value={l.grade}
                          aria-label="Quality grade"
                          onChange={async (e) => {
                            if (e.target.value !== "__new") return setLine(l.key, { grade: e.target.value });
                            const name = prompt("New quality grade")?.trim();
                            if (!name) return;
                            try {
                              await addGrade(name).unwrap();
                              setLine(l.key, { grade: name });
                            } catch (err) {
                              toast.error(errorText(err));
                            }
                          }}
                        >
                          <option value="">—</option>
                          {(grades ?? []).map((g) => (
                            <option key={g.id} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                          <option value="__new">+ Add grade…</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-9" type="number" min="1" step="1" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} aria-label="Quantity" />
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-9" type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} aria-label="Unit cost" />
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-9" type="number" min="0" max="100" step="0.01" value={l.pct} onChange={(e) => setLine(l.key, { pct: e.target.value })} aria-label="Discount percent" />
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-9" type="number" min="0" step="0.01" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} aria-label="Discount amount" />
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{tk(lineTotal(l))}</td>
                      <td className="px-2 py-2 text-right text-slate-600">{tk(totals.landed[i] ?? 0)}</td>
                      <td className="py-2">
                        <Button variant="ghost" size="icon" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.product.name}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Shipping / transport ৳" htmlFor="ship">
                <Input id="ship" type="number" min="0" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} />
              </Field>
              <Field label="Customs duty ৳" htmlFor="customs">
                <Input id="customs" type="number" min="0" step="0.01" value={customs} onChange={(e) => setCustoms(e.target.value)} />
              </Field>
              <Field label="Other charges ৳" htmlFor="other" hint="Labour, packing, commission">
                <Input id="other" type="number" min="0" step="0.01" value={other} onChange={(e) => setOther(e.target.value)} />
              </Field>
              <Field label="Discount on the whole purchase ৳" htmlFor="disc">
                <Input id="disc" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
            </div>
            <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <div className="flex justify-between">
                <dt>Items</dt>
                <dd>{tk(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Charges less discount</dt>
                <dd>{tk(totals.extras)}</dd>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd>{tk(totals.total)}</dd>
              </div>
              <p className="pt-1 text-xs text-slate-500">Charges are shared over the items by value, so each item&apos;s cost price includes them.</p>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="How was it paid?" htmlFor="term">
              <select id="term" className={SELECT} value={term} onChange={(e) => setTerm(e.target.value as PaymentTerm)}>
                {Object.entries(PAYMENT_TERM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {term === "instant_partial" && (
              <Field label="Paid now ৳" htmlFor="paynow" hint={n(payNow) > 0 ? `${tk(r2(totals.total - n(payNow)))} left on credit` : undefined}>
                <Input id="paynow" type="number" min="0" step="0.01" value={payNow} onChange={(e) => setPayNow(e.target.value)} />
              </Field>
            )}
            {(term === "instant_full" || term === "instant_partial") &&
              (live.length ? (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="From account" htmlFor="acct">
                    <select id="acct" className={SELECT} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      {live.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({tk(a.balance)})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Method" htmlFor="method">
                    <select id="method" className={SELECT} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  No money account yet. <Link href="/purchasing/accounts" className="underline">Add one</Link>, or record this on credit and pay later.
                </p>
              ))}
            {term === "credit" && <p className="text-sm text-slate-600">The total is added to what you owe this supplier. Pay it later from Suppliers or Payments.</p>}
            {term === "advance" && <p className="text-sm text-slate-600">Nothing is paid now. Use this when you already recorded an advance payment to the supplier.</p>}
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {problems.length > 0 && lines.length > 0 && <p className="text-sm text-amber-700">{problems[0]}</p>}
        <Button variant="outline" onClick={() => setLines([])} disabled={!lines.length}>
          <Trash2 className="mr-1 h-4 w-4" /> Clear items
        </Button>
        <Button onClick={save} disabled={isLoading || problems.length > 0}>
          Save purchase · {tk(totals.total)}
        </Button>
      </div>

      <SupplierDialog open={addingSupplier} onOpenChange={setAddingSupplier} onSaved={setSupplierId} />
    </div>
  );
}
