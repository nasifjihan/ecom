import { describe, it, expect } from "vitest";
import { paginate } from "../../src/core/pagination";

describe("paginate", () => {
  it("computes page counts and navigation flags", () => {
    const { data, meta } = paginate({ items: [1, 2, 3], total: 25, page: 2, perPage: 10 });
    expect(data).toEqual([1, 2, 3]);
    expect(meta).toMatchObject({
      page: 2,
      perPage: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
      sortBy: "createdAt",
      sortOrder: "desc",
      filtersApplied: {},
    });
  });

  it("clamps out-of-range pages into [1, totalPages]", () => {
    expect(paginate({ items: [], total: 25, page: 99, perPage: 10 }).meta.page).toBe(3);
    expect(paginate({ items: [], total: 25, page: 0, perPage: 10 }).meta.page).toBe(1);
    expect(paginate({ items: [], total: 25, page: -5, perPage: 10 }).meta.page).toBe(1);
  });

  it("reports one empty page when there are no rows", () => {
    const { meta } = paginate({ items: [], total: 0, page: 1, perPage: 20 });
    expect(meta).toMatchObject({ totalPages: 1, hasNext: false, hasPrev: false });
  });

  it("passes sorting, search and filters through", () => {
    const { meta } = paginate({
      items: [],
      total: 5,
      page: 1,
      perPage: 5,
      sortBy: "name",
      sortOrder: "asc",
      search: "shirt",
      filtersApplied: { status: "active" },
    });
    expect(meta).toMatchObject({
      sortBy: "name",
      sortOrder: "asc",
      search: "shirt",
      filtersApplied: { status: "active" },
      hasNext: false,
    });
  });
});
