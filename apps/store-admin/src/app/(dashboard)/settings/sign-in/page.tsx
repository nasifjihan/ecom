"use client";

/**
 * Customer sign-in: the ways customers can sign in on the storefront besides email and password.
 * Phone codes need an SMS provider, so their switch stays on the SMS page.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useLoginSettingsQuery,
  useSaveLoginSettingsMutation,
  type LoginSettings,
} from "@/lib/features/settings/login-settings-api-slice";

function Form({ s, canEdit }: { s: LoginSettings; canEdit: boolean }) {
  const [emailCode, setEmailCode] = useState(s.emailCode);
  const [save, { isLoading }] = useSaveLoginSettingsMutation();
  useEffect(() => setEmailCode(s.emailCode), [s]);

  async function submit() {
    try {
      await save({ emailCode }).unwrap();
      toast.success("Sign-in settings saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

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

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={isLoading || emailCode === s.emailCode}>
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
