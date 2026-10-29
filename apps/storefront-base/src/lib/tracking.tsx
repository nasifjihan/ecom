"use client";

/**
 * Facebook Pixel and Google Analytics 4 (Online Store > Theme > Tracking). Loads only the IDs the
 * store set; track() sends the shop events to whichever is loaded and does nothing otherwise.
 */
import * as React from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
    gtag?: Gtag;
  }
}

export interface TrackedItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

type ShopEvent =
  | { name: "view_item"; item: TrackedItem }
  | { name: "add_to_cart"; item: TrackedItem }
  | { name: "begin_checkout"; items: TrackedItem[]; value: number }
  | { name: "purchase"; items: TrackedItem[]; value: number; orderRef: string };

const PIXEL_NAMES = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" } as const;

export function track(e: ShopEvent) {
  if (typeof window === "undefined") return;
  const items = "items" in e ? e.items : [e.item];
  const value = "value" in e ? e.value : e.item.price * e.item.qty;
  window.fbq?.(
    "track",
    PIXEL_NAMES[e.name],
    { content_ids: items.map((i) => i.id), content_type: "product", contents: items.map((i) => ({ id: i.id, quantity: i.qty })), value, currency: "BDT" },
    // The same order sent twice (a reload of the thank-you page) is counted once.
    e.name === "purchase" ? { eventID: e.orderRef } : undefined,
  );
  window.gtag?.("event", e.name, {
    currency: "BDT",
    value,
    ...(e.name === "purchase" ? { transaction_id: e.orderRef } : {}),
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty })),
  });
}

/** A page view on every client-side page change (the first one is sent by the snippets). */
function PageViews() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
    window.gtag?.("event", "page_view", { page_location: window.location.href });
  }, [path, query]);
  return null;
}

const PIXEL = /^\d{8,20}$/;
const GA = /^G-[A-Z0-9]{4,20}$/;

export function Tracking({ facebookPixelId, googleAnalyticsId }: { facebookPixelId?: string; googleAnalyticsId?: string }) {
  // Checked again here: the IDs go into inline scripts.
  const pixel = facebookPixelId && PIXEL.test(facebookPixelId) ? facebookPixelId : null;
  const ga = googleAnalyticsId && GA.test(googleAnalyticsId) ? googleAnalyticsId : null;
  if (!pixel && !ga) return null;
  return (
    <>
      {pixel && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      <React.Suspense>
        <PageViews />
      </React.Suspense>
    </>
  );
}
