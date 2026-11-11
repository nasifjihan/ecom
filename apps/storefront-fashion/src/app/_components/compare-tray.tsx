"use client";

/**
 * The products picked to compare. From md up: a bar at the bottom with thumbnails. On phones: one
 * small button ("Compare (2)") in the corner the chat button doesn't use, so it never covers the page
 * or a fixed buy bar; products are removed on the compare page there.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCompareArrows, X } from "lucide-react";
import { Button, MAX_COMPARE, clearCompare, cn, removeFromCompare, useCompare, useT } from "@ecom/storefront-base";

export function CompareTray({ chatSide }: { chatSide?: "left" | "right" | null }) {
  const t = useT();
  const path = usePathname();
  const { items } = useCompare();
  if (!items.length || path === "/compare" || path.startsWith("/checkout")) return null;
  return (
    <>
      <Link
        href="/compare"
        style={{ bottom: "calc(var(--bar, 0px) + 1rem)" }}
        className={cn(
          "fixed z-40 mb-[env(safe-area-inset-bottom)] inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xl md:hidden",
          chatSide === "left" ? "right-4" : "left-4",
        )}
      >
        <GitCompareArrows className="h-4 w-4" />
        {t("Compare ({n})", { n: items.length })}
      </Link>

      <div className="fixed inset-x-0 bottom-0 z-30 hidden border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:block" role="region" aria-label={t("Compare products")}>
        <div className="container flex items-center gap-3 py-2 pr-20">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {items.map((i) => (
              <div key={i.id} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted" title={i.title}>
                {i.image && <img src={i.image} alt={i.title} className="h-full w-full object-cover" />}
                <button
                  type="button"
                  onClick={() => removeFromCompare(i.id)}
                  aria-label={t("Remove {title}", { title: i.title })}
                  className="absolute right-0 top-0 rounded-bl bg-background/90 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <span className="text-xs text-muted-foreground">{t("{n} of {max}", { n: items.length, max: MAX_COMPARE })}</span>
          </div>
          <button type="button" onClick={clearCompare} className="text-xs text-muted-foreground hover:underline">
            {t("Clear")}
          </button>
          <Button asChild size="sm" disabled={items.length < 2}>
            <Link href="/compare">{t("Compare ({n})", { n: items.length })}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
