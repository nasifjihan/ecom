"use client";

/** Suppliers, purchases (stock in + cost price), supplier payments and money accounts (API: modules/purchasing). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export type PaymentTerm = "advance" | "instant_full" | "instant_partial" | "credit";
export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "bkash" | "nagad" | "rocket" | "other";
export type AccountType = "bank" | "cash" | "mobile";

export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  instant_full: "Paid in full now",
  instant_partial: "Part paid now",
  credit: "On credit (pay later)",
  advance: "Already paid (advance)",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  other: "Other",
};
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = { cash: "Cash", bank: "Bank", mobile: "Mobile banking" };

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  countryCode: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  openingBalance: number;
  purchased: number;
  paid: number;
  purchases: number;
  /** What the shop owes them now (negative = paid ahead). */
  balance: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplier: string | null;
  purchaseId: string | null;
  purchaseNumber: string | null;
  account: string;
  accountId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  reference: string | null;
  notes: string | null;
}

export interface SupplierDetail extends Supplier {
  purchaseList: { id: string; number: string; purchasedOn: string; reference: string | null; total: number; status: string; paymentTerm: PaymentTerm }[];
  paymentList: SupplierPayment[];
}

export type SupplierInput = Partial<{
  name: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  countryCode: string;
  address: string;
  notes: string;
  openingBalance: number;
  isActive: boolean;
}>;

export interface PurchaseRow {
  id: string;
  number: string;
  purchasedOn: string;
  supplier: string;
  supplierId: string;
  sourcingType: "local" | "import";
  originCountry: string | null;
  sourceFrom: string | null;
  reference: string | null;
  items: number;
  total: number;
  paid: number;
  paymentTerm: PaymentTerm;
  status: "received" | "cancelled";
}

export interface PurchaseDetail {
  id: string;
  number: string;
  warehouse: { name: string; code: string } | null;
  supplier: { id: string; name: string };
  sourcingType: "local" | "import";
  originCountry: string | null;
  sourceFrom: string | null;
  reference: string | null;
  purchasedOn: string;
  itemsSubtotal: number;
  shippingCost: number;
  customsDuty: number;
  otherCharges: number;
  discount: number;
  total: number;
  paymentTerm: PaymentTerm;
  status: "received" | "cancelled";
  notes: string | null;
  cancelledAt: string | null;
  createdAt: string;
  paid: number;
  items: {
    id: string;
    productId: string;
    variantId: string | null;
    name: string;
    qualityGrade: string | null;
    qty: number;
    unitCost: number;
    discountPct: number;
    discountAmount: number;
    lineTotal: number;
    landedUnitCost: number;
  }[];
  payments: SupplierPayment[];
}

