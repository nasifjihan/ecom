"use client";

/** What customers search for on the storefront, most searched first; searches that found nothing show what to stock or tag. */
import { useEffect, useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import { Button, Card, CardContent, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import { useSearchTermsQuery } from "@/lib/features/marketing/questions-api-slice";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function SearchTermsPage() {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [noResults, setNoResults] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setPage(1), [search, noResults]);
  const { data, isFetching } = useSearchTermsQuery({ search, noResults: noResults ? "1" : undefined, page });

  return (
    <div className="space-y-6">
      <PageTitle
        icon={TrendingUp}
        title="Search terms"
        description="What customers typed in the storefront search, counted per term (not per person). Terms searched twice or more with results are suggested to shoppers."
      />
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Find a term" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find a term" />
        </div>
        <Toggle checked={noResults} onChange={setNoResults} label="Only searches that found nothing" />
      </div>
      <Card>
        <CardContent className={cn("p-0", isFetching && "opacity-60")}>
          {!data ? (
            <Skeleton className="m-4 h-24" />
          ) : !data.items.length ? (
            <p className="p-10 text-center text-sm text-slate-500">No searches yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Searches</TableHead>
                  <TableHead className="text-right">Products found</TableHead>
                  <TableHead>Last searched</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.term}</TableCell>
                    <TableCell className="text-right">{t.searches}</TableCell>
                    <TableCell className={cn("text-right", t.results === 0 && "font-medium text-rose-600")}>{t.results === 0 ? "None" : t.results}</TableCell>
                    <TableCell>{day(t.lastSearchedAt)}</TableCell>
                    <TableCell className="text-right">
                      <a href={`${STOREFRONT_URL}/search?q=${encodeURIComponent(t.term)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        See results
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
