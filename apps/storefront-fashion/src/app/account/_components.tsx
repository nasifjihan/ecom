"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Gift, LogOut, MapPin, Package, User, Wallet } from "lucide-react";
import { Badge, Button, Input, Label, LocationSelects, cn, formatMoney, msg, orderStatusWord, useT } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";
import {
  hasStoredToken,
  signOutAndLeave,
  useCustomerLogoutMutation,
  type AddressInput,
  type CustomerAddress,
} from "@/lib/account";

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export const PASSWORD_RULE = msg("At least 8 characters, with an uppercase letter and a number.");
export const passwordProblem = (p: string) => (p.length < 8 || !/[A-Z]/.test(p) || !/[0-9]/.test(p) ? PASSWORD_RULE : null);

export const formatBDT = (n: number, currency = "BDT") => formatMoney(n, currency);

/** In the page's language (account pages render in the browser, after the page has its lang). */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(
    typeof document !== "undefined" && document.documentElement.lang === "bn" ? "bn-BD" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );

/** Sends guests to the login page and back here afterwards. Returns true once the page may render. */
export function useRequireCustomer(): boolean {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!hasStoredToken()) {
      router.replace(`/account/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [router, pathname, isAuthenticated]);

  return ready;
}

const NAV = [
  { href: "/account", label: msg("Profile"), icon: User },
  { href: "/account/orders", label: msg("Orders"), icon: Package },
  { href: "/account/addresses", label: msg("Addresses"), icon: MapPin },
  { href: "/account/wallet", label: msg("Wallet"), icon: Wallet },
  { href: "/account/refer", label: msg("Refer a friend"), icon: Gift },
];

export function AccountShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const ready = useRequireCustomer();
  const pathname = usePathname();
  const name = useAppSelector((s) => s.auth.customerName);
  const email = useAppSelector((s) => s.auth.customerEmail);
  const [logout] = useCustomerLogoutMutation();
  const t = useT();

  const onLogout = async () => {
    await logout().unwrap().catch(() => undefined);
    signOutAndLeave("/");
  };

  if (!ready) {
    return <div className="container py-16 text-center text-sm text-muted-foreground">{t("Loading your account...")}</div>;
  }

  return (
    <div className="container py-8 md:py-12">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="font-semibold truncate">{name ?? t("My Account")}</p>
            {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
          </div>
          <nav className="rounded-xl border bg-card p-2 flex md:flex-col gap-1 overflow-x-auto">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/account" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(label)}
                </Link>
              );
            })}
            <button onClick={onLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-left whitespace-nowrap">
              <LogOut className="h-4 w-4" />
              {t("Log out")}
            </button>
          </nav>
        </aside>
        <main className="min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{t(title)}</h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{t(description)}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  ON_HOLD: "bg-slate-100 text-slate-700",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  REFUNDED: "bg-slate-100 text-slate-700",
  FAILED: "bg-rose-100 text-rose-800",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useT();
  return <Badge className={cn("border-0", STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700")}>{t(orderStatusWord(status))}</Badge>;
}

export function Field({
  id,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  const t = useT();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{t(label)}</Label>
      <Input id={id} name={id} {...props} />
    </div>
  );
}

export const emptyAddress = (): AddressInput => ({
  type: "shipping",
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  upazila: "",
  locationId: null,
  postcode: "",
  countryCode: "BD",
  phone: "",
  isDefault: false,
});

export function toAddressInput(a: CustomerAddress): AddressInput {
  const { id: _id, ...rest } = a;
  return {
    ...rest,
    label: rest.label ?? "",
    company: rest.company ?? "",
    address2: rest.address2 ?? "",
    state: rest.state ?? "",
    upazila: rest.upazila ?? "",
    locationId: rest.locationId ?? null,
    postcode: rest.postcode ?? "",
    phone: rest.phone ?? "",
  };
}

export function AddressForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: AddressInput;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (a: AddressInput) => void;
  onCancel: () => void;
}) {
  const [a, setA] = React.useState<AddressInput>(initial);
  const t = useT();
  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setA((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(a);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label={msg("First name")} required value={a.firstName} onChange={set("firstName")} autoComplete="given-name" />
        <Field id="lastName" label={msg("Last name")} required value={a.lastName} onChange={set("lastName")} autoComplete="family-name" />
        <Field id="phone" label={msg("Phone")} placeholder="01XXXXXXXXX" pattern="(\+?88)?01[0-9]{9}" title={t("A Bangladeshi mobile number, e.g. 01712345678")} value={a.phone ?? ""} onChange={set("phone")} autoComplete="tel" />
        <Field id="label" label={msg("Label (optional)")} placeholder={t("Home, Office...")} value={a.label ?? ""} onChange={set("label")} />
      </div>
      <Field id="address1" label={msg("Address")} required minLength={2} placeholder={t("House, road, area")} value={a.address1} onChange={set("address1")} autoComplete="address-line1" />
      <Field id="address2" label={msg("Apartment, landmark (optional)")} value={a.address2 ?? ""} onChange={set("address2")} autoComplete="address-line2" />
      <div className="grid gap-4 sm:grid-cols-2">
        <LocationSelects
          idPrefix="addr"
          value={{ division: a.state ?? "", district: a.city, upazila: a.upazila ?? "", locationId: a.locationId ?? null }}
          onChange={(v) => setA((p) => ({ ...p, state: v.division, city: v.district, upazila: v.upazila, locationId: v.locationId }))}
          renderField={(label, control, id) => (
            <div className="space-y-1.5">
              <Label htmlFor={id}>{label}</Label>
              {control}
            </div>
          )}
        />
        <Field id="postcode" label={msg("Postcode (optional)")} value={a.postcode ?? ""} onChange={set("postcode")} autoComplete="postal-code" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!a.isDefault} onChange={(e) => setA((p) => ({ ...p, isDefault: e.target.checked }))} />
        {t("Use as my default delivery address")}
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("Saving...") : t(submitLabel)}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
