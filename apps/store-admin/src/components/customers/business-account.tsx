"use client";

/**
 * Business accounts: the status badge, the details form (add / edit), the review dialog
 * (approve / reject / suspend) and the panel on a customer's page.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Check, Pause, Pencil, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Textarea,
  cn,
} from "@/components/ui";
import { Field } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  BUSINESS_STATUS_LABELS,
  BUSINESS_TYPE_LABELS,
  useAddBusinessAccountMutation,
  useCustomerBusinessAccountQuery,
  useDeleteBusinessAccountMutation,
  useReviewBusinessAccountMutation,
  useUpdateBusinessAccountMutation,
  useWholesaleSettingsQuery,
  type BusinessAccount,
  type BusinessDetails,
  type BusinessStatus,
  type BusinessType,
} from "@/lib/features/wholesale/wholesale-api-slice";

const STATUS_STYLE: Record<BusinessStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  APPROVED: "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
  REJECTED: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  SUSPENDED: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
};

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLE[status])}>
      {BUSINESS_STATUS_LABELS[status]}
    </Badge>
  );
}

type Form = Record<keyof BusinessDetails, string>;
const EMPTY: Form = { companyName: "", businessType: "retailer", contactPhone: "", address: "", tradeLicenseNo: "", vatRegNo: "", note: "" };
const toForm = (a: BusinessDetails | null): Form =>
  a ? (Object.fromEntries(Object.keys(EMPTY).map((k) => [k, a[k as keyof BusinessDetails] ?? ""])) as Form) : EMPTY;
/** Trimmed text, or null when empty. */
const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
const fromForm = (f: Form): BusinessDetails => ({
  companyName: f.companyName.trim(),
  businessType: f.businessType as BusinessType,
  contactPhone: orNull(f.contactPhone),
  address: orNull(f.address),
  tradeLicenseNo: orNull(f.tradeLicenseNo),
  vatRegNo: orNull(f.vatRegNo),
  note: orNull(f.note),
});

