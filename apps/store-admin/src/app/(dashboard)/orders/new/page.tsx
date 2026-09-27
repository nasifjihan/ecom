"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Minus, PackagePlus, Plus, Search, ShoppingBag, Trash2, User, X } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, cn } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { AreaSelects, type AreaValue } from "@/components/orders/area-selects";
import { useCan } from "@/lib/permissions";
import { errorText } from "@/lib/features/content/content-api-slice";
import { ORDER_SOURCES, type OrderSource } from "@/lib/features/operations/operations-api-slice";
import {
  useCreateManualOrderMutation,
  usePickCustomersQuery,
  usePickProductsQuery,
  usePickVariantsQuery,
  useQuoteManualOrderMutation,
  useOrderAreasQuery,
  type ManualOrderInput,
  type ManualOrderQuote,
  type PickCustomer,
  type PickProduct,
} from "@/lib/features/operations/manual-order-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const taka = (n: number | null | undefined) =>
  `৳${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Line = { key: string; productId: string; variantId: string | null; name: string; variantLabel?: string; qty: number };

// ------------------------------------------------------------------ pickers

function CustomerPicker({ onPick }: { onPick: (c: PickCustomer) => void }) {
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePickCustomersQuery(search, { skip: search.length < 2 });
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input className="pl-9" placeholder="Find a customer by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find customer" />
      {search.length >= 2 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg dark:bg-slate-900">
          {data.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No customer found — fill in the details below."}</li>
          ) : (
            data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onPick(c);
                    setQ("");
                  }}
                >
                  <span>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-slate-500">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-xs text-slate-400">{c.orderCount} orders</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function VariantChooser({ product, onPick, onCancel }: { product: PickProduct; onPick: (id: string, label: string) => void; onCancel: () => void }) {
  const { data = [], isLoading } = usePickVariantsQuery(product.id);
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Choose an option of {product.name}</p>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.map((v) => {
            const out = v.manageStock && (v.stockQty ?? 0) <= 0;
            return (
              <Button key={v.id} type="button" variant="outline" size="sm" disabled={out} onClick={() => onPick(v.id, v.label)}>
                {v.label} · {taka(v.price)}
                <span className="ml-1 text-xs text-slate-400">{out ? "out of stock" : v.manageStock ? `${v.stockQty} left` : ""}</span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductPicker({ onAdd }: { onAdd: (p: PickProduct, variant?: { id: string; label: string }) => void }) {
  const [q, setQ] = useState("");
  const [choosing, setChoosing] = useState<PickProduct | null>(null);
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePickProductsQuery(search, { skip: search.length < 2 });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search products by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        {search.length >= 2 && !choosing && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg dark:bg-slate-900">
            {data.length === 0 ? (
              <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No published product matches."}</li>
            ) : (
              data.map((p) => {
                const out = p.variantCount === 0 && p.manageStock && (p.stockQty ?? 0) <= 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={out}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        if (p.variantCount > 0) setChoosing(p);
                        else {
                          onAdd(p);
                          setQ("");
                        }
                      }}
                    >
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <ShoppingBag className="h-9 w-9 p-2 text-slate-400" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="text-xs text-slate-500">
                          {p.sku} · {p.variantCount > 0 ? `${p.variantCount} options` : out ? "Out of stock" : p.manageStock ? `${p.stockQty} in stock` : "In stock"}
                        </span>
                      </span>
                      <span>{taka(p.price)}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
      {choosing && (
        <VariantChooser
          product={choosing}
          onCancel={() => setChoosing(null)}
          onPick={(id, label) => {
            onAdd(choosing, { id, label });
            setChoosing(null);
            setQ("");
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ page

export default function NewOrderPage() {
  const router = useRouter();
  const { can } = useCan();
  const [quote, { isLoading: quoting }] = useQuoteManualOrderMutation();
  const [create, { isLoading: creating }] = useCreateManualOrderMutation();
  const [result, setResult] = useState<ManualOrderQuote | null>(null);
  const { data: areas = [], isLoading: areasLoading } = useOrderAreasQuery();

  const [customer, setCustomer] = useState<PickCustomer | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [area, setArea] = useState<AreaValue>({ divisionId: "", districtId: "", upazilaId: "" });
  const [locationId, setLocationId] = useState<string | null>(null);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [deliveryType, setDeliveryType] = useState<"method" | "custom" | "pickup">("method");
  const [methodId, setMethodId] = useState("");
  const [customFee, setCustomFee] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [coupon, setCoupon] = useState("");
  const [applyPromotions, setApplyPromotions] = useState(true);
  const [gateway, setGateway] = useState("cod");
  const [paid, setPaid] = useState(false);
  const [trx, setTrx] = useState("");
  const [source, setSource] = useState<OrderSource>("phone");
  const [confirmed, setConfirmed] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [notify, setNotify] = useState(true);

  const body: ManualOrderInput = useMemo(
    () => ({
      customer: customer ? { id: customer.id } : { firstName: first.trim(), lastName: last.trim(), phone: phone.trim(), email: email.trim() },
      items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
      address: {
        firstName: customer ? undefined : first.trim(),
        lastName: customer ? undefined : last.trim(),
        phone: phone.trim() || customer?.phone || undefined,
        locationId,
        addressLine1: address1.trim(),
        addressLine2: address2.trim(),
      },
      delivery:
        deliveryType === "pickup"
          ? { type: "pickup" }
          : deliveryType === "custom"
            ? { type: "custom", fee: Number(customFee) || 0, name: "Delivery" }
            : methodId
              ? { type: "method", methodId }
              : { type: "pickup" },
      couponCode: coupon.trim() || undefined,
      applyPromotions,
      discount: Number(discountValue) > 0 ? { type: discountType, value: Number(discountValue) } : null,
      paymentGateway: gateway,
      paid,
      transactionId: trx.trim() || undefined,
      source,
      status: confirmed ? "PROCESSING" : "PENDING",
      customerNote: customerNote.trim() || undefined,
      staffNote: staffNote.trim() || undefined,
      notifyCustomer: notify,
    }),
    [customer, first, last, phone, email, lines, locationId, address1, address2, deliveryType, methodId, customFee, coupon, applyPromotions, discountType, discountValue, gateway, paid, trx, source, confirmed, customerNote, staffNote, notify],
  );

  // Re-price whenever the order changes (debounced); the server is the only source of prices.
  const pricing = useDebounced(body, 350);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    quote(pricing)
      .unwrap()
      .then((r) => n === seq.current && setResult(r))
      .catch(() => void 0);
  }, [pricing, quote]);

  // Keep the chosen delivery method valid for the address; default to the cheapest.
  const options = result?.shippingOptions ?? [];
  useEffect(() => {
    if (deliveryType !== "method") return;
    if (!options.length) {
      if (methodId) setMethodId("");
      return;
    }
    if (!options.some((o) => o.id === methodId)) setMethodId(options[0]!.id);
  }, [options, methodId, deliveryType]);

  const addLine = (p: PickProduct, v?: { id: string; label: string }) => {
    setLines((ls) => {
      const hit = ls.find((l) => l.productId === p.id && l.variantId === (v?.id ?? null));
      if (hit) return ls.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: `${p.id}:${v?.id ?? ""}`, productId: p.id, variantId: v?.id ?? null, name: p.name, variantLabel: v?.label, qty: 1 }];
    });
  };
  const setQty = (key: string, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty } : l))));

  const t = result?.totals;
  const capAmount = t ? Math.round(((t.itemsSubtotal * (result?.discountCapPct ?? 0)) / 100) * 100) / 100 : 0;
  const lineInfo = (l: Line) => result?.lines.find((x) => x.productId === l.productId && (x.variantId ?? null) === l.variantId);
  const matched = !customer && result?.customer;
  const needsAddress = deliveryType !== "pickup";
  const ready =
    lines.length > 0 &&
    (customer || ((phone.trim() || email.trim()) && first.trim())) &&
    (!needsAddress || (locationId && address1.trim().length >= 3)) &&
    (deliveryType !== "method" || methodId) &&
    (!paid || gateway === "cod" || trx.trim()) &&
    !(result?.problems.length);

  const submit = async () => {
    try {
      const r = await create(body).unwrap();
      toast.success(`Order ${r.number} created`);
      // Staff who can take orders but not open them start a fresh form instead.
      if (can("orders.view")) router.push(`/orders/${r.id}`);
      else window.location.reload();
    } catch (err) {
      toast.error(errorText(err, "Couldn't create the order."));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={PackagePlus}
        title="New order"
        description="Enter an order a customer placed by phone, Facebook, WhatsApp or in the shop. Prices, stock and coupons work as on the website."
        actions={
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" /> All orders
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-slate-500">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"} · {customer.orderCount} orders</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <CustomerPicker
                    onPick={(c) => {
                      setCustomer(c);
                      if (c.phone) setPhone(c.phone);
                    }}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name" htmlFor="c-first">
                      <Input id="c-first" value={first} onChange={(e) => setFirst(e.target.value)} />
                    </Field>
                    <Field label="Last name (optional)" htmlFor="c-last">
                      <Input id="c-last" value={last} onChange={(e) => setLast(e.target.value)} />
                    </Field>
                    <Field label="Phone" htmlFor="c-phone" hint="Used to find this customer next time.">
                      <Input id="c-phone" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </Field>
                    <Field label="Email (optional)" htmlFor="c-email" hint="Needed for order emails.">
                      <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                  </div>
                  {matched && (
                    <p className="rounded-md bg-blue-50 p-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                      This matches {result!.customer!.name} ({result!.customer!.orderCount} orders); the order will be added to their account.{" "}
                      <button
                        type="button"
                        className="font-medium underline"
                        onClick={() => setCustomer({ ...result!.customer!, phone: result!.customer!.phone, email: result!.customer!.email })}
                      >
                        Use this customer
                      </button>
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4" /> Products
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProductPicker onAdd={addLine} />
              {lines.length === 0 ? (
                <p className="text-sm text-slate-500">No products yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {lines.map((l) => {
                    const info = lineInfo(l);
                    return (
                      <li key={l.key} className="flex flex-wrap items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {l.name}
                            {l.variantLabel && <span className="text-slate-500"> — {l.variantLabel}</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            {info?.sku}
                            {info?.unitPrice != null && <> · {taka(info.unitPrice)} each</>}
                            {info?.compareAtPrice != null && <span className="ml-1 line-through">{taka(info.compareAtPrice)}</span>}
                            {info?.flashSale && <Badge variant="secondary" className="ml-2">{info.flashSale}</Badge>}
                          </p>
                          {info?.problem && <p className="text-xs text-rose-600">{info.problem}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(l.key, l.qty - 1)} aria-label="One less">
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            className="h-8 w-14 text-center"
                            type="number"
                            min={1}
                            value={l.qty}
                            aria-label={`Quantity of ${l.name}`}
                            onChange={(e) => setQty(l.key, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                          />
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(l.key, l.qty + 1)} aria-label="One more">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="w-24 text-right font-medium">{info?.lineSubtotal != null ? taka(info.lineSubtotal) : "—"}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setQty(l.key, 0)} aria-label={`Remove ${l.name}`}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Delivery type">
                {(
                  [
                    ["method", "Deliver (zone price)"],
                    ["custom", "Deliver (my price)"],
                    ["pickup", "Pickup / walk-in"],
                  ] as const
                ).map(([v, label]) => (
                  <Button key={v} type="button" role="radio" aria-checked={deliveryType === v} variant={deliveryType === v ? "default" : "outline"} size="sm" onClick={() => setDeliveryType(v)}>
                    {label}
                  </Button>
                ))}
              </div>
              {needsAddress && (
                <>
                  <AreaSelects
                    rows={areas}
                    isLoading={areasLoading}
                    value={area}
                    onChange={(v, deepest) => {
                      setArea(v);
                      setLocationId(deepest && v.districtId ? deepest : null);
                    }}
                  />
                  <Field label="Address" htmlFor="a-line1" hint="House, road, area, landmark.">
                    <Input id="a-line1" value={address1} onChange={(e) => setAddress1(e.target.value)} />
                  </Field>
                  <Field label="More address details (optional)" htmlFor="a-line2">
                    <Input id="a-line2" value={address2} onChange={(e) => setAddress2(e.target.value)} />
                  </Field>
                </>
              )}
              {deliveryType === "method" && (
                <div className="space-y-2">
                  <Label>Delivery option</Label>
                  {!locationId ? (
                    <p className="text-sm text-slate-500">Pick the district to see delivery options.</p>
                  ) : options.length === 0 ? (
                    <p className="text-sm text-amber-700">No delivery option for this area — set a price instead, or add one under Shipping → Zones.</p>
                  ) : (
                    options.map((o) => (
                      <label key={o.id} className={cn("flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm", methodId === o.id && "border-blue-600 bg-blue-50/50 dark:bg-blue-500/10")}>
                        <span className="flex items-center gap-2">
                          <input type="radio" name="method" checked={methodId === o.id} onChange={() => setMethodId(o.id)} />
                          {o.name}
                          {o.minDays != null && <span className="text-xs text-slate-500">{[...new Set([o.minDays, o.maxDays])].filter((d) => d != null).join("–")} days</span>}
                        </span>
                        <span className="font-medium">{o.fee === 0 ? "Free" : taka(o.fee)}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
              {deliveryType === "custom" && (
                <Field label="Delivery charge ৳" htmlFor="d-fee">
                  <Input id="d-fee" type="number" min={0} step="1" value={customFee} onChange={(e) => setCustomFee(e.target.value)} />
                </Field>
              )}
            </CardContent>
          </Card>

          {/* Discount, payment, source */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discount and payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Discount"
                  htmlFor="disc"
                  hint={result ? `You can give up to ${result.discountCapPct}%${t ? ` (${taka(capAmount)} on this order)` : ""}.` : undefined}
                >
                  <div className="flex gap-2">
                    <select className={cn(SELECT, "w-24")} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")} aria-label="Discount type">
                      <option value="percent">%</option>
                      <option value="fixed">৳</option>
                    </select>
                    <Input id="disc" type="number" min={0} step="1" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                  </div>
                </Field>
                <Field label="Coupon code (optional)" htmlFor="coupon" error={coupon.trim() ? result?.couponError : null}>
                  <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Payment method" htmlFor="gw">
                  <select id="gw" className={SELECT} value={gateway} onChange={(e) => setGateway(e.target.value)}>
                    {(result?.paymentMethods ?? [{ code: "cod", name: "Cash on Delivery", enabled: true }]).map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.name}
                        {g.enabled ? "" : " (not offered online)"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source" htmlFor="src" hint="Where the customer ordered.">
                  <select id="src" className={SELECT} value={source} onChange={(e) => setSource(e.target.value as OrderSource)}>
                    {ORDER_SOURCES.filter((s) => s.value !== "website").map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Toggle
                checked={applyPromotions}
                onChange={setApplyPromotions}
                label="Apply the store's promotions"
                hint="Automatic discounts, free gifts and free delivery, as on the website."
              />
              <Toggle checked={paid} onChange={setPaid} label="Already paid" hint={gateway === "cod" ? "Cash received now (e.g. walk-in)." : "The customer has sent the money."} />
              {paid && gateway !== "cod" && (
                <Field label="Transaction ID" htmlFor="trx" hint="From the bKash / Nagad / bank message.">
                  <Input id="trx" value={trx} onChange={(e) => setTrx(e.target.value)} />
                </Field>
              )}
              <Toggle checked={confirmed} onChange={setConfirmed} label="Confirmed with the customer" hint="Starts the order as Processing instead of Pending." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Note from the customer (optional)" htmlFor="cnote">
                  <Textarea id="cnote" rows={2} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
                </Field>
                <Field label="Staff note (optional)" htmlFor="snote" hint="Kept in the order history; customers don't see it.">
                  <Textarea id="snote" rows={2} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Items", t ? `${taka(t.itemsSubtotal)} (${t.qty})` : "—"],
                ...(result?.promotions.discount ? [[result.promotions.discount.name, `−${taka(result.promotions.discount.amount)}`]] : []),
                ...(result?.promotions.bxgy ?? []).map((b) => [`${b.name}: ${b.freeUnits} free`, `−${taka(b.amount)}`]),
                ...(t?.couponDiscount ? [["Coupon", `−${taka(t.couponDiscount)}`]] : []),
                ...(t?.manualDiscount ? [["Discount", `−${taka(t.manualDiscount)}`]] : []),
                [
                  "Delivery",
                  deliveryType === "method" && !methodId
                    ? "—"
                    : deliveryType === "pickup"
                      ? "Pickup"
                      : t?.shippingTotal
                        ? taka(t.shippingTotal)
                        : "Free",
                ],
                ["Tax", t ? taka(t.taxTotal) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span>{t ? taka(t.grandTotal) : "—"}</span>
              </div>
              {result?.promotions.gifts.map((g) => (
                <p key={g.promotionId} className="rounded-md bg-pink-50 p-2 text-pink-800 dark:bg-pink-500/10 dark:text-pink-300">
                  Free gift: {g.qty} × {g.title} ({g.promotionName})
                </p>
              ))}
              {result?.promotions.freeDelivery && deliveryType === "method" && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Free delivery: {result.promotions.freeDelivery.name}</p>
              )}
              {result?.promotions.droppedForCoupon && (
                <p className="text-xs text-amber-700">This coupon doesn't work with promotions, so they're off for this order.</p>
              )}
              {[...(result?.promotions.nudges ?? []).map((n) => n.message), ...(result?.promotions.notes ?? [])].map((m) => (
                <p key={m} className="text-xs text-slate-500">
                  {m}
                </p>
              ))}
              {result?.problems.length ? (
                <ul className="space-y-1 rounded-md bg-rose-50 p-3 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {result.problems.map((p) => (
                    <li key={p} className="flex gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Toggle
                checked={notify}
                onChange={setNotify}
                label="Email the customer"
                hint={(customer?.email || email.trim()) ? "Sends the order confirmation with the invoice." : "Add an email to send a confirmation."}
              />
              <Button className="w-full" disabled={!ready || creating || quoting} onClick={submit}>
                {creating ? "Creating…" : `Create order${t ? ` · ${taka(t.grandTotal)}` : ""}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
