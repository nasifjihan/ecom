"use client";

/** Customers' product questions and what they search for (API: modules/marketing/questions). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export type QuestionStatus = "pending" | "published" | "hidden";

export interface ProductQuestion {
  id: string;
  product: { id: string; name: string; slug: string };
  name: string;
  question: string;
  answer: string | null;
  status: QuestionStatus;
  fromCustomer: boolean;
  askedAt: string;
  answeredAt: string | null;
}

export interface SearchTermRow {
  id: string;
  term: string;
  searches: number;
  results: number;
  lastSearchedAt: string;
}

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export const questionsApi = api.injectEndpoints({
  endpoints: (b) => ({
    productQuestions: b.query<Paginated<ProductQuestion> & { pending: number }, { status?: QuestionStatus; search?: string; page?: number }>({
      query: (params) => ({ url: "/admin/marketing/questions", params: clean(params) }),
      transformResponse: (items: ProductQuestion[], meta) => ({
        ...toPaginated(items, meta),
        pending: Number((meta as Record<string, unknown> | null)?.pending ?? 0),
      }),
      providesTags: [{ type: "Product", id: "QUESTIONS" }],
    }),
    updateQuestion: b.mutation<ProductQuestion, { id: string; answer?: string; status?: QuestionStatus }>({
      query: ({ id, ...body }) => ({ url: `/admin/marketing/questions/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Product", id: "QUESTIONS" }],
    }),
    deleteQuestion: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/admin/marketing/questions/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Product", id: "QUESTIONS" }],
    }),
    searchTerms: b.query<Paginated<SearchTermRow>, { search?: string; noResults?: "1"; page?: number }>({
      query: (params) => ({ url: "/admin/marketing/search-terms", params: clean(params) }),
      transformResponse: (items: SearchTermRow[], meta) => toPaginated(items, meta),
    }),
  }),
});

export const { useProductQuestionsQuery, useUpdateQuestionMutation, useDeleteQuestionMutation, useSearchTermsQuery } = questionsApi;
