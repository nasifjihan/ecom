"use client";

/**
 * A bar fixed to the bottom of the screen on phones, for the one button a page is about
 * (add to cart, checkout, place order), so it never scrolls away. Hidden from lg up.
 * It tells the rest of the page how tall it is (--bar on <html>): the floating buttons sit above
 * it, and the page gets that much room at the bottom so the bar never covers the footer.
 */
import * as React from "react";
import { cn } from "@ecom/storefront-base";

export function MobileBar({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--bar", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--bar");
    };
  }, []);
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
