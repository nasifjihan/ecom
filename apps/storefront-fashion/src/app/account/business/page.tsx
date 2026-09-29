"use client";

/**
 * Business account: apply (shops, resellers, companies), see where the application is, and, once
 * approved, what it gives. Approved accounts get the business prices shown on product pages.
 */
import * as React from "react";
import Link from "next/link";
import { Briefcase, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button, Input, Label, apiErrorMessage, msg, toast, useT } from "@ecom/storefront-base";
import { AccountShell, formatDate } from "../_components";
import { BUSINESS_STATUS_WORDS, BUSINESS_TYPES, useApplyBusinessMutation, useWholesaleStatus, type BusinessDetails } from "@/lib/wholesale";

const FIELD = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function ApplyForm({ intro, again }: { intro: string | null; again: boolean }) {
  const t = useT();
  const [apply, { isLoading }] = useApplyBusinessMutation();
  const [f, setF] = React.useState<Required<Record<keyof BusinessDetails, string>>>({
    companyName: "",
    businessType: "retailer",
    contactPhone: "",
    address: "",
    tradeLicenseNo: "",
    vatRegNo: "",
    note: "",
  });
  const set = (k: keyof BusinessDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await apply({
        companyName: f.companyName.trim(),
        businessType: f.businessType,
        contactPhone: f.contactPhone.trim() || null,
        address: f.address.trim() || null,
        tradeLicenseNo: f.tradeLicenseNo.trim() || null,
        vatRegNo: f.vatRegNo.trim() || null,
        note: f.note.trim() || null,
      }).unwrap();
      toast.success(r.status === "APPROVED" ? t("Your business account is ready") : t("Application sent. We'll let you know."));
    } catch (err) {
      toast.error(t("Couldn't send the application"), { description: apiErrorMessage(err) });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
      {intro && <p className="whitespace-pre-line text-sm">{intro}</p>}
      {again && <p className="text-sm text-muted-foreground">{t("You can apply again with more details.")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="biz-name">{t("Business name")}</Label>
          <Input id="biz-name" required minLength={2} maxLength={120} value={f.companyName} onChange={set("companyName")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-type">{t("Type of business")}</Label>
          <select id="biz-type" value={f.businessType} onChange={set("businessType")} className={`${FIELD} h-10`}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b.value} value={b.value}>
                {t(b.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-phone">{t("Business phone")}</Label>
          <Input id="biz-phone" inputMode="tel" maxLength={20} value={f.contactPhone} onChange={set("contactPhone")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-tl">{t("Trade licence number")}</Label>
          <Input id="biz-tl" maxLength={60} value={f.tradeLicenseNo} onChange={set("tradeLicenseNo")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-bin">{t("VAT registration (BIN), if any")}</Label>
          <Input id="biz-bin" maxLength={40} value={f.vatRegNo} onChange={set("vatRegNo")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="biz-addr">{t("Business address")}</Label>
          <Input id="biz-addr" maxLength={300} value={f.address} onChange={set("address")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="biz-note">{t("What do you sell, and how much do you usually buy?")}</Label>
          <textarea id="biz-note" rows={3} maxLength={1000} value={f.note} onChange={set("note")} className={FIELD} />
        </div>
      </div>
      <Button type="submit" disabled={isLoading || f.companyName.trim().length < 2}>
        {t("Apply for a business account")}
      </Button>
    </form>
  );
}

const ICONS = { PENDING: Clock, APPROVED: CheckCircle2, REJECTED: XCircle, SUSPENDED: XCircle } as const;
const TONE = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  APPROVED: "border-green-300 bg-green-50 text-green-900",
  REJECTED: "border-rose-300 bg-rose-50 text-rose-900",
  SUSPENDED: "border-rose-300 bg-rose-50 text-rose-900",
} as const;
const EXPLAIN = {
  PENDING: msg("We're checking your details. Business prices start once you're approved."),
  APPROVED: msg("You get business prices. Look for “Business price” on product pages; they apply in your cart automatically."),
  REJECTED: msg("Your application wasn't approved."),
  SUSPENDED: msg("Your business account is on hold, so you pay normal prices for now. Please contact the shop."),
} as const;

export default function BusinessAccountPage() {
  const t = useT();
  const { data, isLoading } = useWholesaleStatus();
  const account = data?.account;

  return (
    <AccountShell title={msg("Business account")} description={msg("For shops, resellers and companies buying in bulk.")}>
      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : !data.enabled && !account ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{t("This shop doesn't take business accounts at the moment.")}</div>
      ) : (
        <div className="space-y-6">
          {account && (
            <div className={`rounded-xl border p-5 ${TONE[account.status]}`}>
              {(() => {
                const Icon = ICONS[account.status];
                return (
                  <p className="flex items-center gap-2 font-semibold">
                    <Icon className="h-5 w-5" /> {account.companyName} — {t(BUSINESS_STATUS_WORDS[account.status])}
                  </p>
                );
              })()}
              <p className="mt-1 text-sm">{t(EXPLAIN[account.status])}</p>
              {account.reviewNote && (
                <p className="mt-2 text-sm">
                  <b>{t("From the shop:")}</b> {account.reviewNote}
                </p>
              )}
              <p className="mt-2 text-xs opacity-75">{t("Applied {date}", { date: formatDate(account.appliedAt) })}</p>
              {account.status === "APPROVED" && (
                <Button asChild variant="outline" size="sm" className="mt-3 bg-white">
                  <Link href="/products">
                    <Briefcase className="mr-1.5 h-4 w-4" /> {t("Shop now")}
                  </Link>
                </Button>
              )}
            </div>
          )}
          {data.enabled && (!account || account.status === "REJECTED") && <ApplyForm intro={data.intro} again={!!account} />}
        </div>
      )}
    </AccountShell>
  );
}
