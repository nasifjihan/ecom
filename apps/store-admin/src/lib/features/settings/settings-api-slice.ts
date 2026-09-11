"use client";

import { api } from "@ecom/api-client";
import type { AdminRole } from "@ecom/shared-types";

export interface SettingsKeyValue {
  [key: string]: string | number | boolean | null | undefined | SettingsKeyValue;
}

export interface StoreGeneralSettings {
  storeName?: string;
  storeLegalName?: string;
  storeSlug?: string;
  storeDescription?: string;
  industry?: string;
  defaultCurrency?: string;
  currencyPosition?: "left" | "right" | "left_space" | "right_space";
  defaultWeightUnit?: "kg" | "g" | "lb" | "oz";
  defaultDimensionUnit?: "cm" | "in";
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  weekStartsOn?: "monday" | "sunday";
}

export interface StoreAddressSettings {
  addressLine1?: string;
  addressLine2?: string;
  country?: string;
  state?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  vatNumber?: string;
  companyNumber?: string;
}

export interface StoreMediaSettings {
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  mediumWidth?: number;
  mediumHeight?: number;
  largeWidth?: number;
  largeHeight?: number;
  uploadQuality?: number;
  webpCompression?: boolean;
  watermarkEnabled?: boolean;
  watermarkPosition?:
    | "top_left"
    | "top_center"
    | "top_right"
    | "middle_left"
    | "middle_center"
    | "middle_right"
    | "bottom_left"
    | "bottom_center"
    | "bottom_right";
  watermarkImage?: string;
  watermarkOpacity?: number;
}

export interface StoreLegalSettings {
  refundPolicy?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  shippingPolicy?: string;
  cookieNoticeEnabled?: boolean;
  cookieNoticeMessage?: string;
  cookieNoticeButtonText?: string;
}

export type SettingsSection =
  | "general"
  | "address"
  | "media"
  | "legal"
  | "products"
  | "inventory"
  | "taxes"
  | "shipping"
  | "checkout"
  | "payments"
  | "order-statuses"
  | "emails"
  | "team"
  | "roles"
  | "security"
  | "integrations"
  | "api"
  | "webhooks"
  | "activity-log";

export interface MyProfile {
  id: string | number;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  phone?: string;
  role?: AdminRole | string;
  avatar?: string | null;
  bio?: string;
  twoFactorEnabled?: boolean;
}

export interface UpdateMyProfileDto {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  avatar?: string | null;
  bio?: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface TeamMember {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole | string;
  avatar?: string | null;
  status: "active" | "invited" | "disabled";
  invitedAt?: string;
  joinedAt?: string;
  lastLoginAt?: string;
}

export interface InviteTeamMemberDto {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole | string;
}

export interface UpdateTeamMemberRoleDto {
  role: AdminRole | string;
}

export const settingsApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<SettingsKeyValue, SettingsSection>({
      query: (section) => ({
        url: `/admin/settings/${section}`,
        method: "GET",
      }),
      providesTags: (_, __, section) => [{ type: "Store", id: `settings:${section}` }],
    }),
    updateSettings: builder.mutation<
      SettingsKeyValue,
      { section: SettingsSection; values: SettingsKeyValue }
    >({
      query: ({ section, values }) => ({
        url: `/admin/settings/${section}`,
        method: "PUT",
        body: values,
      }),
      invalidatesTags: (_, __, { section }) => [
        { type: "Store", id: `settings:${section}` },
      ],
    }),
    getMyProfile: builder.query<MyProfile, void>({
      query: () => ({
        url: "/admin/settings/profile",
        method: "GET",
      }),
      providesTags: ["Me"],
    }),
    updateMyProfile: builder.mutation<MyProfile, UpdateMyProfileDto>({
      query: (body) => ({
        url: "/admin/settings/profile",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Me"],
    }),
    changePassword: builder.mutation<void, ChangePasswordDto>({
      query: (body) => ({
        url: "/admin/settings/password",
        method: "PUT",
        body,
      }),
    }),
    getTeamList: builder.query<TeamMember[], void>({
      query: () => ({
        url: "/admin/settings/team",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "User" as const, id })),
              { type: "User", id: "TEAM_LIST" },
            ]
          : [{ type: "User", id: "TEAM_LIST" }],
    }),
    inviteTeamMember: builder.mutation<TeamMember, InviteTeamMemberDto>({
      query: (body) => ({
        url: "/admin/settings/team",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "User", id: "TEAM_LIST" }],
    }),
    updateTeamMemberRole: builder.mutation<
      TeamMember,
      { id: string | number; body: UpdateTeamMemberRoleDto }
    >({
      query: ({ id, body }) => ({
        url: `/admin/settings/team/${id}/role`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "User", id },
        { type: "User", id: "TEAM_LIST" },
      ],
    }),
    removeTeamMember: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/admin/settings/team/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_, __, id) => [
        { type: "User", id },
        { type: "User", id: "TEAM_LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSettingsQuery,
  useLazyGetSettingsQuery,
  useUpdateSettingsMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useChangePasswordMutation,
  useGetTeamListQuery,
  useInviteTeamMemberMutation,
  useUpdateTeamMemberRoleMutation,
  useRemoveTeamMemberMutation,
} = settingsApiSlice;
