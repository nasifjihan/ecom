"use client";

/**
 * Edit an order before a parcel is packed: the delivery address and phone, the items and the
 * delivery charge. Another size = remove the line and add the other option. Kept lines keep their
 * price and discount; added ones are at today's price.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import type { Order } from "@/lib/features/operations/operations-api-slice";
import { useEditOrderMutation, type EditOrderBody } from "@/lib/features/orders/order-checks-api-slice";
import { ProductPicker, taka } from "./order-pickers";

type Line = { orderItemId: string | null; productId: string; variantId: string | null; name: string; quantity: number; unitPrice: number };

export function EditOrderDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [edit, { isLoading }] = useEditOrderMutation();
  const a = order.shippingAddress ?? order.billingAddress ?? {};
  const start = {
    firstName: a.firstName ?? "",
    lastName: a.lastName ?? "",
    phone: a.phone ?? order.customerPhone ?? "",
    addressLine1: a.address1 ?? "",
    addressLine2: a.address2 ?? "",
    division: a.division ?? "",
    district: a.district ?? "",
    upazila: a.upazila ?? "",
  };
  const startLines: Line[] = order.lines
    .filter((l) => !l.giftFrom && l.productId)
    .map((l) => ({ orderItemId: String(l.id), productId: String(l.productId), variantId: l.variantId ? String(l.variantId) : null, name: l.productName, quantity: l.quantity, unitPrice: l.unitPrice }));
  const [addr, setAddr] = useState(start);
  const [lines, setLines] = useState<Line[]>(startLines);
  const [shipping, setShipping] = useState(String(order.shippingCost));
  const [note, setNote] = useState("");

  const setQty = (i: number, q: number) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, quantity: Math.max(1, Math.min(100, q)) } : l)));
  const field = (k: keyof typeof start, label: string, required = false) => (
    <div className="space-y-1">
      <Label htmlFor={`eo-${k}`}>{label}</Label>
      <Input id={`eo-${k}`} value={addr[k]} required={required} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} />
    </div>
  );

  const save = async () => {
    const body: EditOrderBody = {};
    if (JSON.stringify(addr) !== JSON.stringify(start)) body.address = addr;
    if (JSON.stringify(lines) !== JSON.stringify(startLines)) body.items = lines.map((l) => ({ orderItemId: l.orderItemId, productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
    if (Number(shipping) !== order.shippingCost) body.shippingTotal = Number(shipping) || 0;
    if (!body.address && !body.items && body.shippingTotal === undefined) {
      toast.info("Nothing changed");
      return;
    }
    if (note.trim()) body.note = note.trim();
    try {
      const r = await edit({ id: String(order.id), ...body }).unwrap();
      toast.success("Order updated", { description: r.changes.join("; ") });
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit order #{order.orderNumber}</DialogTitle>
          <DialogDescription>
            For changes after the confirmation call. Kept items keep their price; added items are at today's price. Free gifts stay as they are.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Items</h3>
          {lines.map((l, i) => (
            <div key={`${l.productId}:${l.variantId ?? ""}`} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {l.name}
                {!l.orderItemId && <span className="ml-1 text-xs text-emerald-600">new</span>}
              </span>
              <span className="text-slate-500">{taka(l.unitPrice)}</span>
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(i, l.quantity - 1)} aria-label="One less">
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center">{l.quantity}</span>
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(i, l.quantity + 1)} aria-label="One more">
                <Plus className="h-3 w-3" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <ProductPicker
            onAdd={(p, v) => {
              if (lines.some((l) => l.productId === p.id && (l.variantId ?? null) === (v?.id ?? null))) {
                toast.info("Already on the order. Change its quantity instead.");
                return;
              }
              setLines((ls) => [...ls, { orderItemId: null, productId: p.id, variantId: v?.id ?? null, name: v ? `${p.name} (${v.label})` : p.name, quantity: 1, unitPrice: p.price }]);
            }}
          />
          <p className="text-xs text-slate-500">Another size or colour: remove the line and add the other option.</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-sm font-semibold sm:col-span-2">Delivery address</h3>
          {field("firstName", "First name", true)}
          {field("lastName", "Last name")}
          {field("phone", "Phone", true)}
          {field("district", "District", true)}
          {field("upazila", "Upazila / thana")}
          {field("division", "Division")}
          <div className="sm:col-span-2">{field("addressLine1", "Address", true)}</div>
          <div className="sm:col-span-2">{field("addressLine2", "Address line 2")}</div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="eo-shipping">Delivery charge (৳)</Label>
            <Input id="eo-shipping" type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eo-note">Why (shows on the timeline)</Label>
            <Textarea id="eo-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer asked for size L on the call" />
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isLoading || lines.length === 0}>
            {isLoading ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
