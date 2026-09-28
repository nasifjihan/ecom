"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button, Card, CardContent, apiErrorMessage, msg, useT } from "@ecom/storefront-base";
import { useForgotPasswordMutation } from "@/lib/account";
import { Field } from "../_components";

export default function ForgotPasswordPage() {
  const params = useSearchParams();
  const [forgot, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const t = useT();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await forgot({ email: email.trim() }).unwrap();
      setSentTo(email.trim());
    } catch (err) {
      setError(apiErrorMessage(err, t("Couldn't send the email. Please try again.")));
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
              <h1 className="text-2xl font-bold">{t("Check your email")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("If an account uses {email}, we've sent a link to reset the password. It works for one hour.", { email: sentTo })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("No email after a few minutes? Check your spam folder, or")}{" "}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSentTo(null)}>
                  {t("try again")}
                </button>
                {t(".")}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-center">
                <h1 className="text-2xl font-bold">{t("Forgot your password?")}</h1>
                <p className="text-sm text-muted-foreground">{t("Enter your email and we'll send you a link to choose a new one.")}</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field id="email" label={msg("Email")} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t("Sending...") : t("Send reset link")}
                </Button>
              </form>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {t("Remembered it?")}{" "}
            <Link href="/account/login" className="font-semibold text-primary hover:underline">
              {t("Log in")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
