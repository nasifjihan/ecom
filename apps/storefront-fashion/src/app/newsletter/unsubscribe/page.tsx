"use client";

/**
 * Leaving the newsletter from an email's link (?token=). It waits for a click, so mail
 * scanners that open links don't take people off the list.
 */
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailX } from "lucide-react";
import { Button, Card, CardContent, apiErrorMessage, useT, useUnsubscribeNewsletterMutation } from "@ecom/storefront-base";

export default function UnsubscribePage() {
  const token = useSearchParams().get("token") ?? "";
  const [unsubscribe, { data, isLoading, error }] = useUnsubscribeNewsletterMutation();
  const t = useT();

  return (
    <div className="container max-w-lg py-12">
      <Card>
        <CardContent className="space-y-4 p-6 text-center">
          <MailX className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">{t("Unsubscribe from our newsletter")}</h1>
          {!token ? (
            <p className="text-sm text-muted-foreground">{t("This link is incomplete. Use the unsubscribe link at the bottom of our email.")}</p>
          ) : data ? (
            <p role="status" className="text-sm">{t("{email} won't get our newsletter any more.", { email: data.email })}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("You'll stop getting offers and news by email. Order emails still come.")}</p>
              <Button onClick={() => void unsubscribe(token)} disabled={isLoading}>
                {isLoading ? t("Please wait…") : t("Unsubscribe")}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {apiErrorMessage(error, t("This unsubscribe link didn't work."))}
                </p>
              )}
            </>
          )}
          <Link href="/" className="block text-sm text-primary underline-offset-4 hover:underline">{t("Back to the shop")}</Link>
        </CardContent>
      </Card>
    </div>
  );
}
