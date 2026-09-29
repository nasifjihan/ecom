"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, apiErrorMessage, cn, msg, toast, useT } from "@ecom/storefront-base";
import { useAppDispatch } from "@/lib/store";
import {
  fullName,
  hasStoredToken,
  signIn,
  useCustomerLoginMutation,
  useLoginMethodsQuery,
  useRequestPhoneCodeMutation,
  useVerifyPhoneCodeMutation,
} from "@/lib/account";
import { Field, safeNext } from "../_components";

type Method = "phone" | "email";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { data: methods } = useLoginMethodsQuery();
  const [method, setMethod] = React.useState<Method | null>(null);
  const t = useT();

  React.useEffect(() => {
    if (hasStoredToken()) router.replace(next);
  }, [router, next]);

  // Phone first when the shop offers it: most customers here shop with a mobile number.
  const shown: Method = method ?? (methods?.phoneOtp ? "phone" : "email");

  return (
    <div className="container py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold">{t("Log in")}</h1>
            <p className="text-sm text-muted-foreground">{t("Track your orders and check out faster.")}</p>
          </div>
          {methods?.phoneOtp && (
            <div role="tablist" aria-label={t("How to log in")} className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
              {(["phone", "email"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={shown === m}
                  onClick={() => setMethod(m)}
                  className={cn("rounded-md py-2 transition-colors", shown === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {m === "phone" ? t("Mobile number") : t("Email")}
                </button>
              ))}
            </div>
          )}
          {shown === "phone" ? <PhoneLogin next={next} /> : <EmailLogin next={next} />}
          <p className="text-center text-sm text-muted-foreground">
            {t("New here?")}{" "}
            {shown === "phone" ? (
              t("Enter your number: we'll make your account when you confirm the code.")
            ) : (
              <Link href={`/account/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary hover:underline">
                {t("Create an account")}
              </Link>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EmailLogin({ next }: { next: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useCustomerLoginMutation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const t = useT();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login({ email: email.trim(), password }).unwrap();
      signIn(dispatch, result);
      toast.success(t("Welcome back, {name}", { name: fullName(result.user) }));
      router.replace(next);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 401 ? t("That email and password don't match. Please try again.") : apiErrorMessage(err, t("Couldn't sign you in. Please try again.")));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="email" label={msg("Email")} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="space-y-1">
        <Field id="password" label={msg("Password")} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right">
          <Link href={`/account/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-xs font-medium text-primary hover:underline">
            {t("Forgot password?")}
          </Link>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t("Logging in...") : t("Log in")}
      </Button>
    </form>
  );
}

const RESEND_SECONDS = 60;

/** Number -> 6-digit code by SMS -> signed in (a new number gets an account). */
function PhoneLogin({ next }: { next: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [requestCode, { isLoading: sending }] = useRequestPhoneCodeMutation();
  const [verify, { isLoading: verifying }] = useVerifyPhoneCodeMutation();
  const [phone, setPhone] = React.useState("");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [wait, setWait] = React.useState(0);
  const t = useT();

  React.useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      await requestCode({ phone: phone.trim() }).unwrap();
      setSentTo(phone.trim());
      setCode("");
      setWait(RESEND_SECONDS);
      toast.success(t("Code sent"), { description: t("We sent a 6-digit code to {phone}.", { phone: phone.trim() }) });
    } catch (err) {
      setError(apiErrorMessage(err, t("Couldn't send the code. Please try again.")));
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    const [firstName, ...rest] = name.trim().split(/\s+/);
    try {
      const result = await verify({ phone: sentTo, code: code.trim(), ...(firstName ? { firstName } : {}), ...(rest.length ? { lastName: rest.join(" ") } : {}) }).unwrap();
      signIn(dispatch, result);
      toast.success(result.created ? t("Welcome, {name}! Your account is ready.", { name: fullName(result.user) }) : t("Welcome back, {name}", { name: fullName(result.user) }));
      router.replace(next);
    } catch (err) {
      setError(apiErrorMessage(err, t("That code didn't work. Please try again.")));
    }
  };

  if (!sentTo) {
    return (
      <form onSubmit={send} className="space-y-4">
        <Field
          id="phone"
          label={msg("Mobile number")}
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={sending || phone.trim().length < 10}>
          {sending ? t("Sending code...") : t("Send code by SMS")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("Enter the 6-digit code we sent to {phone}.", { phone: sentTo })}{" "}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setSentTo(null); setError(null); }}>
          {t("Change number")}
        </button>
      </p>
      <Field
        id="code"
        autoFocus
        label={msg("Code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.5em]"
      />
      <Field id="name" label={msg("Your name (only for new accounts)")} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
        {verifying ? t("Checking...") : t("Log in")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("Didn't get it?")}{" "}
        {wait > 0 ? (
          t("Send again in {n}s", { n: wait })
        ) : (
          <button type="button" className="font-medium text-primary hover:underline" disabled={sending} onClick={() => void send()}>
            {t("Send a new code")}
          </button>
        )}
      </p>
    </form>
  );
}
