"use client";

/** Wallet, cashback, loyalty levels and refer-a-friend (API: modules/loyalty). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export interface LoyaltySettings {
  walletEnabled: boolean;
  walletMaxPercent: number;
  cashbackEnabled: boolean;
  cashbackPercent: number;
  cashbackMinOrder: number;
  cashbackMaxPerOrder: number | null;
  levelsEnabled: boolean;
  referralEnabled: boolean;
  referrerReward: number;
  refereeReward: number;
  referralMinOrder: number;
}

export interface LoyaltyLevel {
  id: string;
  name: string;
  minSpend: number;
  discountPercent: number;
  cashbackPercent: number;
  color: string | null;
  customers: number;
}

export interface LoyaltyOverview {
  settings: LoyaltySettings;
  levels: LoyaltyLevel[];
  stats: {
    walletBalance: number;
    customersWithBalance: number;
    cashbackGiven: number;
    referralRewards: number;
    spentFromWallets: number;
    referrals: Record<string, number>;
  };
}

export interface WalletEntry {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  orderId: string | null;
  orderNumber: string | null;
  balanceAfter: number;
  at: string;
}

export interface CustomerLoyalty {
  balance: number;
  spend: number;
  level: { name: string; color: string | null; discountPercent: number; cashbackPercent: number } | null;
  next: { name: string; needed: number; minSpend: number } | null;
  levelsEnabled: boolean;
  referral: {
    code: string | null;
    earned: number;
    friends: number;
    referredBy: { code: string; customerId: string; name: string } | null;
  };
  history: WalletEntry[];
}

export interface Referral {
  id: string;
  code: string;
  referrer: { id: string; name: string };
  friend: { id: string; name: string; phone: string | null } | null;
  order: { id: string; number: string; status: string } | null;
  status: "signed_up" | "ordered" | "rewarded";
  reward: number;
  at: string;
  rewardedAt: string | null;
}

export interface LevelInput {
  name: string;
  minSpend: number;
  discountPercent: number;
  cashbackPercent: number;
  color?: string | null;
}

const T = { type: "Customer" as const, id: "LOYALTY" };

export const loyaltyApi = api.injectEndpoints({
  endpoints: (b) => ({
    loyaltyOverview: b.query<LoyaltyOverview, void>({ query: () => "/admin/loyalty", providesTags: [T] }),
    updateLoyaltySettings: b.mutation<LoyaltyOverview, Partial<LoyaltySettings>>({
      query: (body) => ({ url: "/admin/loyalty/settings", method: "PATCH", body }),
      invalidatesTags: [T],
    }),
    saveLoyaltyLevel: b.mutation<LoyaltyOverview, LevelInput & { id?: string }>({
      query: ({ id, ...body }) => ({ url: id ? `/admin/loyalty/levels/${id}` : "/admin/loyalty/levels", method: id ? "PATCH" : "POST", body }),
      invalidatesTags: [T],
    }),
    deleteLoyaltyLevel: b.mutation<LoyaltyOverview, string>({
      query: (id) => ({ url: `/admin/loyalty/levels/${id}`, method: "DELETE" }),
      invalidatesTags: [T],
    }),
    referrals: b.query<Paginated<Referral>, { status?: Referral["status"]; page?: number }>({
      query: (params) => ({ url: "/admin/loyalty/referrals", params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) }),
      transformResponse: (items: Referral[], meta) => toPaginated(items, meta),
      providesTags: [T],
    }),
    customerLoyalty: b.query<CustomerLoyalty, string>({
      query: (id) => `/admin/loyalty/customers/${id}`,
      providesTags: (_r, _e, id) => [T, { type: "Customer" as const, id }],
    }),
    adjustWallet: b.mutation<CustomerLoyalty, { id: string; amount: number; note: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/loyalty/customers/${id}/wallet`, method: "POST", body }),
      invalidatesTags: (_r, _e, { id }) => [T, { type: "Customer" as const, id }],
    }),
  }),
});

export const {
  useLoyaltyOverviewQuery,
  useUpdateLoyaltySettingsMutation,
  useSaveLoyaltyLevelMutation,
  useDeleteLoyaltyLevelMutation,
  useReferralsQuery,
  useCustomerLoyaltyQuery,
  useAdjustWalletMutation,
} = loyaltyApi;

export const WALLET_KIND_LABELS: Record<string, string> = {
  cashback: "Cashback",
  cashback_reversed: "Cashback taken back",
  order_payment: "Paid for an order",
  order_payment_returned: "Returned from an order",
  refund: "Refund to wallet",
  referral: "Referral reward",
  adjustment: "Added / taken by staff",
};

export const REFERRAL_STATUS_LABELS: Record<Referral["status"], string> = {
  signed_up: "Joined",
  ordered: "First order placed",
  rewarded: "Rewarded",
};
