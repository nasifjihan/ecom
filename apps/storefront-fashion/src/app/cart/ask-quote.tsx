"use client";

/** "Ask for a quote" on the cart, for approved business accounts: sends the cart to the shop to price. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button, Label, apiErrorMessage, toast, useCart, useT } from "@ecom/storefront-base";
import { useWholesaleStatus } from "@/lib/wholesale";
import { useRequestQuoteMutation } from "@/lib/quotes";

export function AskForQuote() {
  const t = useT();
  const router = useRouter();
  const { items } = useCart();
  const { data } = useWholesaleStatus();
  const [request, { isLoading }] = useRequestQuoteMutation();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  if (!data?.enabled || data.account?.status !== "APPROVED" || !items.length) return null;

  const send = async () => {
    try {
      const q = await request({
        items: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, qty: i.qty })),
        note: note.trim() || null,
      }).unwrap();
      toast.success(t("Quote {number} requested. We'll email you when it's ready.", { number: q.number }));
      router.push(`/account/quotes/${q.number}`);
    } catch (err) {
      toast.error(t("Couldn't ask for a quote"), { description: apiErrorMessage(err) });
    }
  };

  return open ? (
    <div className="space-y-2 rounded-xl border p-3">
      <Label htmlFor="quote-ask-note">{t("Anything the shop should know? (optional)")}</Label>
      <textarea
        id="quote-ask-note"
        rows={2}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("e.g. delivery date, or a price you have in mind")}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <Button className="flex-1" onClick={send} disabled={isLoading}>
          {t("Send quote request")}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  ) : (
    <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
      <FileText className="mr-2 h-4 w-4" /> {t("Ask for a quote instead")}
    </Button>
  );
}
