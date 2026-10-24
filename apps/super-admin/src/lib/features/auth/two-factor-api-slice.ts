"use client";

/** Two-step sign-in for the signed-in platform admin (API: /super/me/two-factor), and resetting a store admin's. */
import { api } from "@ecom/api-client";

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesLeft: number;
}
export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  /** PNG data URL of the QR code. */
  qr: string;
}

const TAG = { type: "Me" as const, id: "TWO_FACTOR" };

export const superTwoFactorApi = api.injectEndpoints({
  endpoints: (b) => ({
    twoFactorStatus: b.query<TwoFactorStatus, void>({ query: () => "/super/me/two-factor", providesTags: [TAG] }),
    startTwoFactor: b.mutation<TwoFactorSetup, void>({ query: () => ({ url: "/super/me/two-factor/start", method: "POST" }) }),
    confirmTwoFactor: b.mutation<{ backupCodes: string[]; accessToken: string }, { code: string }>({
      query: (body) => ({ url: "/super/me/two-factor/confirm", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    disableTwoFactor: b.mutation<{ enabled: false }, { password: string }>({
      query: (body) => ({ url: "/super/me/two-factor/disable", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    newBackupCodes: b.mutation<{ backupCodes: string[]; accessToken: string }, { password: string }>({
      query: (body) => ({ url: "/super/me/two-factor/backup-codes", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    /** A store admin who lost their phone (e.g. a shop's only owner). */
    resetStoreAdminTwoFactor: b.mutation<void, string>({
      query: (id) => ({ url: `/super/admin-users/${id}/two-factor/reset`, method: "POST" }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useTwoFactorStatusQuery,
  useStartTwoFactorMutation,
  useConfirmTwoFactorMutation,
  useDisableTwoFactorMutation,
  useNewBackupCodesMutation,
  useResetStoreAdminTwoFactorMutation,
} = superTwoFactorApi;
