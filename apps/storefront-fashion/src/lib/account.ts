"use client";

/**
 * Customer sign-in state and the My Account API.
 *
 * The access token lives in localStorage ("accessToken"), where the API client
 * reads it for every request, so checkout links orders to the signed-in
 * customer. The refresh token is an httpOnly cookie set by the API; the API
 * client refreshes on 401 through /auth/customer/refresh.
 */
import { api, toPaginated, type Paginated } from "@ecom/api-client";
import type { AppDispatch } from "@/lib/store";

const TOKEN_KEY = "accessToken";
const CUSTOMER_KEY = "customer";

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  acceptMarketing?: boolean;
  orderCount?: number;
  createdAt?: string;
}

export interface CustomerAddress {
  id: string;
  type: "shipping" | "billing";
  label: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string | null;
  postcode: string | null;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
}

export type AddressInput = Omit<CustomerAddress, "id" | "isDefault"> & { isDefault?: boolean };

export interface MyOrderRow {
  orderRef: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  itemCount: number;
  firstItem: { title: string; image: string } | null;
  grandTotal: number;
  currency: string;
  canCancel: boolean;
}

export interface MyOrder {
  orderRef: string;
  orderKey: string;
  status: string;
  paymentStatus: string;
  paymentGateway: string | null;
  createdAt: string;
  email: string;
  phone: string | null;
  shippingMethodName: string | null;
  shipping: { name: string; address: string; city: string | null; division: string | null; postcode: string | null; country: string | null };
  items: { id: string; title: string; variantLabel: string; image: string; qty: number; price: number; lineTotal: number }[];
  itemsSubtotal: number;
  discountTotal: number;
  couponUsed: string | null;
  shippingTotal: number;
  taxTotal: number;
  feeTotal: number;
  grandTotal: number;
  currency: string;
  canCancel: boolean;
  history: { status: string; note: string | null; at: string }[];
}

interface AuthResult {
  accessToken: string;
  user: Customer;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  acceptMarketing?: boolean;
}

/* ------------------------------ Auth state ------------------------------ */

export const fullName = (c: Pick<Customer, "firstName" | "lastName">) => `${c.firstName} ${c.lastName}`.trim();

function authPayload(c: Customer | null, token: string | null) {
  return {
    type: "auth/changed",
    payload: {
      isAuthenticated: !!c,
      customerId: c?.id ?? null,
      customerEmail: c?.email ?? null,
      customerName: c ? fullName(c) : null,
      token,
    },
  };
}

export function signIn(dispatch: AppDispatch, result: AuthResult) {
  try {
    window.localStorage.setItem(TOKEN_KEY, result.accessToken);
    window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(result.user));
  } catch {
    /* storage blocked: the session lasts until reload */
  }
  dispatch(api.util.resetApiState());
  dispatch(authPayload(result.user, result.accessToken));
}

/** Refresh the saved customer (e.g. after a profile edit) without touching the session. */
export function updateStoredCustomer(dispatch: AppDispatch, user: Customer) {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(TOKEN_KEY);
    window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  dispatch(authPayload(user, token));
}

export function signOutLocally(dispatch: AppDispatch) {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(CUSTOMER_KEY);
  } catch {
    /* ignore */
  }
  dispatch(api.util.resetApiState());
  dispatch(authPayload(null, null));
}

/** Restore the signed-in customer saved by signIn, before /me confirms it. */
export function restoreSession(dispatch: AppDispatch) {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const raw = window.localStorage.getItem(CUSTOMER_KEY);
    if (token && raw) dispatch(authPayload(JSON.parse(raw) as Customer, token));
  } catch {
    /* ignore */
  }
}

/** Sign-out from a page that is about to be left: no cache reset, so mounted queries don't refire. */
export function signOutAndLeave(to = "/") {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(CUSTOMER_KEY);
  } catch {
    /* ignore */
  }
  window.location.href = to;
}

