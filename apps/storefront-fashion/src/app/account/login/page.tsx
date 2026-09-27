"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, apiErrorMessage, toast } from "@ecom/storefront-base";
import { useAppDispatch } from "@/lib/store";
import { fullName, hasStoredToken, signIn, useCustomerLoginMutation } from "@/lib/account";
import { Field, safeNext } from "../_components";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const next = safeNext(params.get("next"));
  const [login, { isLoading }] = useCustomerLoginMutation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (hasStoredToken()) router.replace(next);
  }, [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login({ email: email.trim(), password }).unwrap();
      signIn(dispatch, result);
      toast.success(`Welcome back, ${fullName(result.user)}`);
      router.replace(next);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 401 ? "That email and password don't match. Please try again." : apiErrorMessage(err, "Couldn't sign you in. Please try again."));
    }
  };

  return (
    <div className="container py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold">Log in</h1>
            <p className="text-sm text-muted-foreground">Track your orders and check out faster.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field id="email" label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="space-y-1">
              <Field id="password" label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="text-right">
                <Link href={`/account/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href={`/account/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
