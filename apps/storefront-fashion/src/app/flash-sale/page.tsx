"use client";

/** Every running flash sale with its products and a countdown. */
import * as React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Button, ProductGrid, useT } from "@ecom/storefront-base";
import { useFlashSalePageQuery } from "@/lib/engagement";
import { useProductGridActions } from "../_components/product-actions";

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  const t = useT();
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono tabular-nums" aria-label={t("Time left")}>
      {left === 0 ? t("Ended") : `${d ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`}
    </span>
  );
}

export default function FlashSalePage() {
  const { data, isLoading } = useFlashSalePageQuery();
  const actions = useProductGridActions();
  const t = useT();

  return (
    <div className="container space-y-10 py-6 md:py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
        <Zap className="h-7 w-7 text-rose-500" /> {t("Flash sale")}
      </h1>
      {isLoading ? (
        <ProductGrid loading skeletonCount={8} />
      ) : !data?.length ? (
        <div className="rounded-2xl border p-10 text-center">
          <p className="mb-4 text-muted-foreground">{t("No flash sale is running right now. Check back soon.")}</p>
          <Button asChild>
            <Link href="/products">{t("Browse products")}</Link>
          </Button>
        </div>
      ) : (
        data.map((sale) => (
          <section key={sale.slug} className="space-y-4" aria-labelledby={`sale-${sale.slug}`}>
            {sale.banner?.image && <img src={sale.banner.image} alt="" className="aspect-[21/7] w-full rounded-2xl object-cover" />}
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-rose-50 p-4 dark:bg-rose-500/10">
              <div>
                <h2 id={`sale-${sale.slug}`} className="text-xl font-bold">
                  {sale.name}
                </h2>
                {sale.description && <p className="text-sm text-muted-foreground">{sale.description}</p>}
              </div>
              <p className="text-sm">
                {t("Ends in")} <span className="text-lg font-bold text-rose-600"><Countdown endsAt={sale.endsAt} /></span>
              </p>
            </div>
            <ProductGrid products={sale.products} cols={4} {...actions} />
          </section>
        ))
      )}
    </div>
  );
}
