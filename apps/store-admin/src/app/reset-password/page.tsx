"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Label } from "@/components/ui";
import { AuthCard, apiError } from "@/components/auth/auth-card";
import { useResetPasswordMutation } from "@/lib/features/auth/auth-api-slice";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(!token);
  const [reset, { isLoading }] = useResetPasswordMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    try {
      const { email } = await reset({ token, password }).unwrap();
      toast.success("Password changed", { description: "Sign in with your new password." });
      router.replace(`/login?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const data = (err as { status?: number; data?: { errors?: unknown } }) ?? {};
      if (data.status === 400 && !data.data?.errors) setExpired(true);
      else setError(apiError(err, "Couldn't change your password. Please try again."));
    }
  };

  if (expired) {
    return (
      <AuthCard title="This link has expired" description="Reset links work once, for one hour. Ask for a new one and we'll email it to you.">
        <Button asChild className="h-11 w-full bg-indigo-600 text-white hover:bg-indigo-700">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required autoComplete="new-password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Type it again</Label>
          <Input id="confirm" type="password" required autoComplete="new-password" className="h-11" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full bg-indigo-600 text-white hover:bg-indigo-700" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
