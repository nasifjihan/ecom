"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, apiErrorMessage, msg, toast, useT } from "@ecom/storefront-base";
import { useAppDispatch } from "@/lib/store";
import {
  useChangeMyPasswordMutation,
  useGetMyOrdersQuery,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  updateStoredCustomer,
  type Customer,
} from "@/lib/account";
import { AccountShell, Field, OrderStatusBadge, PASSWORD_RULE, formatBDT, formatDate, passwordProblem } from "./_components";

export default function AccountPage() {
  return (
    <AccountShell title={msg("My Account")} description={msg("Your details, password and latest orders.")}>
      <AccountOverview />
    </AccountShell>
  );
}

function AccountOverview() {
  const { data: profile, isLoading } = useGetMyProfileQuery();
  const { data: orders } = useGetMyOrdersQuery({ page: 1, perPage: 3 });
  const t = useT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("Recent orders")}</CardTitle>
          <Link href="/account/orders" className="text-sm font-medium text-primary hover:underline">
            {t("View all")}
          </Link>
        </CardHeader>
        <CardContent>
          {!orders ? (
            <Skeleton className="h-16 w-full" />
          ) : orders.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("No orders yet.")}{" "}
              <Link href="/products" className="text-primary hover:underline">
                {t("Start shopping")}
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {orders.items.map((o) => (
                <li key={o.orderRef}>
                  <Link href={`/account/orders/${o.orderRef}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="font-medium">#{o.orderRef}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(o.createdAt)} · {o.itemCount === 1 ? t("1 item") : t("{n} items", { n: o.itemCount })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={o.status} />
                      <span className="font-semibold tabular-nums">{formatBDT(o.grandTotal, o.currency)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("Profile")}</CardTitle>
          </CardHeader>
          <CardContent>{isLoading || !profile ? <Skeleton className="h-48 w-full" /> : <ProfileForm profile={profile} />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("Change password")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileForm({ profile }: { profile: Customer }) {
  const dispatch = useAppDispatch();
  const [update, { isLoading }] = useUpdateMyProfileMutation();
  const t = useT();
  const [form, setForm] = React.useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
    acceptMarketing: !!profile.acceptMarketing,
  });
  const set = (k: "firstName" | "lastName" | "phone") => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await update({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        acceptMarketing: form.acceptMarketing,
      }).unwrap();
      // Keep the header name in step with the saved profile.
      updateStoredCustomer(dispatch, updated);
      toast.success(t("Profile saved"));
    } catch (err) {
      toast.error(t("Couldn't save your profile"), { description: apiErrorMessage(err) });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id="firstName" label={msg("First name")} required value={form.firstName} onChange={set("firstName")} />
        <Field id="lastName" label={msg("Last name")} required value={form.lastName} onChange={set("lastName")} />
      </div>
      {profile.email ? (
        <Field id="email" label={msg("Email")} value={profile.email} disabled readOnly />
      ) : (
        <p className="text-sm text-muted-foreground">{t("You sign in with a code sent to your mobile number.")}</p>
      )}
      <Field id="phone" label={msg("Mobile")} type="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={set("phone")} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.acceptMarketing} onChange={(e) => setForm((f) => ({ ...f, acceptMarketing: e.target.checked }))} />
        {t("Email me about new arrivals and offers")}
      </label>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? t("Saving...") : t("Save profile")}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [change, { isLoading }] = useChangeMyPasswordMutation();
  const [currentPassword, setCurrent] = React.useState("");
  const [newPassword, setNew] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const t = useT();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(newPassword);
    if (problem) return setError(t(problem));
    setError(null);
    try {
      await change({ currentPassword, newPassword }).unwrap();
      setCurrent("");
      setNew("");
      toast.success(t("Password changed"));
    } catch (err) {
      setError(apiErrorMessage(err, t("Couldn't change your password.")));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="currentPassword" label={msg("Current password")} type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
      <div className="space-y-1">
        <Field id="newPassword" label={msg("New password")} type="password" required autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
        <p className="text-xs text-muted-foreground">{t(PASSWORD_RULE)}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={isLoading}>
        {isLoading ? t("Changing...") : t("Change password")}
      </Button>
    </form>
  );
}
