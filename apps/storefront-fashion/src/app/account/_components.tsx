"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MapPin, Package, User } from "lucide-react";
import { Badge, Button, Input, Label, cn, formatMoney } from "@ecom/storefront-base";
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

export const PASSWORD_RULE = "At least 8 characters, with an uppercase letter and a number.";
export const passwordProblem = (p: string) => (p.length < 8 || !/[A-Z]/.test(p) || !/[0-9]/.test(p) ? PASSWORD_RULE : null);

export const formatBDT = (n: number, currency = "BDT") => formatMoney(n, currency);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

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
  { href: "/account", label: "Profile", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
];

export function AccountShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const ready = useRequireCustomer();
  const pathname = usePathname();
  const name = useAppSelector((s) => s.auth.customerName);
  const email = useAppSelector((s) => s.auth.customerEmail);
  const [logout] = useCustomerLogoutMutation();

  const onLogout = async () => {
    await logout().unwrap().catch(() => undefined);
    signOutAndLeave("/");
  };

  if (!ready) {
    return <div className="container py-16 text-center text-sm text-muted-foreground">Loading your account...</div>;
  }

  return (
    <div className="container py-8 md:py-12">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="font-semibold truncate">{name ?? "My Account"}</p>
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
                  {label}
                </Link>
              );
            })}
            <button onClick={onLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent text-left whitespace-nowrap">
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </nav>
        </aside>
        <main className="min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
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
  const label = status.replace(/_/g, " ").toLowerCase();
  return <Badge className={cn("border-0 capitalize", STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700")}>{label}</Badge>;
}

export function Field({
  id,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...props} />
    </div>
  );
}

export const BD_DIVISIONS = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];

export const emptyAddress = (): AddressInput => ({
  type: "shipping",
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  state: "Dhaka",
  postcode: "",
  countryCode: "BD",
  phone: "",
  isDefault: false,
});

export function toAddressInput(a: CustomerAddress): AddressInput {
  const { id: _id, ...rest } = a;
  return { ...rest, label: rest.label ?? "", company: rest.company ?? "", address2: rest.address2 ?? "", state: rest.state ?? "", postcode: rest.postcode ?? "", phone: rest.phone ?? "" };
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
        <Field id="firstName" label="First name" required value={a.firstName} onChange={set("firstName")} autoComplete="given-name" />
        <Field id="lastName" label="Last name" required value={a.lastName} onChange={set("lastName")} autoComplete="family-name" />
        <Field id="phone" label="Phone" placeholder="01XXXXXXXXX" pattern="(\+?88)?01[0-9]{9}" title="A Bangladeshi mobile number, e.g. 01712345678" value={a.phone ?? ""} onChange={set("phone")} autoComplete="tel" />
        <Field id="label" label="Label (optional)" placeholder="Home, Office..." value={a.label ?? ""} onChange={set("label")} />
      </div>
      <Field id="address1" label="Address" required minLength={2} placeholder="House, road, area" value={a.address1} onChange={set("address1")} autoComplete="address-line1" />
      <Field id="address2" label="Apartment, landmark (optional)" value={a.address2 ?? ""} onChange={set("address2")} autoComplete="address-line2" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="city" label="District / City" required value={a.city} onChange={set("city")} autoComplete="address-level2" />
        <div className="space-y-1.5">
          <Label htmlFor="state">Division</Label>
          <select id="state" value={a.state ?? ""} onChange={set("state")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {BD_DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <Field id="postcode" label="Postcode" value={a.postcode ?? ""} onChange={set("postcode")} autoComplete="postal-code" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!a.isDefault} onChange={(e) => setA((p) => ({ ...p, isDefault: e.target.checked }))} />
        Use as my default delivery address
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
