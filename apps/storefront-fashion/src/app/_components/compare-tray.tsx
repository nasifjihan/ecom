"use client";

/** The products picked to compare, as a small bar at the bottom with a link to the compare page. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button, MAX_COMPARE, clearCompare, removeFromCompare, useCompare, useT } from "@ecom/storefront-base";

export function CompareTray() {
  const t = useT();
  const path = usePathname();
  const { items } = useCompare();
  if (!items.length || path === "/compare" || path.startsWith("/checkout")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur" role="region" aria-label={t("Compare products")}>
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
          <span className="hidden text-xs text-muted-foreground sm:inline">{t("{n} of {max}", { n: items.length, max: MAX_COMPARE })}</span>
        </div>
        <button type="button" onClick={clearCompare} className="text-xs text-muted-foreground hover:underline">
          {t("Clear")}
        </button>
        <Button asChild size="sm" disabled={items.length < 2}>
          <Link href="/compare">{t("Compare ({n})", { n: items.length })}</Link>
        </Button>
      </div>
    </div>
  );
}
