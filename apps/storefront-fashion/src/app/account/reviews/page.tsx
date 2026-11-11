"use client";

/** My reviews: delivered products I haven't reviewed yet, and the reviews I wrote (with the shop's reply). */
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge, Button, msg, useT } from "@ecom/storefront-base";
import { AccountShell, formatDate } from "../_components";
import { useMyReviewsQuery } from "@/lib/engagement";

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">{src && <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />}</div>;
}

export default function MyReviewsPage() {
  const { data, isLoading, isError } = useMyReviewsQuery();
  const t = useT();

  return (
    <AccountShell title={msg("My reviews")} description={msg("Review what you bought, and see the reviews you wrote.")}>
      {isError ? (
        <p className="text-sm text-destructive">{t("Couldn't load your reviews. Please refresh the page.")}</p>
      ) : isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-8">
          {data.toReview.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">{t("Waiting for your review")}</h2>
              <ul className="grid gap-3 xl:grid-cols-2">
                {data.toReview.map((p) => (
                  <li key={p.productId} className="flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card p-3">
                    <Thumb src={p.image} alt={p.title} />
                    <div className="min-w-[8rem] flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{t("Order #{ref}", { ref: p.orderNumber })}</p>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/products/${p.slug}#reviews`}>{t("Write a review")}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-semibold">{t("Your reviews")}</h2>
            {data.reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <Star className="mx-auto mb-2 h-6 w-6" />
                {data.toReview.length ? t("You haven't written a review yet.") : t("Nothing to review yet. Once an order is delivered, you can review it here.")}
              </div>
            ) : (
              <ul className="space-y-3">
                {data.reviews.map((r) => (
                  <li key={r.id} className="flex gap-3 rounded-xl border bg-card p-4">
                    <Thumb src={r.image} alt={r.title} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/products/${r.slug}`} className="line-clamp-1 text-sm font-medium hover:underline">
                          {r.title}
                        </Link>
                        <Badge variant={r.shown ? "secondary" : "outline"}>{r.shown ? t("Shown on the product") : t("Waiting for approval")}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex" role="img" aria-label={t("{n} out of 5", { n: r.rating })}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={n <= r.rating ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-muted-foreground/40"} />
                          ))}
                        </span>
                        {formatDate(r.createdAt)}
                      </div>
                      {r.reviewTitle && <p className="text-sm font-medium">{r.reviewTitle}</p>}
                      {r.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>}
                      {r.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.photos.map((src) => (
                            <a key={src} href={src} target="_blank" rel="noreferrer" className="h-14 w-14 overflow-hidden rounded-md border">
                              <img src={src} alt={t("Review photo")} loading="lazy" className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {r.reply && (
                        <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                          <p className="text-xs font-semibold">{t("Reply from the shop")}</p>
                          <p className="whitespace-pre-line">{r.reply}</p>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AccountShell>
  );
}
