"use client";

/**
 * The floating WhatsApp / Messenger button (Settings → Storefronts). On a product page the WhatsApp
 * message names the product and links to it; elsewhere it's a plain hello.
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import { cn, useCompare, useT } from "@ecom/storefront-base";

import type { ChatButtonSettings } from "@/lib/content";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.4 2 2 6.1 2 11.6c0 2.9 1.2 5.4 3.1 7.1V22l2.9-1.6c.9.3 2 .4 3 .4 5.6 0 10-4.1 10-9.6S17.6 2 12 2Zm1 12.9-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8Z" />
    </svg>
  );
}

/** Back to the top, once the shopper has scrolled a screen or so down. */
function BackToTop() {
  const t = useT();
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const on = () => setShow(window.scrollY > window.innerHeight);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      aria-label={t("Back to top")}
      className="flex h-11 w-11 items-center justify-center rounded-full border bg-background text-foreground shadow-lg transition-colors hover:bg-accent"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

/** The floating buttons, bottom corner: back to top above the chat button (Settings → Storefronts). */
export function ChatButton({ settings }: { settings: ChatButtonSettings | null | undefined }) {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = React.useState(false);
  // Sit above the compare bar while it shows (it hides on the compare page).
  const comparing = useCompare().items.length > 0 && path !== "/compare";
  // Checkout keeps the screen clear for the order form.
  if (path.startsWith("/checkout")) return null;
  const chat = !!settings?.enabled;

  const waText = () => {
    // The product's name is the page's main heading on a product page.
    const name = path.startsWith("/products/") ? document.querySelector("h1")?.textContent?.trim() : null;
    return name ? t("Hi, I'd like to ask about {product}: {link}", { product: name, link: window.location.href }) : t("Hi, I have a question.");
  };
  const links = (chat
    ? [
        settings!.whatsapp && { key: "wa", label: "WhatsApp", icon: <WhatsAppIcon />, tone: "bg-[#25D366]", href: () => `https://wa.me/${settings!.whatsapp}?text=${encodeURIComponent(waText())}` },
        settings!.messenger && { key: "fb", label: "Messenger", icon: <MessengerIcon />, tone: "bg-[#0084FF]", href: () => `https://m.me/${settings!.messenger}` },
      ]
    : []
  ).filter(Boolean) as { key: string; label: string; icon: React.ReactNode; tone: string; href: () => string }[];
  const go = (l: (typeof links)[number]) => window.open(l.href(), "_blank", "noopener,noreferrer");
  const one = links.length === 1 ? links[0]! : null;

  return (
    <div className={cn("fixed z-40 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]", comparing ? "bottom-20" : "bottom-4", settings?.side === "left" ? "left-4 items-start" : "right-4")}>
      <BackToTop />
      {open &&
        links.map((l) => (
          <button key={l.key} type="button" onClick={() => go(l)} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg", l.tone)}>
            {l.icon} {l.label}
          </button>
        ))}
      {links.length > 0 && (
        <button
          type="button"
          onClick={() => (one ? go(one) : setOpen((o) => !o))}
          aria-label={one ? t("Chat with us on {app}", { app: one.label }) : open ? t("Close") : t("Chat with us")}
          aria-expanded={one ? undefined : open}
          className={cn("flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105", one ? one.tone : "bg-primary")}
        >
          {one ? one.icon : open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
      )}
    </div>
  );
}
