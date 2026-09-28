"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, apiErrorMessage, msg, toast, useT } from "@ecom/storefront-base";
import { useAppDispatch } from "@/lib/store";
import { fullName, signIn, useCustomerLoginMutation, useResetPasswordMutation } from "@/lib/account";
import { Field, PASSWORD_RULE, passwordProblem } from "../_components";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const token = params.get("token") ?? "";
  const [reset, { isLoading }] = useResetPasswordMutation();
  const [login] = useCustomerLoginMutation();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(!token);
  const t = useT();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(t(problem));
    if (password !== confirm) return setError(t("The two passwords don't match."));
    try {
      const { email } = await reset({ token, password }).unwrap();
      // Sign straight in with the new password.
      try {
        const result = await login({ email, password }).unwrap();
        signIn(dispatch, result);
        toast.success(t("Password changed. Welcome back, {name}", { name: fullName(result.user) }));
        router.replace("/account");
      } catch {
        toast.success(t("Password changed. Please log in."));
        router.replace("/account/login");
      }
    } catch (err) {
      const code = (err as { data?: { code?: string; errors?: unknown } })?.data;
      const status = (err as { status?: number })?.status;
      if (status === 400 && !code?.errors) setExpired(true);
      else setError(apiErrorMessage(err, t("Couldn't change your password. Please try again.")));
    }
  };

  return (
    <div className="container py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8 space-y-6">
          {expired ? (
            <div className="space-y-4 text-center">
              <h1 className="text-2xl font-bold">{t("This link has expired")}</h1>
              <p className="text-sm text-muted-foreground">{t("Reset links work once, for one hour. Ask for a new one and we'll email it to you.")}</p>
              <Button asChild className="w-full">
                <Link href="/account/forgot-password">{t("Send a new link")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-center">
                <h1 className="text-2xl font-bold">{t("Choose a new password")}</h1>
                <p className="text-sm text-muted-foreground">{t(PASSWORD_RULE)}</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field id="password" label={msg("New password")} type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Field id="confirm" label={msg("Type it again")} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t("Saving...") : t("Save new password")}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
