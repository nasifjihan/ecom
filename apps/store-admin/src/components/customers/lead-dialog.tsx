"use client";

/** Add or edit a CRM lead: who they are, where they asked, what they want and who follows them. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from "@/components/ui";
import { Field } from "@/components/content/shared";
import { SELECT } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  LEAD_CHANNEL_LABELS,
  useAddLeadMutation,
  useLeadOwnersQuery,
  useUpdateLeadMutation,
  type Lead,
  type LeadDetail,
} from "@/lib/features/customers/leads-api-slice";

/** "2026-10-04T10:30" for <input type="datetime-local">, in the browser's time. */
export const localInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const empty = { name: "", phone: "", email: "", channel: "facebook", handle: "", interest: "", value: "", tags: "", ownerId: "me", followUp: "", note: "" };

export function LeadDialog({ open, onOpenChange, lead, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead; onSaved?: (l: LeadDetail) => void }) {
  const [f, setF] = useState(empty);
  const { data: owners = [] } = useLeadOwnersQuery(undefined, { skip: !open });
  const [add, { isLoading: adding }] = useAddLeadMutation();
  const [update, { isLoading: saving }] = useUpdateLeadMutation();

  useEffect(() => {
    if (!open) return;
    setF(
      lead
        ? {
            name: lead.name,
            phone: lead.phone ?? "",
            email: lead.email ?? "",
            channel: lead.channel,
            handle: lead.handle ?? "",
            interest: lead.interest ?? "",
            value: lead.value === null ? "" : String(lead.value),
            tags: lead.tags.join(", "),
            ownerId: lead.owner?.id ?? "",
            followUp: localInput(lead.nextFollowUpAt),
            note: "",
          }
        : empty,
    );
  }, [open, lead]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const reachable = Boolean(f.phone.trim() || f.email.trim() || f.handle.trim());

  const save = async () => {
    // "Me" is left to the server (whoever adds the lead follows it).
    const owner = f.ownerId === "me" ? undefined : f.ownerId === "" ? null : f.ownerId;
    const body = {
      name: f.name.trim(),
      phone: f.phone.trim() ? f.phone.trim() : null,
      email: f.email.trim() ? f.email.trim() : null,
      channel: f.channel,
      handle: f.handle.trim() ? f.handle.trim() : null,
      interest: f.interest.trim() ? f.interest.trim() : null,
      value: f.value.trim() ? Number(f.value) : null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      ownerId: owner,
      nextFollowUpAt: fromLocalInput(f.followUp),
    };
    try {
      const saved = lead ? await update({ id: lead.id, ...body }).unwrap() : await add({ ...body, note: f.note.trim() ? f.note.trim() : null }).unwrap();
      toast.success(lead ? "Lead saved" : "Lead added");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "Add a lead"}</DialogTitle>
          <DialogDescription>Someone who asked about buying: a comment, a message or a call.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="l-name" className="sm:col-span-2">
            <Input id="l-name" value={f.name} onChange={set("name")} placeholder="Rahima Khatun" maxLength={120} />
          </Field>
          <Field label="Where they asked" htmlFor="l-channel">
            <select id="l-channel" className={SELECT} value={f.channel} onChange={set("channel")}>
              {Object.entries(LEAD_CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name or link there" htmlFor="l-handle" hint="Paste their profile link or @name">
            <Input id="l-handle" value={f.handle} onChange={set("handle")} placeholder="facebook.com/rahima.k" maxLength={300} />
          </Field>
          <Field label="Phone" htmlFor="l-phone">
            <Input id="l-phone" type="tel" value={f.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" maxLength={30} />
          </Field>
          <Field label="Email" htmlFor="l-email">
            <Input id="l-email" type="email" value={f.email} onChange={set("email")} maxLength={254} />
          </Field>
          <Field label="What they want" htmlFor="l-interest" className="sm:col-span-2">
            <Textarea id="l-interest" rows={2} value={f.interest} onChange={set("interest")} placeholder="Eid panjabi set, size 42, white" maxLength={1000} />
          </Field>
          <Field label="Expected order value (৳)" htmlFor="l-value">
            <Input id="l-value" type="number" min={0} value={f.value} onChange={set("value")} />
          </Field>
          <Field label="Tags" htmlFor="l-tags" hint="Separate with commas">
            <Input id="l-tags" value={f.tags} onChange={set("tags")} placeholder="eid, wholesale" />
          </Field>
          <Field label="Followed by" htmlFor="l-owner">
            <select id="l-owner" className={SELECT} value={f.ownerId} onChange={set("ownerId")}>
              {!lead && <option value="me">Me</option>}
              <option value="">No one yet</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.isSalesperson ? " (sales team)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Next follow-up" htmlFor="l-follow">
            <Input id="l-follow" type="datetime-local" value={f.followUp} onChange={set("followUp")} />
          </Field>
          {!lead && (
            <Field label="First note (optional)" htmlFor="l-note" className="sm:col-span-2">
              <Textarea id="l-note" rows={2} value={f.note} onChange={set("note")} placeholder="Commented on the Eid post asking for the price" maxLength={2000} />
            </Field>
          )}
        </div>
        {!reachable && <p className="text-xs text-amber-700">Add a phone, an email or their name on the channel so you can reach them.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={adding || saving || f.name.trim().length < 2 || !reachable}>
            {lead ? "Save" : "Add lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
