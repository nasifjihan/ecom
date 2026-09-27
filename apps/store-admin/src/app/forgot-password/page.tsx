"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { AuthCard, apiError } from "@/components/auth/auth-card";
import { useForgotPasswordMutation } from "@/lib/features/auth/auth-api-slice";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [send, { isLoading }] = useForgotPasswordMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await send({ email: email.trim() }).unwrap();
      setSentTo(email.trim());
    } catch (err) {
      setError(apiError(err, "Couldn't send the email. Please try again."));
    }
  };

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <div className="flex gap-3 rounded-lg bg-indigo-50 p-4 text-sm text-slate-700 dark:bg-indigo-500/10 dark:text-slate-200">
          <MailCheck className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <p>
            If <strong>{sentTo}</strong> belongs to an admin account on this store, we&apos;ve sent it a link to choose a new
            password. The link works for one hour.
          </p>
        </div>
        <button type="button" onClick={() => setSentTo(null)} className="mt-4 text-sm text-slate-500 underline-offset-2 hover:underline">
          Use a different email
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" description="Enter the email you sign in with and we'll send you a link to choose a new one.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="admin@store.com"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full bg-indigo-600 text-white hover:bg-indigo-700" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
