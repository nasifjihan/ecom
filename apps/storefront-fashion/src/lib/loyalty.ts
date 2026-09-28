"use client";

/**
 * Wallet, cashback, loyalty level and refer-a-friend for the signed-in customer (API: modules/loyalty).
 * A shared link's ?ref=CODE is remembered in the browser and used once the visitor is signed in.
 */
import * as React from "react";
import { api } from "@ecom/api-client";
import { msg, toast, useT } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";

export interface WalletEntry {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  orderNumber: string | null;
  balanceAfter: number;
  at: string;
}

export interface MyLoyalty {
  wallet: { enabled: boolean; balance: number; maxPercent: number };
  cashback: { enabled: boolean; percent: number; minOrder: number; maxPerOrder: number | null };
  level: { name: string; color: string | null; discountPercent: number; cashbackPercent: number } | null;
  next: { name: string; needed: number; minSpend: number } | null;
  spend: number;
  referral: { enabled: boolean; code: string | null; friendGets: number; youGet: number; referredBy: boolean };
  history: WalletEntry[];
}

export interface MyReferral {
  enabled: boolean;
  code: string | null;
  youGet: number;
  friendGets: number;
  minOrder: number;
  earned: number;
  friends: { name: string; status: string; reward: number; at: string }[];
}

const TAG = { type: "Customer" as const, id: "LOYALTY" };

const loyaltyApi = api.injectEndpoints({
  endpoints: (b) => ({
    myLoyalty: b.query<MyLoyalty, void>({ query: () => "/storefront/account/loyalty", providesTags: [TAG] }),
    myReferral: b.query<MyReferral, void>({ query: () => "/storefront/account/referral", providesTags: [TAG] }),
    claimReferral: b.mutation<{ ok: boolean; friendGets: number; minOrder: number }, string>({
      query: (code) => ({ url: "/storefront/account/referral/claim", method: "POST", body: { code } }),
      invalidatesTags: [TAG],
    }),
  }),
  overrideExisting: false,
});

export const { useMyLoyaltyQuery, useMyReferralQuery, useClaimReferralMutation } = loyaltyApi;

export const WALLET_KIND_LABELS: Record<string, string> = {
  cashback: msg("Cashback"),
  cashback_reversed: msg("Cashback taken back"),
  order_payment: msg("Paid for an order"),
  order_payment_returned: msg("Returned from an order"),
  refund: msg("Refund"),
  referral: msg("Referral reward"),
  adjustment: msg("From the shop"),
};

const REF_KEY = "ref:v1";

/**
 * Remembers ?ref=CODE from a shared link, and once the visitor is signed in uses it (once).
 * Mounted in the root layout.
 */
export function ReferralCapture() {
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  const [claim] = useClaimReferralMutation();
  const tried = React.useRef(false);
  const t = useT();

  React.useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (code && /^[A-Za-z0-9]{3,20}$/.test(code)) window.localStorage.setItem(REF_KEY, code.toUpperCase());
    } catch {
      // Storage blocked: the link just won't be remembered.
    }
  }, []);

  React.useEffect(() => {
    if (!signedIn || tried.current) return;
    let code: string | null = null;
    try {
      code = window.localStorage.getItem(REF_KEY);
    } catch {
      return;
    }
    if (!code) return;
    tried.current = true;
    claim(code)
      .unwrap()
      .then((r) => {
        toast.success(t("Your friend's invite is saved"), {
          description: r.friendGets > 0 ? t("You'll get ৳{amount} in your wallet when your first order is delivered.", { amount: r.friendGets }) : undefined,
        });
      })
      .catch(() => undefined) // own code, already referred, not a new customer: nothing to say
      .finally(() => {
        try {
          window.localStorage.removeItem(REF_KEY);
        } catch {
          // ignore
        }
      });
  }, [signedIn, claim, t]);

  return null;
}
