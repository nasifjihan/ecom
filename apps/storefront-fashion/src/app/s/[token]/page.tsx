"use client";

/** The "Stop" link in a campaign SMS. Asks first, so a link preview can't do it. */
import * as React from "react";
import { useParams } from "next/navigation";
import { Button, useT } from "@ecom/storefront-base";
import { useStopSmsMutation } from "@/lib/contact";

export default function StopSmsPage() {
  const { token } = useParams<{ token: string }>();
  const t = useT();
  const [stop, { isLoading, isSuccess, isError }] = useStopSmsMutation();
  return (
    <div className="container flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16 text-center">
      {isSuccess ? (
        <p className="font-medium">{t("Done. We won't send you offers by SMS any more. Order updates still come.")}</p>
      ) : (
        <>
          <p>{t("Stop getting offers from us by SMS?")}</p>
          <Button onClick={() => void stop(token)} disabled={isLoading}>
            {t("Stop offer SMS")}
          </Button>
          {isError && <p className="text-sm text-destructive">{t("This link has expired.")}</p>}
        </>
      )}
    </div>
  );
}
