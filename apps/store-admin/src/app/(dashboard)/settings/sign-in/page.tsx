"use client";

/**
 * Customer sign-in: the ways customers can sign in on the storefront besides email and password:
 * a code by email, Google and Facebook (keys stored encrypted, only their last 4 characters
 * shown), and test mode for trying the buttons before the apps exist. Phone codes need an SMS
 * provider, so their switch stays on the SMS page. Storefronts can hide the social buttons.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, FlaskConical, LogIn } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useLoginSettingsQuery,
  useSaveLoginSettingsMutation,
  type LoginSettings,
  type SocialProvider,
} from "@/lib/features/settings/login-settings-api-slice";

const PROVIDERS: Record<SocialProvider, { name: string; idLabel: string; secretLabel: string; where: string; whereUrl: string }> = {
  google: {
    name: "Google",
    idLabel: "Client ID",
    secretLabel: "Client secret",
    where: "Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application), under \"Authorised redirect URIs\"",
    whereUrl: "https://console.cloud.google.com/apis/credentials",
  },
  facebook: {
    name: "Facebook",
    idLabel: "App ID",
    secretLabel: "App secret",
    where: "Meta for Developers → your app → Facebook Login → Settings, under \"Valid OAuth Redirect URIs\"",
    whereUrl: "https://developers.facebook.com/apps",
  },
};

interface ProviderForm {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

const fromSettings = (s: LoginSettings, p: SocialProvider): ProviderForm => ({
  enabled: s[p].enabled,
  clientId: s[p].clientId ?? "",
  clientSecret: "",
});

function Form({ s, canEdit }: { s: LoginSettings; canEdit: boolean }) {
  const [emailCode, setEmailCode] = useState(s.emailCode);
  const [testMode, setTestMode] = useState(s.socialTestMode);
  const [social, setSocial] = useState({ google: fromSettings(s, "google"), facebook: fromSettings(s, "facebook") });
  const [save, { isLoading }] = useSaveLoginSettingsMutation();
  useEffect(() => {
    setEmailCode(s.emailCode);
    setTestMode(s.socialTestMode);
    setSocial({ google: fromSettings(s, "google"), facebook: fromSettings(s, "facebook") });
  }, [s]);

  const setP = (p: SocialProvider, v: Partial<ProviderForm>) => setSocial((o) => ({ ...o, [p]: { ...o[p], ...v } }));
  const changed =
    emailCode !== s.emailCode ||
    testMode !== s.socialTestMode ||
    (["google", "facebook"] as const).some(
      (p) => social[p].enabled !== s[p].enabled || social[p].clientId !== (s[p].clientId ?? "") || social[p].clientSecret !== "",
    );

  async function submit() {
    try {
      const provider = (p: SocialProvider) => ({
        enabled: social[p].enabled,
        clientId: social[p].clientId.trim() || null,
        ...(social[p].clientSecret.trim() ? { clientSecret: social[p].clientSecret.trim() } : {}),
      });
      await save({
        emailCode,
        ...(s.testModeAllowed ? { socialTestMode: testMode } : {}),
        google: provider("google"),
        facebook: provider("facebook"),
      }).unwrap();
      toast.success("Sign-in settings saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  const copy = (v: string) =>
    void navigator.clipboard.writeText(v).then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy; select the address and copy it by hand"),
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email and password</CardTitle>
          <CardDescription>Always on. Customers can also reset a forgotten password by email.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Code by email</CardTitle>
          <CardDescription>
            Customers type their email and get a 6-digit code instead of using a password. A new email gets an
            account automatically. The wording is in Settings → Emails → &quot;Sign-in code&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Toggle
            checked={emailCode}
            onChange={setEmailCode}
            label="Customers can sign in with a code sent to their email"
            hint="Codes last 5 minutes and work once. An address can get a new code once a minute, 5 an hour; 5 wrong tries end a code. The sent-email log hides the code."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Code by SMS</CardTitle>
          <CardDescription>
            {s.phoneOtp
              ? "On. Customers can sign in with a code sent to their phone."
              : s.smsProvider === "log"
                ? "Off. It needs an SMS provider that sends messages."
                : "Off."}{" "}
            <Link href="/settings/sms" className="text-blue-600 hover:underline">
              Change it in SMS settings
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>

      {(["google", "facebook"] as const).map((p) => {
        const info = PROVIDERS[p];
        const f = social[p];
        return (
          <Card key={p}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Sign in with {info.name}
                {s[p].ready && <Badge variant="secondary">On</Badge>}
              </CardTitle>
              <CardDescription>
                Customers tap &quot;Continue with {info.name}&quot;. The first time, their account is found by the email{" "}
                {info.name} has confirmed, or a new one is made. The secret is stored encrypted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle checked={f.enabled} onChange={(v) => setP(p, { enabled: v })} label={`Show "Continue with ${info.name}"`} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={info.idLabel}>
                  <Input value={f.clientId} onChange={(e) => setP(p, { clientId: e.target.value })} autoComplete="off" />
                </Field>
                <Field label={info.secretLabel} hint={s[p].secretHint ? `Stored: ${s[p].secretHint}. Leave blank to keep it.` : undefined}>
                  <Input
                    type="password"
                    value={f.clientSecret}
                    onChange={(e) => setP(p, { clientSecret: e.target.value })}
                    autoComplete="new-password"
                    placeholder={s[p].secretHint ?? ""}
                  />
                </Field>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                <p>
                  Add {s.redirectUris.length === 1 ? "this address" : "these addresses"} in{" "}
                  <a href={info.whereUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {info.where}
                  </a>
                  :
                </p>
                {s.redirectUris.length ? (
                  s.redirectUris.map((u) => (
                    <div key={u} className="flex items-center gap-2">
                      <code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">{u}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(u)} aria-label={`Copy ${u}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p>
                    Add your shop&apos;s web address in{" "}
                    <Link href="/online-store/storefronts" className="text-blue-600 hover:underline">
                      Storefronts
                    </Link>{" "}
                    first.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {s.testModeAllowed && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" /> Test mode
            </CardTitle>
            <CardDescription>
              For trying the buttons before the Google or Facebook app exists. Google and Facebook aren&apos;t called: the
              button signs in a made-up account (google.tester@example.com or facebook.tester@example.com). It can&apos;t be
              used on the live site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Toggle checked={testMode} onChange={setTestMode} label="Use test mode for the buttons that are switched on" />
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={isLoading || !changed}>
            {isLoading ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SignInSettingsPage() {
  const { data, isLoading } = useLoginSettingsQuery();
  const { can } = useCan();
  return (
    <div className="space-y-6">
      <PageTitle icon={LogIn} title="Customer sign-in" description="The ways customers can sign in on your storefront." />
      {isLoading || !data ? <Skeleton className="h-64" /> : <Form s={data} canEdit={can("settings.edit")} />}
    </div>
  );
}
