"use client";

/** SMS sent for an order (updates, invoice link) and a button to send the invoice link by SMS. */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageSquareText, Send } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, cn } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import { SMS_KIND_LABELS, useOrderSmsQuery, useSendInvoiceSmsMutation } from "@/lib/features/settings/sms-api-slice";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OrderSmsCard({ orderId, phone, canEdit }: { orderId: string | number; phone?: string; canEdit: boolean }) {
  const { data = [] } = useOrderSmsQuery(orderId);
  const [send, { isLoading }] = useSendInvoiceSmsMutation();
  const [to, setTo] = useState(phone ?? "");

  async function sendInvoice() {
    try {
      const m = await send({ orderId, to: to.trim() || undefined }).unwrap();
      if (m.status === "failed") toast.error(`Not sent: ${m.error}`);
      else if (m.status === "logged") toast.info("Recorded only: choose an SMS provider in Settings → SMS to send it");
      else toast.success(`Invoice link sent to ${m.to}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-4 w-4 text-blue-600" /> SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-9 w-44" value={to} onChange={(e) => setTo(e.target.value)} placeholder="01XXXXXXXXX" aria-label="Send to" />
            <Button size="sm" variant="outline" onClick={sendInvoice} disabled={isLoading}>
              <Send className="mr-1.5 h-4 w-4" /> {isLoading ? "Sending…" : "Send invoice by SMS"}
            </Button>
          </div>
        )}
        {!data.length ? (
          <p className="text-sm text-slate-500">
            No SMS for this order yet. Order updates by SMS are set up in{" "}
            <Link href="/settings/sms" className="text-blue-600 hover:underline">
              Settings → SMS
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((m) => (
              <li key={m.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {SMS_KIND_LABELS[m.kind] ?? m.kind} · {m.to} · {when(m.createdAt)}
                  </span>
                  <span className={cn("font-medium", m.status === "failed" ? "text-rose-600" : m.status === "sent" ? "text-emerald-700" : "")}>
                    {m.status === "logged" ? "recorded" : m.status}
                  </span>
                </div>
                <p className="mt-1">{m.body}</p>
                {m.error && <p className="mt-1 text-xs text-rose-600">{m.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
