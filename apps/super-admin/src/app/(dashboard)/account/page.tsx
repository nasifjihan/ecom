"use client";

/**
 * My account: two-step sign-in for the platform admin. Set up with an authenticator app (QR code),
 * confirm one code, keep the 10 backup codes; turning it off or new codes need the password.
 */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { Copy, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Skeleton } from "@/components/ui";
import { setSuperAccessToken } from "@/lib/features/auth/auth-slice";
import {
  useConfirmTwoFactorMutation,
  useDisableTwoFactorMutation,
  useNewBackupCodesMutation,
  useStartTwoFactorMutation,
  useTwoFactorStatusQuery,
  type TwoFactorSetup,
} from "@/lib/features/auth/two-factor-api-slice";

const messageOf = (err: unknown) => (err as { data?: { message?: string } })?.data?.message ?? "Something went wrong.";

export default function AccountPage() {
  const dispatch = useDispatch();
  const { data, isLoading } = useTwoFactorStatusQuery();
  const [start, { isLoading: starting }] = useStartTwoFactorMutation();
  const [confirm, { isLoading: confirming }] = useConfirmTwoFactorMutation();
  const [disable, { isLoading: disabling }] = useDisableTwoFactorMutation();
  const [renew, { isLoading: renewing }] = useNewBackupCodesMutation();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [asking, setAsking] = useState<"disable" | "codes" | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const keep = (accessToken: string) => {
    // Other sessions just ended; this one carries on with the new token.
    dispatch(setSuperAccessToken(accessToken));
    document.cookie = `superAccessToken=${accessToken}; path=/; SameSite=Lax`;
  };
  const onStart = async () => {
    try {
      setSetup(await start().unwrap());
      setCode("");
    } catch (err) {
      toast.error(messageOf(err));
    }
  };
  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await confirm({ code: code.trim() }).unwrap();
      keep(res.accessToken);
      setSetup(null);
      setCodes(res.backupCodes);
      toast.success("Two-step sign-in is on");
    } catch (err) {
      toast.error(messageOf(err));
    }
  };
  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (asking === "disable") {
        await disable({ password }).unwrap();
        toast.success("Two-step sign-in is off");
      } else {
        const res = await renew({ password }).unwrap();
        keep(res.accessToken);
        setCodes(res.backupCodes);
      }
      setAsking(null);
      setPassword("");
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserCog className="h-6 w-6" /> My account
        </h1>
        <p className="text-sm text-slate-500">Settings for your own platform sign-in.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Two-step sign-in
            {data?.enabled && <Badge variant="success">On</Badge>}
          </CardTitle>
          <CardDescription>
            After your password, sign-in also asks for a code from an authenticator app on your phone, so a stolen password alone can&apos;t get in.
            Strongly recommended for the platform team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !data ? (
            <Skeleton className="h-10 w-48" />
          ) : codes ? (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm font-medium">Keep these backup codes somewhere safe</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                If you lose your phone, sign in with one of these instead of a code. Each works once. They won&apos;t be shown again.
              </p>
              <ul className="grid grid-cols-2 gap-1.5 font-mono text-sm sm:grid-cols-5" aria-label="Backup codes">
                {codes.map((c) => (
                  <li key={c} className="rounded bg-white px-2 py-1 text-center dark:bg-slate-900">
                    {c}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(codes.join("\n")).then(() => toast.success("Copied"))}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copy
                </Button>
                <Button size="sm" onClick={() => setCodes(null)}>
                  I&apos;ve saved them
                </Button>
              </div>
            </div>
          ) : setup ? (
            <form onSubmit={onConfirm} className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <img src={setup.qr} alt="QR code to scan with your authenticator app" width={180} height={180} className="rounded-md border bg-white p-1" />
              <div className="space-y-3">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  <li>Open your authenticator app and add an account.</li>
                  <li>Scan this QR code, or type the key below.</li>
                  <li>Type the 6-digit code the app shows.</li>
                </ol>
                <p className="break-all font-mono text-xs text-slate-500">Key: {setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="tf-code">Code from the app</Label>
                  <Input
                    id="tf-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="max-w-[10rem] tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={confirming || code.length !== 6}>
                    Turn on
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          ) : asking ? (
            <form onSubmit={onPassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tf-password">Your password</Label>
                <Input id="tf-password" type="password" autoComplete="current-password" className="max-w-sm" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-slate-500">{asking === "disable" ? "To turn two-step sign-in off." : "To make new backup codes. The old ones stop working."}</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant={asking === "disable" ? "destructive" : "default"} disabled={!password || disabling || renewing}>
                  {asking === "disable" ? "Turn off" : "Make new codes"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAsking(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : data.enabled ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                On since {new Date(data.enabledAt!).toLocaleDateString()} · {data.backupCodesLeft} backup code{data.backupCodesLeft === 1 ? "" : "s"} left
              </p>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAsking("codes")}>
                  New backup codes
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAsking("disable")}>
                  <ShieldOff className="mr-1.5 h-4 w-4" /> Turn off
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => void onStart()} disabled={starting}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Set up two-step sign-in
            </Button>
          )}
          <p className="text-xs text-slate-500">
            Lost your phone and your backup codes? Whoever runs the server can turn it off: <code>pnpm --filter @ecom/api two-factor:reset --super your@email</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
