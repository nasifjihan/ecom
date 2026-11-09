"use client";

/** Edit a customer's "came from", profile links and the other names ordered with their phone. */
import { useState } from "react";
import { toast } from "sonner";
import { Link2, X } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectItem } from "@/components/ui";
import { CUSTOMER_SOURCE_LABELS, useUpdateCustomerMutation, type Customer, type CustomerSocial } from "@/lib/features/operations/operations-api-slice";
import { useCan } from "@/lib/permissions";
import { SocialFields } from "./social-fields";

export function ProfileButton({ customer }: { customer: Customer }) {
  const { can } = useCan();
  const [open, setOpen] = useState(false);
  if (!can("customers.edit")) return null;
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4" /> Profile links
      </Button>
      {open && <ProfileDialog customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProfileDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [update, { isLoading }] = useUpdateCustomerMutation();
  const [social, setSocial] = useState<CustomerSocial>(customer.social ?? {});
  const [names, setNames] = useState<string[]>(customer.otherNames ?? []);
  const [source, setSource] = useState(customer.source ?? "");
  const [name, setName] = useState("");

  const save = async () => {
    try {
      await update({ id: customer.id, patch: { social, otherNames: names, ...(source ? { source } : {}) } as Partial<Customer> }).unwrap();
      toast.success("Customer saved");
      onClose();
    } catch {
      toast.error("Couldn't save the customer");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
          <DialogDescription>Where they came from, their profiles, and other names used with their phone number.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs">Came from</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectItem value="">Not set</SelectItem>
              {Object.entries(CUSTOMER_SOURCE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </Select>
          </div>
          <SocialFields value={social} onChange={setSocial} />
          <div>
            <Label className="mb-1.5 block text-xs">Other names (ordered with this phone)</Label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {names.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                  {n}
                  <button type="button" aria-label={`Remove ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {!names.length && <span className="text-xs text-slate-500">None yet. New names are added when an order with this phone uses another name.</span>}
            </div>
            <div className="flex gap-2">
              <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karim Uddin" />
              <Button
                type="button"
                variant="outline"
                disabled={!name.trim() || names.length >= 10}
                onClick={() => {
                  if (!names.some((n) => n.toLowerCase() === name.trim().toLowerCase())) setNames([...names, name.trim()]);
                  setName("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isLoading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
