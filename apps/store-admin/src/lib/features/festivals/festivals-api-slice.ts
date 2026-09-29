"use client";

/** The festival calendar (API: /admin/festivals). Days are "YYYY-MM-DD" in Dhaka time. */
import { api } from "@ecom/api-client";

export type Phase = "later" | "prepare" | "on_sale" | "over";
export type LinkKind = "promotion" | "flash_sale" | "coupon" | "landing_page";
export type Coverage = "covers" | "partial" | "outside" | "always";

export interface FestivalTask {
  id: string;
  text: string;
  done: boolean;
}

export interface FestivalSummary {
  id: string;
  key: string | null;
  name: string;
  startsOn: string;
  endsOn: string;
  saleFrom: string;
  saleTo: string;
  dateIsEstimate: boolean;
  note: string | null;
  phase: Phase;
  daysToSale: number;
  daysToFestival: number;
  tasks: { done: number; total: number };
  links: number;
  remindedAt: string | null;
}

export interface FestivalLink {
  kind: LinkKind;
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  coverage: Coverage;
  canMatch: boolean;
  slug?: string;
}

export interface Festival extends Omit<FestivalSummary, "links"> {
  remindDays: number;
  checklist: FestivalTask[];
  links: FestivalLink[];
  lastYear: { from: string; to: string; orders: number; sales: number };
  thisYear: { orders: number; sales: number } | null;
}

export interface FestivalYear {
  year: number;
  today: string;
  festivals: FestivalSummary[];
  presetsToAdd: number;
  unknownDates: string[];
}

export interface FestivalInput {
  name: string;
  startsOn: string;
  endsOn: string;
  saleFrom: string;
  saleTo: string;
  dateIsEstimate: boolean;
  remindDays: number;
  note: string | null;
  checklist: FestivalTask[];
  links: Record<LinkKind, string[]>;
}

export const LINK_LABEL: Record<LinkKind, string> = {
  promotion: "Promotion",
  flash_sale: "Flash sale",
  coupon: "Coupon",
  landing_page: "Landing page",
};

const T = { type: "Page" as const, id: "FESTIVALS" };

export const festivalsApi = api.injectEndpoints({
  endpoints: (b) => ({
    festivals: b.query<FestivalYear, number>({ query: (year) => ({ url: "/admin/festivals", params: { year } }), providesTags: [T] }),
    upcomingFestivals: b.query<FestivalSummary[], void>({ query: () => "/admin/festivals/upcoming", providesTags: [T] }),
    festival: b.query<Festival, string>({ query: (id) => `/admin/festivals/${id}`, providesTags: [T] }),
    festivalLinkOptions: b.query<{ kind: LinkKind; id: string; name: string }[], void>({ query: () => "/admin/festivals/link-options" }),
    addFestivalPresets: b.mutation<{ added: number; unknownDates: string[] }, number>({
      query: (year) => ({ url: "/admin/festivals/presets", method: "POST", body: { year } }),
      invalidatesTags: [T],
    }),
    saveFestival: b.mutation<Festival, FestivalInput & { id?: string }>({
      query: ({ id, ...body }) => ({ url: id ? `/admin/festivals/${id}` : "/admin/festivals", method: id ? "PATCH" : "POST", body }),
      invalidatesTags: [T],
    }),
    setFestivalTask: b.mutation<{ done: number; total: number }, { id: string; taskId: string; done: boolean }>({
      query: ({ id, taskId, done }) => ({ url: `/admin/festivals/${id}/tasks/${taskId}`, method: "POST", body: { done } }),
      invalidatesTags: [T],
    }),
    matchFestivalDates: b.mutation<Festival, { id: string; kind: LinkKind; itemId: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/festivals/${id}/match`, method: "POST", body }),
      invalidatesTags: [T],
    }),
    deleteFestival: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/festivals/${id}`, method: "DELETE" }),
      invalidatesTags: [T],
    }),
  }),
});

export const {
  useFestivalsQuery,
  useUpcomingFestivalsQuery,
  useFestivalQuery,
  useFestivalLinkOptionsQuery,
  useAddFestivalPresetsMutation,
  useSaveFestivalMutation,
  useSetFestivalTaskMutation,
  useMatchFestivalDatesMutation,
  useDeleteFestivalMutation,
} = festivalsApi;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "21–23 Mar 2026", "24 Feb – 23 Mar", "14 Apr". The year is left out when `year` is false. */
export function dayRange(a: string, b: string, year = true): string {
  const [ya, ma, da] = a.split("-").map(Number) as [number, number, number];
  const [yb, mb, db] = b.split("-").map(Number) as [number, number, number];
  const y = (n: number) => (year ? ` ${n}` : "");
  if (a === b) return `${da} ${MONTHS[ma - 1]}${y(ya)}`;
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTHS[mb - 1]}${y(yb)}`;
  return `${da} ${MONTHS[ma - 1]}${ya !== yb ? ` ${ya}` : ""} – ${db} ${MONTHS[mb - 1]}${y(yb)}`;
}

/** "in 5 days", "tomorrow", "today", "3 days ago". */
export function inDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export const PHASE: Record<Phase, { label: string; className: string }> = {
  later: { label: "Later", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  prepare: { label: "Get ready", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  on_sale: { label: "Sale on", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  over: { label: "Over", className: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" },
};
