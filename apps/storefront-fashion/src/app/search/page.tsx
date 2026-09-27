"use client";

/** Search results, with popular searches when nothing is typed or nothing matches. */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, TrendingUp } from "lucide-react";
import { Button, Input, ProductGrid, useGetProductsQuery } from "@ecom/storefront-base";
import { usePopularSearchesQuery } from "@/lib/engagement";
import { useProductGridActions } from "../_components/product-actions";

const PER_PAGE = 24;

export default function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const q = (params.get("q") ?? "").trim();
  const [text, setText] = React.useState(q);
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    setText(q);
    setPage(1);
  }, [q]);
  const { data, isFetching } = useGetProductsQuery({ search: q, page, perPage: PER_PAGE }, { skip: !q });
  const { data: popular = [] } = usePopularSearchesQuery();
  const actions = useProductGridActions();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
  };

  const Popular = () =>
    popular.length ? (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> Popular searches
        </p>
        <div className="flex flex-wrap gap-2">
          {popular.map((t) => (
            <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary">
              {t}
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="container space-y-6 py-6 md:py-10">
      <form onSubmit={submit} role="search" className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={!q}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search products, e.g. panjabi, saree, cotton"
          aria-label="Search products"
          enterKeyHint="search"
          className="h-12 pl-11 text-base"
        />
      </form>

      {!q ? (
        <Popular />
      ) : (
        <>
          <h1 className="text-xl font-bold md:text-2xl">
            {data ? `${data.total} result${data.total === 1 ? "" : "s"} for “${q}”` : `Searching for “${q}”…`}
          </h1>
          {data?.total === 0 ? (
            <div className="space-y-6 rounded-2xl border p-8 text-center">
              <p className="text-muted-foreground">Nothing matches “{q}”. Try a shorter word, or one of these:</p>
              <div className="flex justify-center">
                <Popular />
              </div>
              <Button asChild variant="outline">
                <Link href="/products">Browse all products</Link>
              </Button>
            </div>
          ) : (
            <ProductGrid products={data?.items ?? []} loading={isFetching && !data} cols={4} {...actions} />
          )}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
