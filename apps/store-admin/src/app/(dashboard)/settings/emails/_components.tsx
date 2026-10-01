"use client";

import * as React from "react";
import { cn } from "@/components/ui";
import type { EmailStatus } from "@/lib/features/settings/emails-api-slice";

/**
 * Shows an email's HTML in a sandboxed frame: no scripts run, links open in a new tab,
 * and the frame grows to fit the email.
 */
export function EmailFrame({ html, className, title = "Email preview" }: { html: string; className?: string; title?: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(480);
  const doc = React.useMemo(() => html.replace(/<head>/i, '<head><base target="_blank">'), [html]);

  const fit = () => {
    const body = ref.current?.contentDocument?.body;
    if (body) setHeight(Math.max(240, body.scrollHeight + 8));
  };

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={doc}
      onLoad={fit}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ height }}
      className={cn("w-full rounded-lg border bg-slate-100", className)}
    />
  );
}

const STATUS: Record<EmailStatus, { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300" },
  queued: { label: "Sending", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  retrying: { label: "Retrying", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
};

export function StatusBadge({ status, logOnly }: { status: EmailStatus; logOnly?: boolean }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <span
      title={logOnly ? "Mail sending is off (MAIL_DRIVER=log), so this email was only recorded here." : undefined}
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", s.className)}
    >
      {logOnly && status === "sent" ? "Logged only" : s.label}
    </span>
  );
}

export const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

/** Plain names for the {{variables}} a message can use. */
export const VARIABLE_LABELS: Record<string, string> = {
  "store.name": "Store name",
  "store.url": "Store web address",
  "store.email": "Store email",
  "store.phone": "Store phone",
  "customer.name": "Customer's full name",
  "customer.first_name": "Customer's first name",
  "customer.email": "Customer's email",
  "order.number": "Order number",
  "order.date": "Order date",
  "order.total": "Order total",
  "order.status": "Order status",
  "order.payment_method": "Payment method",
  "order.shipping_method": "Delivery method",
  "order.delivery_time": "Delivery time picked (if any)",
  "order.url": "Link to the order",
  "order.admin_url": "Link to the order in the admin",
  "shipment.carrier": "Courier",
  "shipment.tracking_number": "Tracking number",
  "shipment.tracking_url": "Tracking link",
  "update.note": "Note added when the status changed",
  "reset.url": "Password reset link",
  "reset.expires_minutes": "Minutes the link works for",
  "staff.name": "Team member's name",
  "staff.email": "Team member's email",
};
