"use client";

/** "Notify me when it's back": a phone or email for a sold-out product or option. */
import * as React from "react";
import { BellRing } from "lucide-react";
import { Button, Input, apiErrorMessage, toast, useT } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";
import { useRequestStockAlertMutation } from "@/lib/engagement";

export function NotifyMe({ productId, variantId, option }: { productId: string; variantId?: string; option?: string }) {
  const t = useT();
  const email = useAppSelector((s) => s.auth.customerEmail);
  const [contact, setContact] = React.useState(email ?? "");
  const [done, setDone] = React.useState<string | null>(null);
  const [request, { isLoading }] = useRequestStockAlertMutation();
  // A different option is a different request.
  React.useEffect(() => setDone(null), [variantId]);

  if (done)
    return (
      <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <BellRing className="h-4 w-4 text-primary" /> {done}
      </p>
    );
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await request({ productId, variantId, contact: contact.trim() }).unwrap();
      setDone(r.by === "sms" ? t("We'll send you an SMS when it's back.") : t("We'll email you when it's back."));
    } catch (err) {
      toast.error(apiErrorMessage(err, t("Couldn't save that, please try again")));
    }
  };
  return (
    <form onSubmit={send} className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <BellRing className="h-4 w-4 text-primary" />
        {option ? t("Sold out in {option}. Tell me when it's back:", { option }) : t("Sold out. Tell me when it's back:")}
      </p>
      <div className="flex gap-2">
        <Input
          aria-label={t("Mobile number or email")}
          placeholder={t("Mobile number or email")}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          inputMode="email"
          required
          maxLength={254}
        />
        <Button type="submit" disabled={isLoading || contact.trim().length < 5}>
          {t("Notify me")}
        </Button>
      </div>
    </form>
  );
}
