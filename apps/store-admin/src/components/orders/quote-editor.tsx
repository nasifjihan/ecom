"use client";

/**
 * Quote editor and view: customer, products at agreed prices (the customer's normal price shown
 * beside each), discount, delivery, validity and terms. Saving a sent quote takes it back to draft;
 * Send emails it; Make order opens New order filled from the quote. Print shows #print-doc only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, ClipboardList, PackagePlus, Printer, Send, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle } from "@/components/content/shared";
import { CustomerPicker, ProductPicker, taka, useDebounced } from "@/components/orders/order-pickers";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useMeQuery } from "@/lib/features/auth/auth-api-slice";
import { useStorefrontOptionsQuery } from "@/lib/features/storefronts/storefronts-api-slice";
import { useCan } from "@/lib/permissions";
import type { PickCustomer, PickProduct } from "@/lib/features/operations/manual-order-api-slice";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_STYLE,
  useCancelQuotationMutation,
  useDeleteQuotationMutation,
  usePreviewQuoteLinesMutation,
  useQuotationQuery,
  useSaveQuotationMutation,
  useSendQuotationMutation,
  type Quotation,
  type QuoteStatus,
} from "@/lib/features/wholesale/quotations-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const round2 = (n: number) => Math.round(n * 100) / 100;
const niceDate = (s: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", QUOTE_STATUS_STYLE[status])}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}

interface Line {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  option: string | null;
  sku: string | null;
  qty: number;
  listPrice: number;
  /** Typed price each; follows the normal price until staff change it. */
  price: string;
  follow: boolean;
  note: string | null;
}

type Customer = Pick<PickCustomer, "id" | "name" | "phone" | "email"> & { business?: string | null };

