"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button, Card, CardContent, apiErrorMessage } from "@ecom/storefront-base";
import { useForgotPasswordMutation } from "@/lib/account";
import { Field } from "../_components";

export default function ForgotPasswordPage() {
  const params = useSearchParams();
  const [forgot, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await forgot({ email: email.trim() }).unwrap();
      setSentTo(email.trim());
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send the email. Please try again."));
    }
  };

  return (
    <div className="container py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8 space-y-6">
          {sentTo ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                If an account uses <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve sent a link to reset the password. It works for
                one hour.
              </p>
              <p className="text-sm text-muted-foreground">
                No email after a few minutes? Check your spam folder, or{" "}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSentTo(null)}>
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-center">
                <h1 className="text-2xl font-bold">Forgot your password?</h1>
                <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field id="email" label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/account/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
