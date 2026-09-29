"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, apiErrorMessage, msg, toast, useT } from "@ecom/storefront-base";
import { useAppDispatch } from "@/lib/store";
import { hasStoredToken, signIn, useCustomerRegisterMutation } from "@/lib/account";
import { Field, PASSWORD_RULE, passwordProblem, safeNext } from "../_components";

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const next = safeNext(params.get("next"));
  const [register, { isLoading }] = useCustomerRegisterMutation();
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "", phone: "", password: "", acceptMarketing: false });
  const [error, setError] = React.useState<string | null>(null);
  const t = useT();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  React.useEffect(() => {
    if (hasStoredToken()) router.replace(next);
  }, [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(form.password);
    if (problem) return setError(t(problem));
    setError(null);
    try {
      const result = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        acceptMarketing: form.acceptMarketing,
      }).unwrap();
      signIn(dispatch, result);
      toast.success(t("Your account is ready"));
      router.replace(next);
    } catch (err) {
      setError(apiErrorMessage(err, t("Couldn't create your account. Please try again.")));
    }
  };

  return (
    <div className="container py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold">{t("Create an account")}</h1>
            <p className="text-sm text-muted-foreground">{t("Save your addresses and follow every order.")}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field id="firstName" label={msg("First name")} required autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
              <Field id="lastName" label={msg("Last name")} required autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
            </div>
            <Field id="email" label={msg("Email")} type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
            <Field id="phone" label={msg("Mobile (optional)")} type="tel" placeholder="01XXXXXXXXX" autoComplete="tel" value={form.phone} onChange={set("phone")} />
            <div className="space-y-1">
              <Field id="password" label={msg("Password")} type="password" required autoComplete="new-password" value={form.password} onChange={set("password")} />
              <p className="text-xs text-muted-foreground">{t(PASSWORD_RULE)}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.acceptMarketing} onChange={(e) => setForm((f) => ({ ...f, acceptMarketing: e.target.checked }))} />
              {t("Email me about new arrivals and offers")}
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("Creating account...") : t("Create account")}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {t("Already have an account?")}{" "}
            <Link href="/account/login" className="font-semibold text-primary hover:underline">
              {t("Log in")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
