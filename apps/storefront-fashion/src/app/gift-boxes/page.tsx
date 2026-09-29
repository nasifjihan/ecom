import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { formatMoney } from "@ecom/storefront-base";
import { serverT } from "@/lib/content";
import { getGiftBoxes } from "@/lib/giftboxes";

export const metadata: Metadata = { title: "Gift boxes", alternates: { canonical: "/gift-boxes" } };

/** The gift boxes shoppers can fill themselves. */
export default async function GiftBoxesPage() {
  const [boxes, t] = await Promise.all([getGiftBoxes(), serverT()]);
  return (
    <div className="container py-10 md:py-14">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("Gift boxes")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("Pick a box, fill it with the things they'll love and add a message. We pack it and send it.")}</p>
      {!boxes?.length ? (
        <div className="mt-10 rounded-xl border p-10 text-center text-muted-foreground">
          <Gift className="mx-auto mb-3 h-10 w-10 text-primary/50" aria-hidden />
          {t("No gift boxes right now. Please check back soon.")}
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((b) => (
            <li key={b.slug}>
              <Link href={`/gift-boxes/${b.slug}`} className="group block overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-soft">
                <div className="flex aspect-[4/3] items-center justify-center bg-primary/5">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <Gift className="h-16 w-16 text-primary/40" aria-hidden />
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-semibold group-hover:text-primary">{b.name}</h2>
                  {b.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>}
                  <p className="mt-3 text-sm">
                    {t("{min}–{max} items", { min: b.minItems, max: b.maxItems })} · {t("Box from {price}", { price: formatMoney(b.boxPrice, "BDT") })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
