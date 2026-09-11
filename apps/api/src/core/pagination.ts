/**
 * PAGINATION HELPER — returns our STANDARD envelope every list endpoint uses.
 * Usage in controller:
 *   const rows = await repo.paginate({ page, perPage, sortBy, sortOrder });
 *   const page = paginate({page,perPage,total:rows.count,items:rows.items,filters:{q:"foo"}});
 *   res.ok(page.data, page.meta);
 */
import type { PaginationDto } from "@ecom/zod-schemas";

export type PaginationMeta = PaginationDto & {
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  filtersApplied?: Record<string, unknown>;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

export function paginate<T>(args: {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filtersApplied?: Record<string, unknown>;
}): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(args.total / args.perPage));
  const safePage = Math.min(Math.max(1, args.page), totalPages);
  return {
    data: args.items,
    meta: {
      page: safePage,
      perPage: args.perPage,
      sortBy: args.sortBy ?? "createdAt",
      sortOrder: args.sortOrder ?? "desc",
      search: args.search,
      total: args.total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
      filtersApplied: args.filtersApplied ?? {},
    },
  };
}
