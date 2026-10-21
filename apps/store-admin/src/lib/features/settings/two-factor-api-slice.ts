"use client";

/** Two-step sign-in for the signed-in staff member (API: /admin/me/two-factor). */
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

export const twoFactorApi = api.injectEndpoints({
  endpoints: (b) => ({
    twoFactorStatus: b.query<TwoFactorStatus, void>({ query: () => "/admin/me/two-factor", providesTags: [TAG] }),
    startTwoFactor: b.mutation<TwoFactorSetup, void>({
      query: () => ({ url: "/admin/me/two-factor/start", method: "POST" }),
    }),
    confirmTwoFactor: b.mutation<{ backupCodes: string[] }, { code: string }>({
      query: (body) => ({ url: "/admin/me/two-factor/confirm", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    disableTwoFactor: b.mutation<{ enabled: false }, { password: string }>({
      query: (body) => ({ url: "/admin/me/two-factor/disable", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    newBackupCodes: b.mutation<{ backupCodes: string[] }, { password: string }>({
      query: (body) => ({ url: "/admin/me/two-factor/backup-codes", method: "POST", body }),
      invalidatesTags: [TAG],
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
} = twoFactorApi;
