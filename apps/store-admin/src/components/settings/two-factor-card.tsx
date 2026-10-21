"use client";

/**
 * Settings → Profile: two-step sign-in. Setting up: scan the QR in an authenticator app, type the
 * code it shows, then keep the 10 backup codes (shown once). Turning it off, or a new set of
 * backup codes, needs the password.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton } from "@/components/ui";
import { Field } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  useConfirmTwoFactorMutation,
  useDisableTwoFactorMutation,
  useNewBackupCodesMutation,
  useStartTwoFactorMutation,
  useTwoFactorStatusQuery,
  type TwoFactorSetup,
} from "@/lib/features/settings/two-factor-api-slice";

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join("\n");
  const save = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`Backup codes for two-step sign-in. Each works once.\n\n${text}\n`], { type: "text/plain" }));
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}>
          <Copy className="mr-1.5 h-4 w-4" /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={save}>
          <Download className="mr-1.5 h-4 w-4" /> Download
        </Button>
        <Button type="button" size="sm" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorCard() {
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

  const onStart = async () => {
    try {
      setSetup(await start().unwrap());
      setCode("");
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await confirm({ code: code.trim() }).unwrap();
      setSetup(null);
      setCodes(res.backupCodes);
      toast.success("Two-step sign-in is on");
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (asking === "disable") {
        await disable({ password }).unwrap();
        toast.success("Two-step sign-in is off");
      } else {
        setCodes((await renew({ password }).unwrap()).backupCodes);
      }
      setAsking(null);
      setPassword("");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Two-step sign-in
          {data?.enabled && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">On</Badge>}
        </CardTitle>
        <CardDescription>
          After your password, sign-in also asks for a code from an authenticator app on your phone (Google Authenticator, Microsoft
          Authenticator, Authy…), so a stolen password alone can&apos;t get in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <Skeleton className="h-10 w-48" />
        ) : codes ? (
          <BackupCodes codes={codes} onDone={() => setCodes(null)} />
        ) : setup ? (
          <form onSubmit={onConfirm} className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <img src={setup.qr} alt="QR code to scan with your authenticator app" width={180} height={180} className="rounded-md border bg-white p-1" />
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                <li>Open your authenticator app and add an account.</li>
                <li>Scan this QR code, or type the key below.</li>
                <li>Type the 6-digit code the app shows.</li>
              </ol>
              <p className="break-all font-mono text-xs text-slate-500">
                Key: {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <Field label="Code from the app" htmlFor="tf-code">
                <Input
                  id="tf-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="max-w-[10rem] tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
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
            <Field label="Your password" htmlFor="tf-password" hint={asking === "disable" ? "To turn two-step sign-in off." : "To make new backup codes. The old ones stop working."}>
              <Input id="tf-password" type="password" autoComplete="current-password" className="max-w-sm" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
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
      </CardContent>
    </Card>
  );
}