const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`;

function fromQuote(q: Quotation): Line[] {
  return q.items
    .filter((i) => i.productId)
    .map((i) => ({
      key: lineKey(i.productId!, i.variantId),
      productId: i.productId!,
      variantId: i.variantId,
      name: i.name,
      option: i.option,
      sku: i.sku,
      qty: i.qty,
      listPrice: i.listPrice,
      price: String(i.unitPrice),
      follow: i.unitPrice === i.listPrice,
      note: null,
    }));
}

export function QuoteEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { can } = useCan();
  const { data: me } = useMeQuery();
  const { data: quote, isLoading } = useQuotationQuery(id ?? "", { skip: !id });
  const { data: storefronts = [] } = useStorefrontOptionsQuery();
  const [preview] = usePreviewQuoteLinesMutation();
  const [save, { isLoading: saving }] = useSaveQuotationMutation();
  const [send, { isLoading: sending }] = useSendQuotationMutation();
  const [cancel] = useCancelQuotationMutation();
  const [remove] = useDeleteQuotationMutation();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [storefrontId, setStorefrontId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [terms, setTerms] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [dirty, setDirty] = useState(!id);

  // Load the saved quote into the form.
  useEffect(() => {
    if (!quote) return;
    setCustomer({ id: quote.customer.id, name: quote.customer.name, phone: quote.customer.phone, email: quote.customer.email, business: quote.customer.business });
    setStorefrontId(quote.storefrontId ?? "");
    setLines(fromQuote(quote));
    setDiscount(quote.discount ? String(quote.discount) : "");
    setDeliveryFee(quote.deliveryFee ? String(quote.deliveryFee) : "");
    setValidUntil(quote.validUntil ?? "");
    setTerms(quote.terms ?? "");
    setStaffNote(quote.staffNote ?? "");
    setDirty(false);
  }, [quote]);

  const editable = can("orders.create") && (!quote || quote.can.edit);
  const touch = () => setDirty(true);

  // Normal prices depend on the customer and quantities (business and bulk prices): refresh them.
  const priceKey = useDebounced(
    JSON.stringify([customer?.id, storefrontId, lines.map((l) => [l.productId, l.variantId, l.qty])]),
    300,
  );
  const seq = useRef(0);
  useEffect(() => {
    if (!customer || !lines.length || !editable) return;
    const n = ++seq.current;
    preview({ customerId: customer.id, storefrontId: storefrontId || null, items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })) })
      .unwrap()
      .then((rows) => {
        if (n !== seq.current) return;
        setLines((cur) =>
          cur.map((l) => {
            const r = rows.find((x) => lineKey(x.productId, x.variantId) === l.key);
            if (!r) return l;
            return { ...l, listPrice: r.listPrice, note: r.note, ...(l.follow ? { price: String(r.listPrice) } : {}) };
          }),
        );
      })
      .catch((e) => toast.error(errorText(e)));
  }, [priceKey]);

  const addLine = async (p: PickProduct, v?: { id: string; label: string }) => {
    if (!customer) return;
    const key = lineKey(p.id, v?.id ?? null);
    if (lines.some((l) => l.key === key)) {
      setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)));
      touch();
      return;
    }
    try {
      const [r] = await preview({ customerId: customer.id, storefrontId: storefrontId || null, items: [{ productId: p.id, variantId: v?.id ?? null, qty: 1 }] }).unwrap();
      if (!r) return;
      setLines((ls) => [
        ...ls,
        { key, productId: p.id, variantId: v?.id ?? null, name: r.name, option: r.option, sku: r.sku, qty: 1, listPrice: r.listPrice, price: String(r.listPrice), follow: true, note: r.note },
      ]);
      touch();
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const setLine = (key: string, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    touch();
  };

  const totals = useMemo(() => {
    const subtotal = round2(lines.reduce((s, l) => s + round2(l.qty * (Number(l.price) || 0)), 0));
    const listTotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.listPrice), 0));
    const d = round2(Math.min(Math.max(0, Number(discount) || 0), subtotal));
    const fee = round2(Math.max(0, Number(deliveryFee) || 0));
    const total = round2(subtotal - d + fee);
    const off = listTotal > 0 ? Math.max(0, Math.round(((listTotal - (subtotal - d)) / listTotal) * 1000) / 10) : 0;
    return { subtotal, listTotal, discount: d, fee, total, off };
  }, [lines, discount, deliveryFee]);

  const valid = !!customer && lines.length > 0 && lines.every((l) => Number(l.price) >= 0 && l.price !== "" && l.qty >= 1);

  const doSave = async (): Promise<Quotation | null> => {
    if (!customer) return null;
    try {
      const saved = await save({
        id,
        customerId: customer.id,
        storefrontId: storefrontId || null,
        validUntil: validUntil || null,
        terms: terms.trim() || null,
        staffNote: staffNote.trim() || null,
        discount: totals.discount,
        deliveryFee: totals.fee,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, unitPrice: Number(l.price) })),
      }).unwrap();
      setDirty(false);
      if (!id) router.replace(`/orders/quotations/${saved.id}`);
      return saved;
    } catch (e) {
      toast.error(errorText(e));
      return null;
    }
  };

  const onSave = async () => {
    const q = await doSave();
    if (q) toast.success(q.status === "DRAFT" && quote && quote.status !== "DRAFT" ? "Saved. It's a draft again; send it when ready." : "Quote saved");
  };

  const onSend = async () => {
    const q = dirty || !id ? await doSave() : quote;
    if (!q) return;
    try {
      await send(q.id).unwrap();
      toast.success(`Quote ${q.number} sent${q.customer.email ? ` to ${q.customer.email}` : ""}`);
      if (!id) router.replace(`/orders/quotations/${q.id}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (id && (isLoading || !quote)) return <Skeleton className="h-96" />;
  const status = quote?.status;
  const storeName = quote?.storeName ?? me?.store?.name ?? "";

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ClipboardList}
        title={quote ? `Quote ${quote.number}` : "New quote"}
        description={quote ? `Created ${niceDate(quote.createdAt)}${quote.sentAt ? ` · sent ${niceDate(quote.sentAt)}` : ""}` : "Prices start at what this customer normally pays (their business and bulk prices included); change them to what you agree."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/orders/quotations">
                <ArrowLeft className="mr-2 h-4 w-4" /> All quotes
              </Link>
            </Button>
            {quote && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            )}
          </div>
        }
      />

      {quote && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <QuoteStatusBadge status={quote.status} />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {
                {
                  REQUESTED: "The customer asked for this quote. Set your prices and send it.",
                  DRAFT: "Not sent yet. The customer can't see it.",
                  SENT: `Waiting for the customer's answer (valid until ${niceDate(quote.validUntil)}).`,
                  EXPIRED: `Expired on ${niceDate(quote.validUntil)}. Change the date and send it again.`,
                  ACCEPTED: "The customer accepted. Make the order when you're ready.",
                  DECLINED: "The customer declined. Change it and send it again, or cancel it.",
                  ORDERED: "Made into an order.",
                  CANCELLED: "Cancelled.",
                }[quote.status]
              }
            </span>
            {quote.order && (
              <Link href={`/orders/${quote.order.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                Order #{quote.order.number}
              </Link>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {can("orders.create") && quote.can.order && (
                <Button asChild>
                  <Link href={`/orders/new?quotation=${quote.id}`}>
                    <PackagePlus className="mr-2 h-4 w-4" /> Make order
                  </Link>
                </Button>
              )}
              {can("orders.create") && quote.can.cancel && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!confirm(`Cancel quote ${quote.number}?`)) return;
                    try {
                      await cancel(quote.id).unwrap();
                      toast.success("Quote cancelled");
                    } catch (e) {
                      toast.error(errorText(e));
                    }
                  }}
                >
                  <Ban className="mr-2 h-4 w-4" /> Cancel quote
                </Button>
              )}
              {can("orders.create") && quote.status === "DRAFT" && !quote.sentAt && (
                <Button
                  variant="ghost"
                  aria-label="Delete draft"
                  onClick={async () => {
                    if (!confirm(`Delete draft ${quote.number}?`)) return;
                    try {
                      await remove(quote.id).unwrap();
                      toast.success("Draft deleted");
                      router.push("/orders/quotations");
                    } catch (e) {
                      toast.error(errorText(e));
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              )}
            </div>
            {quote.customerNote && (
              <p className="w-full rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-900">
                <b>Customer&apos;s note:</b> {quote.customerNote}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">
                      {customer.business ?? customer.name}
                      {customer.business && <Badge variant="secondary" className="ml-2">Business</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">{[customer.business ? customer.name : null, customer.phone, customer.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  {editable && !quote && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                      Change
                    </Button>
                  )}
                </div>
              ) : (
                <CustomerPicker onPick={(c) => (setCustomer(c), touch())} />
              )}
              {storefronts.length > 1 && (
                <Field label="Storefront" htmlFor="q-sf" hint="Its prices are the starting point; the order is made there.">
                  <select
                    id="q-sf"
                    className={SELECT}
                    disabled={!editable}
                    value={storefrontId || (storefronts.find((s) => s.isDefault) ?? storefronts[0])?.id}
                    onChange={(e) => (setStorefrontId(e.target.value), touch())}
                  >
                    {storefronts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editable && (customer ? <ProductPicker onAdd={addLine} /> : <p className="text-sm text-slate-500">Pick the customer first; their prices are the starting point.</p>)}
              {lines.length === 0 ? (
                <p className="text-sm text-slate-500">No products yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {lines.map((l) => {
                    const price = Number(l.price) || 0;
                    return (
                      <li key={l.key} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_5rem_8rem_7rem_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {l.name}
                            {l.option && <span className="text-slate-500"> — {l.option}</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            {l.sku} · normal price {taka(l.listPrice)}
                            {price < l.listPrice && <span className="ml-1 text-emerald-700">({taka(l.listPrice - price)} less each)</span>}
                          </p>
                          {l.note && <p className="text-xs text-amber-700">{l.note}</p>}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={l.qty}
                          disabled={!editable}
                          aria-label={`Quantity of ${l.name}`}
                          onChange={(e) => setLine(l.key, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.price}
                          disabled={!editable}
                          aria-label={`Price each for ${l.name}`}
                          onChange={(e) => setLine(l.key, { price: e.target.value, follow: false })}
                        />
                        <span className="text-right font-medium tabular-nums">{taka(round2(price * l.qty))}</span>
                        {editable ? (
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${l.name}`} onClick={() => (setLines((ls) => ls.filter((x) => x.key !== l.key)), touch())}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        ) : (
                          <span />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terms</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid until" htmlFor="q-valid" hint="Empty: 14 days from when you send it.">
                <Input id="q-valid" type="date" value={validUntil} disabled={!editable} onChange={(e) => (setValidUntil(e.target.value), touch())} />
              </Field>
              <div />
              <Field label="Terms the customer sees" htmlFor="q-terms" hint="Payment, delivery time, what's included." className="sm:col-span-2">
                <Textarea id="q-terms" rows={3} value={terms} disabled={!editable} onChange={(e) => (setTerms(e.target.value), touch())} />
              </Field>
              <Field label="Staff note (not shown to the customer)" htmlFor="q-note" className="sm:col-span-2">
                <Textarea id="q-note" rows={2} value={staffNote} disabled={!editable} onChange={(e) => (setStaffNote(e.target.value), touch())} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Items</span>
                <span className="tabular-nums">{taka(totals.subtotal)}</span>
              </div>
              <Field label="Discount ৳" htmlFor="q-disc">
                <Input id="q-disc" type="number" min={0} step="1" value={discount} disabled={!editable} onChange={(e) => (setDiscount(e.target.value), touch())} />
              </Field>
              <Field label="Delivery charge ৳" htmlFor="q-fee" hint="Carried into the order.">
                <Input id="q-fee" type="number" min={0} step="1" value={deliveryFee} disabled={!editable} onChange={(e) => (setDeliveryFee(e.target.value), touch())} />
              </Field>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{taka(totals.total)}</span>
              </div>
              <p className="text-xs text-slate-500">VAT, if it applies, is added when the order is made (it depends on the delivery address).</p>
              {totals.listTotal > 0 && (
                <p className="text-xs text-slate-500">
                  At normal prices the items cost {taka(totals.listTotal)}; this quote is {totals.off}% less.
                </p>
              )}
              {editable && (
                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={onSend} disabled={!valid || saving || sending}>
                    <Send className="mr-2 h-4 w-4" /> {status === "SENT" || status === "EXPIRED" ? (dirty ? "Save and send again" : "Send again") : "Save and send"}
                  </Button>
                  <Button variant="outline" onClick={onSave} disabled={!valid || saving || !dirty}>
                    Save {quote && quote.status !== "DRAFT" && quote.status !== "REQUESTED" ? "as draft" : ""}
                  </Button>
                  {quote && dirty && quote.status !== "DRAFT" && quote.status !== "REQUESTED" && (
                    <p className="text-xs text-amber-700">Saving changes takes this quote back to draft until you send it again.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {quote && (
        <div id="print-doc" className="hidden bg-white p-8 text-black print:block">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold">{storeName}</p>
              <p className="mt-1 text-sm">Quotation {quote.number}</p>
            </div>
            <div className="text-right text-sm">
              <p>Date: {niceDate(quote.sentAt ?? quote.createdAt)}</p>
              <p>Valid until: {niceDate(quote.validUntil)}</p>
            </div>
          </div>
          <div className="mt-6 text-sm">
            <p className="font-semibold">For</p>
            {quote.customer.business && <p>{quote.customer.business}</p>}
            {quote.customer.name !== quote.customer.business && <p>{quote.customer.name}</p>}
            <p>{[quote.customer.phone, quote.customer.email].filter(Boolean).join(" · ")}</p>
          </div>
          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price each</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="py-2">
                    {i.name}
                    {i.option ? ` — ${i.option}` : ""}
                    {i.sku && <span className="block text-xs text-gray-600">{i.sku}</span>}
                  </td>
                  <td className="py-2 text-right">{i.qty}</td>
                  <td className="py-2 text-right">{taka(i.unitPrice)}</td>
                  <td className="py-2 text-right">{taka(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Items</span>
              <span>{taka(quote.subtotal)}</span>
            </p>
            {quote.discount > 0 && (
              <p className="flex justify-between">
                <span>Discount</span>
                <span>−{taka(quote.discount)}</span>
              </p>
            )}
            {quote.deliveryFee > 0 && (
              <p className="flex justify-between">
                <span>Delivery</span>
                <span>{taka(quote.deliveryFee)}</span>
              </p>
            )}
            <p className="flex justify-between border-t border-black pt-1 font-bold">
              <span>Total</span>
              <span>{taka(quote.total)}</span>
            </p>
          </div>
          <p className="mt-2 text-right text-xs text-gray-600">VAT, if it applies, is added to the order.</p>
          {quote.terms && (
            <div className="mt-6 text-sm">
              <p className="font-semibold">Terms</p>
              <p className="whitespace-pre-line">{quote.terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
