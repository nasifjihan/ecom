"use client";

/** A cart reminder's link: puts the saved items back in the cart (on any device) and opens it. */
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCart, useT } from "@ecom/storefront-base";
import { setCartToken, toCartItems, useRecoverCartMutation } from "@/lib/saved-cart";

export default function RecoverCartPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const t = useT();
  const { items, replaceItems } = useCart();
  const [recover] = useRecoverCartMutation();
  const [failed, setFailed] = React.useState(false);
  const started = React.useRef(false);
  const current = React.useRef(items);
  current.current = items;

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    recover(token)
      .unwrap()
      .then((r) => {
        // Items already in this browser stay; the saved ones are added.
        const have = new Set(current.current.map((i) => `${i.productId}:${i.variantId ?? ""}`));
        replaceItems([...current.current, ...toCartItems(r.items).filter((i) => !have.has(`${i.productId}:${i.variantId ?? ""}`))]);
        if (r.token) setCartToken(r.token);
        router.replace("/cart");
      })
      .catch(() => setFailed(true));
  }, [token, recover, replaceItems, router]);

  return (
    <div className="container flex min-h-[40vh] items-center justify-center py-16 text-center">
      {failed ? (
        <p className="text-muted-foreground">{t("This cart link has expired.")}</p>
      ) : (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("Getting your cart…")}
        </p>
      )}
    </div>
  );
}
