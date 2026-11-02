"use client";

/** "No more cart reminders" from a reminder email. Asks first, so a link preview can't do it. */
import * as React from "react";
import { useParams } from "next/navigation";
import { Button, useT } from "@ecom/storefront-base";
import { useUnsubscribeCartMutation } from "@/lib/saved-cart";

export default function UnsubscribeCartPage() {
  const { token } = useParams<{ token: string }>();
  const t = useT();
  const [unsubscribe, { isLoading, isSuccess, isError }] = useUnsubscribeCartMutation();
  return (
    <div className="container flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16 text-center">
      {isSuccess ? (
        <p className="font-medium">{t("Done. We won't send you cart reminders any more.")}</p>
      ) : (
        <>
          <p>{t("Stop reminders about items left in your cart?")}</p>
          <Button onClick={() => void unsubscribe(token)} disabled={isLoading}>
            {t("Stop cart reminders")}
          </Button>
          {isError && <p className="text-sm text-destructive">{t("This link has expired.")}</p>}
        </>
      )}
    </div>
  );
}