export interface PurchaseInput {
  supplierId: string;
  sourcingType: "local" | "import";
  originCountry?: string;
  sourceFrom?: string;
  reference?: string;
  purchasedOn: string;
  /** Warehouse the goods go into; the default one when left out. */
  warehouseId?: string | null;
  shippingCost?: number;
  customsDuty?: number;
  otherCharges?: number;
  discount?: number;
  items: { productId: string; variantId?: string | null; qualityGrade?: string; qty: number; unitCost: number; discountPct?: number; discountAmount?: number }[];
  paymentTerm: PaymentTerm;
  payNow?: number;
  accountId?: string | null;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface PickProduct {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  imageUrl: string | null;
  stockQty: number;
  costPrice: number | null;
  variants: { id: string; label: string; sku: string | null; stockQty: number; costPrice: number | null }[];
}

export interface MoneyAccount {
  id: string;
  name: string;
  type: AccountType;
  details: string | null;
  isActive: boolean;
  openingBalance: number;
  balance: number;
}

export interface LedgerRow {
  id: string;
  occurredOn: string;
  kind: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  refType: string | null;
  refId: string | null;
}

export interface Ledger {
  account: { id: string; name: string; type: AccountType; openingBalance: number; balance: number };
  items: LedgerRow[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface PaymentInput {
  supplierId: string;
  purchaseId?: string | null;
  accountId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  reference?: string;
  notes?: string;
}

export interface MoveMoneyInput {
  kind: "deposit" | "withdrawal" | "adjustment" | "transfer";
  accountId: string;
  toAccountId?: string | null;
  amount: number;
  occurredOn: string;
  note?: string;
}

const T = (id: string) => ({ type: "Purchasing" as const, id });
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
/** Money moves change suppliers, purchases, payments and accounts together. */
const MONEY = [T("SUPPLIERS"), T("PURCHASES"), T("PAYMENTS"), T("ACCOUNTS")];

export const purchasingApi = api.injectEndpoints({
  endpoints: (b) => ({
    suppliers: b.query<Supplier[], { search?: string; active?: "true" | "false" } | void>({
      query: (params) => ({ url: "/admin/purchasing/suppliers", params: clean(params ?? {}) }),
      providesTags: [T("SUPPLIERS")],
    }),
    supplier: b.query<SupplierDetail, string>({
      query: (id) => `/admin/purchasing/suppliers/${id}`,
      providesTags: [T("SUPPLIERS")],
    }),
    createSupplier: b.mutation<SupplierDetail, SupplierInput>({
      query: (body) => ({ url: "/admin/purchasing/suppliers", method: "POST", body }),
      invalidatesTags: [T("SUPPLIERS")],
    }),
    updateSupplier: b.mutation<SupplierDetail, SupplierInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/purchasing/suppliers/${id}`, method: "PATCH", body }),
      invalidatesTags: [T("SUPPLIERS")],
    }),
    deleteSupplier: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/admin/purchasing/suppliers/${id}`, method: "DELETE" }),
      invalidatesTags: [T("SUPPLIERS")],
    }),

    pickProducts: b.query<PickProduct[], string>({
      query: (search) => ({ url: "/admin/purchasing/pick/products", params: { search } }),
      keepUnusedDataFor: 30,
    }),

    grades: b.query<{ id: string; name: string }[], void>({ query: () => "/admin/purchasing/grades", providesTags: [T("GRADES")] }),
    addGrade: b.mutation<{ id: string; name: string }[], string>({
      query: (name) => ({ url: "/admin/purchasing/grades", method: "POST", body: { name } }),
      invalidatesTags: [T("GRADES")],
    }),
    deleteGrade: b.mutation<{ id: string; name: string }[], string>({
      query: (id) => ({ url: `/admin/purchasing/grades/${id}`, method: "DELETE" }),
      invalidatesTags: [T("GRADES")],
    }),

    purchases: b.query<
      Paginated<PurchaseRow> & { totalValue: number },
      { supplierId?: string; status?: "received" | "cancelled"; search?: string; from?: string; to?: string; page?: number }
    >({
      query: (params) => ({ url: "/admin/purchasing/purchases", params: clean(params) }),
      transformResponse: (items: PurchaseRow[], meta) => ({
        ...toPaginated(items, meta),
        totalValue: Number((meta as Record<string, unknown> | null)?.totalValue ?? 0),
      }),
      providesTags: [T("PURCHASES")],
    }),
    purchase: b.query<PurchaseDetail, string>({
      query: (id) => `/admin/purchasing/purchases/${id}`,
      providesTags: [T("PURCHASES")],
    }),
    createPurchase: b.mutation<PurchaseDetail, PurchaseInput>({
      query: (body) => ({ url: "/admin/purchasing/purchases", method: "POST", body }),
      invalidatesTags: [...MONEY, { type: "Product", id: "LIST" }],
    }),
    cancelPurchase: b.mutation<PurchaseDetail, string>({
      query: (id) => ({ url: `/admin/purchasing/purchases/${id}/cancel`, method: "POST" }),
      invalidatesTags: [...MONEY, { type: "Product", id: "LIST" }],
    }),

    supplierPayments: b.query<Paginated<SupplierPayment>, { supplierId?: string; page?: number }>({
      query: (params) => ({ url: "/admin/purchasing/payments", params: clean(params) }),
      transformResponse: (items: SupplierPayment[], meta) => toPaginated(items, meta),
      providesTags: [T("PAYMENTS")],
    }),
    paySupplier: b.mutation<SupplierPayment, PaymentInput>({
      query: (body) => ({ url: "/admin/purchasing/payments", method: "POST", body }),
      invalidatesTags: MONEY,
    }),
    voidSupplierPayment: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/admin/purchasing/payments/${id}`, method: "DELETE" }),
      invalidatesTags: MONEY,
    }),

    moneyAccounts: b.query<MoneyAccount[], void>({ query: () => "/admin/purchasing/accounts", providesTags: [T("ACCOUNTS")] }),
    createMoneyAccount: b.mutation<MoneyAccount[], { name: string; type: AccountType; details?: string; openingBalance?: number }>({
      query: (body) => ({ url: "/admin/purchasing/accounts", method: "POST", body }),
      invalidatesTags: [T("ACCOUNTS")],
    }),
    updateMoneyAccount: b.mutation<MoneyAccount[], { id: string; name?: string; type?: AccountType; details?: string; openingBalance?: number; isActive?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/admin/purchasing/accounts/${id}`, method: "PATCH", body }),
      invalidatesTags: [T("ACCOUNTS")],
    }),
    moveMoney: b.mutation<MoneyAccount[], MoveMoneyInput>({
      query: (body) => ({ url: "/admin/purchasing/accounts/move", method: "POST", body }),
      invalidatesTags: [T("ACCOUNTS")],
    }),
    ledger: b.query<Ledger, { id: string; page?: number }>({
      query: ({ id, page }) => ({ url: `/admin/purchasing/accounts/${id}/ledger`, params: clean({ page }) }),
      providesTags: [T("ACCOUNTS")],
    }),
  }),
});

export const {
  useSuppliersQuery,
  useSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  usePickProductsQuery,
  useGradesQuery,
  useAddGradeMutation,
  useDeleteGradeMutation,
  usePurchasesQuery,
  usePurchaseQuery,
  useCreatePurchaseMutation,
  useCancelPurchaseMutation,
  useSupplierPaymentsQuery,
  usePaySupplierMutation,
  useVoidSupplierPaymentMutation,
  useMoneyAccountsQuery,
  useCreateMoneyAccountMutation,
  useUpdateMoneyAccountMutation,
  useMoveMoneyMutation,
  useLedgerQuery,
} = purchasingApi;

/** "৳1,234.50" */
export const tk = (n: number) => `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
/** Today in the browser's time zone, as YYYY-MM-DD. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
