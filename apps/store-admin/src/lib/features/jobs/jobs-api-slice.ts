"use client";

/** Background imports and exports: Settings > Import & export jobs (API: modules/jobs). */
import { api, fileResponse } from "@ecom/api-client";

export type JobKind = "export_orders" | "export_customers" | "export_products" | "export_newsletter" | "import_products";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface DataJob {
  id: string;
  kind: JobKind;
  label: string;
  status: JobStatus;
  progress: number;
  rows: number | null;
  error: string | null;
  filename: string | null;
  inputName: string | null;
  hasFile: boolean;
  createdBy: string;
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
  /** Imports: what happened. */
  result: { created: number; updated: number; failedCount: number; failed: { sku: string; rows: number[]; message: string }[] } | null;
}

export interface ExportFilters {
  status?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  groupId?: string;
  acceptMarketing?: boolean;
}

/** Above this many rows an export runs as a job instead of downloading straight away. */
export const INSTANT_EXPORT_LIMIT = 2000;

const LIST = [{ type: "DataJob" as const, id: "LIST" }];

export const jobsApi = api.injectEndpoints({
  endpoints: (b) => ({
    dataJobs: b.query<DataJob[], void>({ query: () => "/admin/jobs", providesTags: LIST }),
    dataJob: b.query<DataJob, string>({ query: (id) => `/admin/jobs/${id}`, providesTags: (_r, _e, id) => [{ type: "DataJob", id }] }),
    startExport: b.mutation<DataJob, { kind: Exclude<JobKind, "import_products">; format: "csv" | "xlsx"; filters?: ExportFilters }>({
      query: (body) => ({ url: "/admin/jobs/exports", method: "POST", body }),
      invalidatesTags: LIST,
    }),
    startProductImport: b.mutation<DataJob, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: "/admin/jobs/imports/products", method: "POST", body };
      },
      invalidatesTags: LIST,
    }),
    /** The finished file, as an object URL for openFile. */
    dataJobFile: b.mutation<string, string>({ query: (id) => ({ url: `/admin/jobs/${id}/file`, responseHandler: fileResponse }) }),
  }),
});

export const { useDataJobsQuery, useDataJobQuery, useStartExportMutation, useStartProductImportMutation, useDataJobFileMutation } = jobsApi;
