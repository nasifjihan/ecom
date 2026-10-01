"use client";

/**
 * Checkout: "This order is a gift". The address above becomes the recipient's; the buyer gives
 * their own name and phone (the billing details), a card message and the name it's from. Prices
 * stay off the packing slip unless the buyer wants them.
 */
import { Gift } from "lucide-react";
import { Input, Label, useT } from "@ecom/storefront-base";

export const GIFT_MESSAGE_MAX = 300;

export interface GiftState {
  on: boolean;
  message: string;
  from: string;
  hidePrices: boolean;
  buyerFirstName: string;
  buyerLastName: string;
  buyerPhone: string;
}

export const NO_GIFT: GiftState = { on: false, message: "", from: "", hidePrices: true, buyerFirstName: "", buyerLastName: "", buyerPhone: "" };

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

/** What's missing before a gift order can be placed, or null. */
export function giftProblem(g: GiftState): string | null {
  if (!g.on) return null;
  if (!g.buyerFirstName.trim()) return "Enter your own name (the buyer)";
  if (!BD_MOBILE.test(g.buyerPhone.replace(/[\s-]/g, ""))) return "Enter your own mobile number, e.g. 01712345678";
  if (g.message.length > GIFT_MESSAGE_MAX) return "The gift message is too long";
  return null;
}

export function GiftSection({ value, onChange, cod }: { value: GiftState; onChange: (v: GiftState) => void; cod: boolean }) {
  const t = useT();
  const set = <K extends keyof GiftState>(k: K, v: GiftState[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4" data-testid="gift-section">
      <div className="flex items-start gap-3">
        <input type="checkbox" id="is-gift" className="mt-1 h-4 w-4 accent-primary" checked={value.on} onChange={(e) => set("on", e.target.checked)} />
        <div>
          <Label htmlFor="is-gift" className="flex cursor-pointer items-center gap-1.5 font-semibold">
            <Gift className="h-4 w-4 text-primary" /> {t("This order is a gift")}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("We'll deliver to the address above. Add a card message, and we can leave prices off the slip in the box.")}</p>
        </div>
      </div>
      {value.on && (
        <div className="space-y-3 pl-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="buyer-first">{t("Your first name")}</Label>
              <Input id="buyer-first" value={value.buyerFirstName} maxLength={80} onChange={(e) => set("buyerFirstName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="buyer-last">{t("Your last name")}</Label>
              <Input id="buyer-last" value={value.buyerLastName} maxLength={80} onChange={(e) => set("buyerLastName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="buyer-phone">{t("Your mobile")}</Label>
              <Input id="buyer-phone" inputMode="tel" placeholder="01XXXXXXXXX" value={value.buyerPhone} maxLength={20} onChange={(e) => set("buyerPhone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gift-message">{t("Gift message (printed on a card)")}</Label>
            <textarea
              id="gift-message"
              rows={3}
              maxLength={GIFT_MESSAGE_MAX}
              value={value.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder={t("e.g. Eid Mubarak! With love")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-right text-xs text-muted-foreground">
              {value.message.length}/{GIFT_MESSAGE_MAX}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gift-from">{t("From")}</Label>
            <Input id="gift-from" value={value.from} maxLength={60} placeholder={value.buyerFirstName || t("Your name")} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="gift-hide" className="h-4 w-4 accent-primary" checked={value.hidePrices} onChange={(e) => set("hidePrices", e.target.checked)} />
            <Label htmlFor="gift-hide" className="cursor-pointer text-sm font-normal">
              {t("Leave prices off the packing slip")}
            </Label>
          </div>
          {cod && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">{t("With cash on delivery, the recipient pays when the gift arrives. Pay online to keep it a surprise.")}</p>}
        </div>
      )}
    </div>
  );
}
