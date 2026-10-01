"use client";

/** Delivery areas, zones and delivery methods (API: /admin/locations, /admin/shipping/*). */
import { api } from "@ecom/api-client";

export type LocationType = "DIVISION" | "DISTRICT" | "UPAZILA" | "THANA";

export interface AdminLocation {
  id: string;
  parentId: string | null;
  type: LocationType;
  en: string;
  bn: string;
  /** False when the store switched delivery off for this area itself (not via a parent). */
  delivery: boolean;
  zones: { id: string; name: string }[];
}

export interface WeightTier {
  upToKg: number;
  cost: number;
}

export interface CostRules {
  perKgExtra?: number;
  minimumCost?: number;
  weightTiers?: WeightTier[];
  minSubtotal?: number;
}

export interface ShippingMethod {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  baseCost: string;
  perItemCost: string;
  freeFromSubtotal: string | null;
  costRules: string | CostRules | null;
  deliveryEstimateMinDays: number | null;
  deliveryEstimateMaxDays: number | null;
  /** Customers pick a delivery time slot with this option. */
  useSlots: boolean;
}

export interface ZoneLocation {
  id: string;
  code: string;
  type: LocationType;
  nameEn: string;
  nameBn: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  enabled: boolean;
  countries: string[];
  postcodes: string[] | null;
  /** Place names saved before zones used areas. */
  states: string[] | null;
  locations: ZoneLocation[];
  locationIds: string[];
  /** Only for these storefronts (empty: all). */
  storefrontIds?: string[];
  _count?: { methods: number };
  methods?: ShippingMethod[];
}

export interface ZoneInput {
  name?: string;
  enabled?: boolean;
  countries?: string[];
  locationIds?: string[];
  postcodes?: string[];
  storefrontIds?: string[];
}

export interface MethodInput {
  zoneId?: string;
  code?: string;
  name?: string;
  description?: string | null;
  enabled?: boolean;
  sortOrder?: number;
  baseCost?: number;
  perItemCost?: number;
  perKgExtra?: number;
  minimumCost?: number;
  weightTiers?: WeightTier[];
  minSubtotal?: number;
  freeFromSubtotal?: number | null;
  deliveryEstimateMinDays?: number | null;
  deliveryEstimateMaxDays?: number | null;
  useSlots?: boolean;
}

export interface DeliverySlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  /** Orders close this many minutes before the window starts. */
  cutoffMinutes: number;
  fee: number;
  capacity: number | null;
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  enabled: boolean;
  sortOrder: number;
  /** Orders booked from today on, per day. */
  upcoming: { date: string; orders: number }[];
}

export type SlotInput = Omit<DeliverySlot, "id" | "upcoming">;

export interface SlotSettings {
  daysAhead: number;
  closedDates: string[];
  timeZone: string;
}

export const parseCostRules = (v: ShippingMethod["costRules"]): CostRules => {
  if (!v) return {};
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as CostRules;
    } catch {
      return {};
    }
  }
  return v;
};

export const shippingApi = api.injectEndpoints({
  endpoints: (b) => ({
    getLocations: b.query<AdminLocation[], void>({
      query: () => "/admin/locations",
      providesTags: ["Location"],
    }),
    setLocationDelivery: b.mutation<{ id: string; delivery: boolean }, { id: string; enabled: boolean }>({
      query: ({ id, enabled }) => ({ url: `/admin/locations/${id}/delivery`, method: "PUT", body: { enabled } }),
      // Optimistic: the switch flips at once; a failure puts it back.
      async onQueryStarted({ id, enabled }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          shippingApi.util.updateQueryData("getLocations", undefined, (rows) => {
            const row = rows.find((r) => r.id === id);
            if (row) row.delivery = enabled;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    getZones: b.query<ShippingZone[], void>({
      query: () => ({ url: "/admin/shipping/zones", params: { perPage: 100 } }),
      transformResponse: (data: { rows: ShippingZone[] }) => data.rows,
      providesTags: ["ShippingZone"],
    }),
    getZone: b.query<ShippingZone, string>({
      query: (id) => `/admin/shipping/zones/${id}`,
      providesTags: (_r, _e, id) => [{ type: "ShippingZone", id }],
    }),
    createZone: b.mutation<ShippingZone, ZoneInput>({
      query: (body) => ({ url: "/admin/shipping/zones", method: "POST", body }),
      invalidatesTags: ["ShippingZone", "Location"],
    }),
    updateZone: b.mutation<ShippingZone, { id: string } & ZoneInput>({
      query: ({ id, ...body }) => ({ url: `/admin/shipping/zones/${id}`, method: "PUT", body }),
      invalidatesTags: ["ShippingZone", "Location"],
    }),
    deleteZone: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/shipping/zones/${id}`, method: "DELETE" }),
      invalidatesTags: ["ShippingZone", "Location"],
    }),

    createMethod: b.mutation<ShippingMethod, MethodInput>({
      query: (body) => ({ url: "/admin/shipping/methods", method: "POST", body }),
      invalidatesTags: ["ShippingZone"],
    }),
    updateMethod: b.mutation<ShippingMethod, { id: string } & MethodInput>({
      query: ({ id, ...body }) => ({ url: `/admin/shipping/methods/${id}`, method: "PUT", body }),
      invalidatesTags: ["ShippingZone"],
    }),
    deleteMethod: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/shipping/methods/${id}`, method: "DELETE" }),
      invalidatesTags: ["ShippingZone"],
    }),

    getDeliverySlots: b.query<{ settings: SlotSettings; slots: DeliverySlot[] }, void>({
      query: () => ({ url: "/admin/shipping/slots" }),
      providesTags: ["DeliverySlot"],
    }),
    createDeliverySlot: b.mutation<unknown, SlotInput>({
      query: (body) => ({ url: "/admin/shipping/slots", method: "POST", body }),
      invalidatesTags: ["DeliverySlot"],
    }),
    updateDeliverySlot: b.mutation<unknown, { id: string } & SlotInput>({
      query: ({ id, ...body }) => ({ url: `/admin/shipping/slots/${id}`, method: "PUT", body }),
      invalidatesTags: ["DeliverySlot"],
    }),
    deleteDeliverySlot: b.mutation<unknown, string>({
      query: (id) => ({ url: `/admin/shipping/slots/${id}`, method: "DELETE" }),
      invalidatesTags: ["DeliverySlot"],
    }),
    saveSlotSettings: b.mutation<SlotSettings, { daysAhead: number; closedDates: string[] }>({
      query: (body) => ({ url: "/admin/shipping/slots/settings", method: "PUT", body }),
      invalidatesTags: ["DeliverySlot"],
    }),
  }),
});

export const {
  useGetLocationsQuery,
  useSetLocationDeliveryMutation,
  useGetZonesQuery,
  useGetZoneQuery,
  useCreateZoneMutation,
  useUpdateZoneMutation,
  useDeleteZoneMutation,
  useCreateMethodMutation,
  useUpdateMethodMutation,
  useDeleteMethodMutation,
  useGetDeliverySlotsQuery,
  useCreateDeliverySlotMutation,
  useUpdateDeliverySlotMutation,
  useDeleteDeliverySlotMutation,
  useSaveSlotSettingsMutation,
} = shippingApi;