export function storeRefreshedToken(token: string | null, dispatch: AppDispatch) {
  if (!token) return signOutLocally(dispatch);
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function hasStoredToken(): boolean {
  try {
    return !!window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

/* ------------------------------ Endpoints ------------------------------ */

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
/** Blank optional address fields go as null so an edit can clear them. */
const addressBody = (a: AddressInput) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]));

export const accountApi = api.injectEndpoints({
  endpoints: (builder) => ({
    customerLogin: builder.mutation<AuthResult, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/customer/login", method: "POST", body }),
    }),
    customerRegister: builder.mutation<AuthResult, RegisterInput>({
      query: (body) => ({ url: "/auth/customer/register", method: "POST", body: clean(body) }),
    }),
    customerLogout: builder.mutation<void, void>({
      query: () => ({ url: "/auth/logout", method: "POST", body: {} }),
    }),
    getMyProfile: builder.query<Customer & { addresses: CustomerAddress[] }, void>({
      query: () => "/storefront/account/me",
      providesTags: ["Me"],
    }),
    updateMyProfile: builder.mutation<Customer, Partial<Pick<Customer, "firstName" | "lastName" | "phone" | "acceptMarketing">>>({
      query: (body) => ({ url: "/storefront/account/me", method: "PATCH", body }),
      invalidatesTags: ["Me"],
    }),
    changeMyPassword: builder.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: "/storefront/account/me/password", method: "POST", body }),
    }),
    getMyAddresses: builder.query<CustomerAddress[], void>({
      query: () => "/storefront/account/me/addresses",
      providesTags: ["Customer"],
    }),
    addMyAddress: builder.mutation<CustomerAddress, AddressInput>({
      query: (body) => ({ url: "/storefront/account/me/addresses", method: "POST", body: addressBody(body) }),
      invalidatesTags: ["Customer", "Me"],
    }),
    updateMyAddress: builder.mutation<CustomerAddress, { id: string } & AddressInput>({
      query: ({ id, ...body }) => ({ url: `/storefront/account/me/addresses/${id}`, method: "PATCH", body: addressBody(body) }),
      invalidatesTags: ["Customer", "Me"],
    }),
    deleteMyAddress: builder.mutation<void, string>({
      query: (id) => ({ url: `/storefront/account/me/addresses/${id}`, method: "DELETE" }),
      invalidatesTags: ["Customer", "Me"],
    }),
    setMyDefaultAddress: builder.mutation<CustomerAddress, { id: string; type: "shipping" | "billing" }>({
      query: ({ id, type }) => ({ url: `/storefront/account/me/addresses/${id}/default`, method: "POST", body: { type } }),
      invalidatesTags: ["Customer", "Me"],
    }),
    getMyOrders: builder.query<Paginated<MyOrderRow>, { page?: number; perPage?: number } | void>({
      query: (args) => ({ url: "/storefront/account/orders", params: { page: 1, perPage: 10, ...(args ?? {}) } }),
      transformResponse: (items: MyOrderRow[], meta) => toPaginated(items, meta),
      providesTags: ["Order"],
    }),
    getMyOrder: builder.query<MyOrder, string>({
      query: (ref) => `/storefront/account/orders/${encodeURIComponent(ref)}`,
      providesTags: (_r, _e, ref) => [{ type: "Order", id: ref }],
    }),
    cancelMyOrder: builder.mutation<MyOrder, string>({
      query: (ref) => ({ url: `/storefront/account/orders/${encodeURIComponent(ref)}/cancel`, method: "POST", body: {} }),
      invalidatesTags: ["Order"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCustomerLoginMutation,
  useCustomerRegisterMutation,
  useCustomerLogoutMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useChangeMyPasswordMutation,
  useGetMyAddressesQuery,
  useAddMyAddressMutation,
  useUpdateMyAddressMutation,
  useDeleteMyAddressMutation,
  useSetMyDefaultAddressMutation,
  useGetMyOrdersQuery,
  useGetMyOrderQuery,
  useCancelMyOrderMutation,
} = accountApi;