/** Add a business account for a customer (approved at once), or edit one's details. */
export function BusinessDetailsDialog({
  open,
  onOpenChange,
  account,
  customerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: BusinessAccount | null;
  customerId?: string;
}) {
  const [f, setF] = useState<Form>(EMPTY);
  const [add, adding] = useAddBusinessAccountMutation();
  const [update, updating] = useUpdateBusinessAccountMutation();
  useEffect(() => {
    if (open) setF(toForm(account));
  }, [open, account]);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    try {
      if (account) await update({ id: account.id, ...fromForm(f) }).unwrap();
      else await add({ customerId: customerId!, ...fromForm(f) }).unwrap();
      toast.success(account ? "Saved" : "Business account added");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Business details" : "Make a business account"}</DialogTitle>
          <DialogDescription>
            {account ? "Correct what the customer entered." : "The account is approved straight away, so this customer gets business prices from their next order."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Business name" htmlFor="b-name" className="sm:col-span-2">
            <Input id="b-name" value={f.companyName} onChange={set("companyName")} />
          </Field>
          <Field label="Type of business" htmlFor="b-type">
            <Select id="b-type" value={f.businessType} onValueChange={(v) => setF((p) => ({ ...p, businessType: v }))}>
              {Object.entries(BUSINESS_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field label="Business phone" htmlFor="b-phone">
            <Input id="b-phone" value={f.contactPhone} onChange={set("contactPhone")} />
          </Field>
          <Field label="Trade licence no." htmlFor="b-tl">
            <Input id="b-tl" value={f.tradeLicenseNo} onChange={set("tradeLicenseNo")} />
          </Field>
          <Field label="VAT registration (BIN)" htmlFor="b-bin">
            <Input id="b-bin" value={f.vatRegNo} onChange={set("vatRegNo")} />
          </Field>
          <Field label="Business address" htmlFor="b-addr" className="sm:col-span-2">
            <Input id="b-addr" value={f.address} onChange={set("address")} />
          </Field>
          <Field label="Notes" htmlFor="b-note" className="sm:col-span-2">
            <Textarea id="b-note" rows={2} value={f.note} onChange={set("note")} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={adding.isLoading || updating.isLoading || f.companyName.trim().length < 2}>
            {account ? "Save" : "Add business account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words">{value === null || value === undefined || value === "" ? <span className="text-slate-400">—</span> : value}</span>
    </div>
  );
}

export function BusinessDetailsList({ account }: { account: BusinessAccount }) {
  return (
    <div className="divide-y">
      <Row label="Business" value={account.companyName} />
      <Row label="Type" value={BUSINESS_TYPE_LABELS[account.businessType] ?? account.businessType} />
      <Row label="Trade licence" value={account.tradeLicenseNo} />
      <Row label="BIN" value={account.vatRegNo} />
      <Row label="Phone" value={account.contactPhone} />
      <Row label="Address" value={account.address} />
      <Row label="Their note" value={account.note} />
      <Row label="Applied" value={new Date(account.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
      {account.reviewNote && <Row label="Reason given" value={account.reviewNote} />}
    </div>
  );
}

/** Approve, reject or suspend; reject and suspend need a reason the customer will see. */
export function ReviewDialog({ account, onOpenChange }: { account: BusinessAccount | null; onOpenChange: (v: boolean) => void }) {
  const { can } = useCan();
  const readOnly = !can("customers.edit");
  const [note, setNote] = useState("");
  const [review, { isLoading }] = useReviewBusinessAccountMutation();
  useEffect(() => setNote(""), [account]);
  if (!account) return null;
  const s = account.status;
  const act = async (action: "approve" | "reject" | "suspend") => {
    try {
      await review({ id: account.id, action, note: note.trim() || null }).unwrap();
      toast.success(action === "approve" ? `${account.companyName} approved` : action === "reject" ? "Application rejected" : "Account suspended");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const needsNote = !readOnly && (s === "PENDING" || s === "APPROVED");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {account.companyName} <BusinessStatusBadge status={s} />
          </DialogTitle>
          <DialogDescription>
            {account.customer.name} · {account.customer.email ?? account.customer.phone ?? "no contact"} · {account.customer.orderCount} orders
          </DialogDescription>
        </DialogHeader>
        <BusinessDetailsList account={account} />
        {needsNote && (
          <Field label={s === "PENDING" ? "Reason, if you reject" : "Reason, if you suspend"} htmlFor="r-note" hint="The customer sees this in their account.">
            <Textarea id="r-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        <DialogFooter className={cn("gap-2", readOnly && "hidden")}>
          {s === "PENDING" && (
            <Button variant="outline" onClick={() => act("reject")} disabled={isLoading || !note.trim()}>
              <X className="mr-1.5 h-4 w-4" /> Reject
            </Button>
          )}
          {s === "APPROVED" && (
            <Button variant="outline" onClick={() => act("suspend")} disabled={isLoading || !note.trim()}>
              <Pause className="mr-1.5 h-4 w-4" /> Suspend
            </Button>
          )}
          {s !== "APPROVED" && (
            <Button onClick={() => act("approve")} disabled={isLoading}>
              <Check className="mr-1.5 h-4 w-4" /> {s === "PENDING" ? "Approve" : "Approve again"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The "Business account" tab on a customer's page. */
export function CustomerBusinessPanel({ customerId }: { customerId: string }) {
  const { data: account, isLoading } = useCustomerBusinessAccountQuery(customerId);
  const { data: settings } = useWholesaleSettingsQuery();
  const { can } = useCan();
  const canEdit = can("customers.edit");
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [remove] = useDeleteBusinessAccountMutation();

  if (isLoading) return <Skeleton className="h-40" />;
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="space-y-4 p-5">
        {!settings?.enabled && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Wholesale is off, so business prices don&apos;t apply yet. Turn it on in Customers → Business accounts.
          </p>
        )}
        {account ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <Briefcase className="h-4 w-4" /> {account.companyName} <BusinessStatusBadge status={account.status} />
              </p>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReviewing(true)}>
                    Review
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label="Edit business details">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label="Remove business account"
                    onClick={async () => {
                      if (!confirm(`Remove the business account of ${account.companyName}? They go back to normal prices.`)) return;
                      try {
                        await remove(account.id).unwrap();
                        toast.success("Business account removed");
                      } catch (e) {
                        toast.error(errorText(e));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <BusinessDetailsList account={account} />
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Not a business account. Business accounts get the bulk prices marked “Businesses”.</p>
            {canEdit && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Briefcase className="mr-1.5 h-4 w-4" /> Make business account
              </Button>
            )}
          </div>
        )}
      </CardContent>
      <BusinessDetailsDialog open={editing} onOpenChange={setEditing} account={account ?? null} customerId={customerId} />
      {reviewing && account && <ReviewDialog account={account} onOpenChange={(v) => !v && setReviewing(false)} />}
    </Card>
  );
}
