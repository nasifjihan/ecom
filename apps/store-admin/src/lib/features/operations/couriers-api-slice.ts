"use client";

/** Courier accounts (Steadfast, Pathao, RedX), booking parcels, status sync and labels (API: modules/couriers). */
import { api, fileResponse } from "@ecom/api-client";

export type CourierCode = "steadfast" | "pathao" | "redx";

export const COURIER_INFO: Record<CourierCode, { name: string; fields: { key: string; label: string; secret?: boolean }[]; help: string; webhookHelp: string }> = {
  steadfast: {
    name: "Steadfast",
    fields: [
      { key: "apiKey", label: "API key" },
      { key: "secretKey", label: "Secret key", secret: true },
    ],
    help: "Steadfast merchant panel → API: copy the API key and secret key.",
    webhookHelp: "Steadfast panel → API → Webhook: paste the callback URL and use the secret as the Auth Token (Bearer).",
  },
  pathao: {
    name: "Pathao",
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", secret: true },
      { key: "username", label: "Merchant email" },
      { key: "password", label: "Merchant password", secret: true },
    ],
    help: "Pathao merchant panel → Developers API: client ID and secret, plus the email and password you log in with.",
    webhookHelp: "Pathao panel → Developers API → Webhook: paste the callback URL and the secret.",
  },
  redx: {
    name: "RedX",
    fields: [{ key: "accessToken", label: "API access token", secret: true }],
    help: "RedX merchant panel → Developer API: generate an access token.",
    webhookHelp: "RedX panel → Developer API → Webhook: paste the callback URL (the link itself is the secret).",
  },
};

export interface CourierAccount {
  id: string;
  courier: CourierCode;
  courierName: string;
  label: string;
  enabled: boolean;
  mode: "sandbox" | "live";
  settings: { storeId?: number; deliveryType?: number; itemType?: number; pickupStoreId?: number; defaultWeightKg?: number };
  credentialHints: Record<string, string | null>;
  webhookUrl: string;
  webhookSecret: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  activeParcels: number;
}

export interface ActiveCourier {
  id: string;
  courier: CourierCode;
  courierName: string;
  label: string;
  mode: string;
}

export interface AccountInput {
  courier?: CourierCode;
  label?: string;
  mode?: "sandbox" | "live";
  enabled?: boolean;
  credentials?: Record<string, string>;
  settings?: CourierAccount["settings"];
}

export interface Place {
  id: number;
  name: string;
}

export interface AreaSuggestion {
  pathao?: { cityId: number; cityName: string; zoneId: number | null; zoneName: string | null } | null;
  redx?: { areaId: number; areaName: string } | null;
}

export interface BulkResult {
  booked: number;
  failed: number;
  results: { orderId: string; number: string; ok: boolean; parcel?: string; consignmentId?: string; error?: string }[];
}

const TAGS = [
  { type: "Order" as const, id: "PARCELS" },
  { type: "Order" as const, id: "LIST" },
  { type: "Order" as const, id: "COD" },
];

export const couriersApi = api.injectEndpoints({
  endpoints: (b) => ({
    courierAccounts: b.query<CourierAccount[], void>({
      query: () => "/admin/couriers",
      providesTags: [{ type: "Store", id: "COURIERS" }],
    }),
    activeCouriers: b.query<ActiveCourier[], void>({
      query: () => "/admin/couriers/active",
      providesTags: [{ type: "Store", id: "COURIERS" }],
    }),
    createCourierAccount: b.mutation<CourierAccount, AccountInput>({
      query: (body) => ({ url: "/admin/couriers", method: "POST", body }),
      invalidatesTags: [{ type: "Store", id: "COURIERS" }],
    }),
    updateCourierAccount: b.mutation<CourierAccount, AccountInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/couriers/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Store", id: "COURIERS" }],
    }),
    deleteCourierAccount: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/admin/couriers/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Store", id: "COURIERS" }],
    }),
    testCourierAccount: b.mutation<{ ok: boolean; message: string }, string>({
      query: (id) => ({ url: `/admin/couriers/${id}/test`, method: "POST" }),
      invalidatesTags: [{ type: "Store", id: "COURIERS" }],
    }),
    rotateCourierWebhook: b.mutation<CourierAccount, string>({
      query: (id) => ({ url: `/admin/couriers/${id}/rotate-webhook`, method: "POST" }),
      invalidatesTags: [{ type: "Store", id: "COURIERS" }],
    }),

    pathaoCities: b.query<Place[], string>({ query: (id) => `/admin/couriers/${id}/pathao/cities`, keepUnusedDataFor: 3600 }),
    pathaoZones: b.query<Place[], { id: string; cityId: number }>({
      query: ({ id, cityId }) => ({ url: `/admin/couriers/${id}/pathao/zones`, params: { cityId } }),
      keepUnusedDataFor: 3600,
    }),
    pathaoAreas: b.query<Place[], { id: string; zoneId: number }>({
      query: ({ id, zoneId }) => ({ url: `/admin/couriers/${id}/pathao/areas`, params: { zoneId } }),
      keepUnusedDataFor: 3600,
    }),
    redxAreas: b.query<(Place & { district: string | null })[], { id: string; district?: string }>({
      query: ({ id, district }) => ({ url: `/admin/couriers/${id}/redx/areas`, params: district ? { district } : {} }),
      keepUnusedDataFor: 3600,
    }),
    courierArea: b.query<AreaSuggestion, { parcelId: string; accountId: string }>({
      query: ({ parcelId, accountId }) => ({ url: `/admin/shipments/${parcelId}/courier-area`, params: { accountId } }),
    }),

    bookParcel: b.mutation<
      unknown,
      { parcelId: string; orderId: string | number; accountId: string; pathao?: { cityId: number; zoneId: number; areaId?: number }; redx?: { areaId: number; areaName: string }; weightKg?: number; note?: string }
    >({
      query: ({ parcelId, orderId: _o, ...body }) => ({ url: `/admin/shipments/${parcelId}/book`, method: "POST", body }),
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: orderId }, ...TAGS],
    }),
    syncParcel: b.mutation<{ parcel: string; ok: boolean; courierStatus?: string; moved?: string[]; error?: string }, { parcelId: string; orderId: string | number }>({
      query: ({ parcelId }) => ({ url: `/admin/shipments/${parcelId}/sync`, method: "POST" }),
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: orderId }, ...TAGS],
    }),
    syncAllParcels: b.mutation<{ checked: number; moved: number; errors: number }, void>({
      query: () => ({ url: "/admin/shipments/sync", method: "POST" }),
      invalidatesTags: [...TAGS, "Order"],
    }),
    /** No accountId: each order goes to its storefront's courier. */
    bulkBookCourier: b.mutation<BulkResult, { accountId?: string; orderIds: (string | number)[] }>({
      query: (body) => ({ url: "/admin/orders/book-courier", method: "POST", body }),
      invalidatesTags: [...TAGS, "Order"],
    }),
    /** 4x6 labels PDF as an object URL (see openFile in @ecom/api-client). */
    parcelLabels: b.mutation<string, string[]>({
      query: (ids) => ({ url: "/admin/shipments/labels", params: { ids: ids.join(",") }, responseHandler: fileResponse }),
    }),
  }),
});

export const {
  useCourierAccountsQuery,
  useActiveCouriersQuery,
  useCreateCourierAccountMutation,
  useUpdateCourierAccountMutation,
  useDeleteCourierAccountMutation,
  useTestCourierAccountMutation,
  useRotateCourierWebhookMutation,
  usePathaoCitiesQuery,
  usePathaoZonesQuery,
  usePathaoAreasQuery,
  useRedxAreasQuery,
  useCourierAreaQuery,
  useBookParcelMutation,
  useSyncParcelMutation,
  useSyncAllParcelsMutation,
  useBulkBookCourierMutation,
  useParcelLabelsMutation,
} = couriersApi;
